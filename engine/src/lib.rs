//! The 6 Cube engine. Rust → WebAssembly, no bindings, no allocator tricks.
//! Bit-identical to lab.js: same move table (passed in by JS), same mulberry32 stream, same BFS.
//! pos[id] = slot holding sticker id; a move maps every slot to its new slot.

use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};

const N: usize = 54;
const MOVES: usize = 18;
const MAX_RADIUS: usize = 6;
const MAX_STEPS: usize = 64;

/// FNV-1a over the 54 bytes: tiny, fast, deterministic.
#[derive(Default)]
struct Fnv(u64);
impl Hasher for Fnv {
    fn finish(&self) -> u64 { self.0 }
    fn write(&mut self, bytes: &[u8]) {
        let mut h = if self.0 == 0 { 0xcbf29ce484222325 } else { self.0 };
        for b in bytes { h ^= *b as u64; h = h.wrapping_mul(0x100000001b3); }
        self.0 = h;
    }
}
type Ball = HashMap<[u8; N], u8, BuildHasherDefault<Fnv>>;

static mut PERM: [u8; MOVES * N] = [0; MOVES * N];   // JS writes MOVE_PERM here
static mut IO: [u8; N] = [0; N];                     // one state in / out
static mut LAYERS: [u32; MAX_RADIUS + 1] = [0; MAX_RADIUS + 1];
static mut BINS: [u32; MAX_RADIUS + 2] = [0; MAX_RADIUS + 2];
static mut EX_TRIAL: [i32; MAX_RADIUS + 2] = [-1; MAX_RADIUS + 2];
static mut EX_SEQ: [u8; (MAX_RADIUS + 2) * MAX_STEPS] = [0; (MAX_RADIUS + 2) * MAX_STEPS];
static mut BALL: Option<Ball> = None;
static mut RADIUS: usize = 4;
// experiment state
static mut RNG: u32 = 0;
static mut GEN_DISTINCT: bool = false;
static mut STEPS: usize = 2;
static mut TRIAL: u32 = 0;
static mut KEEP: bool = false;
static mut T_SEQ: Vec<u8> = Vec::new();    // every trial's moves, steps bytes each
static mut T_DIST: Vec<i8> = Vec::new();   // every trial's distance (-1 = outside)

#[inline(always)]
fn perm() -> &'static [u8; MOVES * N] { unsafe { &*core::ptr::addr_of!(PERM) } }

#[inline(always)]
fn apply(pos: &[u8; N], m: usize, out: &mut [u8; N]) {
    let p = &perm()[m * N..m * N + N];
    for i in 0..N { out[i] = p[pos[i] as usize]; }
}

fn identity() -> [u8; N] { let mut s = [0u8; N]; for i in 0..N { s[i] = i as u8; } s }

/// mulberry32, exactly as in lab.js
#[inline(always)]
fn next_f64() -> f64 {
    unsafe {
        RNG = RNG.wrapping_add(0x6D2B79F5);
        let a = RNG;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

#[no_mangle] pub extern "C" fn perm_ptr() -> *mut u8 { unsafe { core::ptr::addr_of_mut!(PERM) as *mut u8 } }
#[no_mangle] pub extern "C" fn io_ptr() -> *mut u8 { unsafe { core::ptr::addr_of_mut!(IO) as *mut u8 } }
#[no_mangle] pub extern "C" fn layers_ptr() -> *const u32 { unsafe { core::ptr::addr_of!(LAYERS) as *const u32 } }
#[no_mangle] pub extern "C" fn bins_ptr() -> *const u32 { unsafe { core::ptr::addr_of!(BINS) as *const u32 } }
#[no_mangle] pub extern "C" fn ex_trial_ptr() -> *const i32 { unsafe { core::ptr::addr_of!(EX_TRIAL) as *const i32 } }
#[no_mangle] pub extern "C" fn ex_seq_ptr() -> *const u8 { unsafe { core::ptr::addr_of!(EX_SEQ) as *const u8 } }
#[no_mangle] pub extern "C" fn max_steps() -> u32 { MAX_STEPS as u32 }

/// Breadth-first ball around solved (half-turn metric). Returns its size.
#[no_mangle]
pub extern "C" fn build_ball(radius: u32) -> u32 {
    let r = (radius as usize).min(MAX_RADIUS);
    let mut ball: Ball = HashMap::with_capacity_and_hasher(1 << 16, Default::default());
    let start = identity();
    ball.insert(start, 0);
    let mut frontier = vec![start];
    unsafe { LAYERS = [0; MAX_RADIUS + 1]; LAYERS[0] = 1; RADIUS = r; }
    let mut child = [0u8; N];
    for depth in 1..=r {
        let mut next = Vec::with_capacity(frontier.len() * 14);
        for pos in &frontier {
            for m in 0..MOVES {
                apply(pos, m, &mut child);
                if !ball.contains_key(&child) { ball.insert(child, depth as u8); next.push(child); }
            }
        }
        unsafe { LAYERS[depth] = next.len() as u32; }
        frontier = next;
    }
    let size = ball.len() as u32;
    unsafe { BALL = Some(ball); }
    size
}

fn lookup(s: &[u8; N]) -> i32 {
    unsafe { match (*core::ptr::addr_of!(BALL)).as_ref().and_then(|b| b.get(s)) { Some(d) => *d as i32, None => -1 } }
}

/// Distance of the state in IO, or -1 when it lies outside the ball.
#[no_mangle] pub extern "C" fn dist_io() -> i32 { unsafe { lookup(&*core::ptr::addr_of!(IO)) } }

/// Start an experiment. generator: 0 = uniform, 1 = distinct.
#[no_mangle]
pub extern "C" fn begin(generator: u32, steps: u32, seed: u32, keep: u32, samples: u32) {
    unsafe {
        KEEP = keep == 1;
        let t_seq = &mut *core::ptr::addr_of_mut!(T_SEQ); let t_dist = &mut *core::ptr::addr_of_mut!(T_DIST);
        t_seq.clear(); t_dist.clear();
        if KEEP { t_seq.reserve(samples as usize * steps as usize); t_dist.reserve(samples as usize); }
        RNG = seed; GEN_DISTINCT = generator == 1; STEPS = (steps as usize).min(MAX_STEPS); TRIAL = 0;
        BINS = [0; MAX_RADIUS + 2]; EX_TRIAL = [-1; MAX_RADIUS + 2];
    }
}

/// Run `count` more trials. Returns how many trials are done in total.
#[no_mangle]
pub extern "C" fn run(count: u32) -> u32 {
    unsafe {
        let r = RADIUS;
        let mut seq = [0u8; MAX_STEPS];
        let (mut a, mut b) = ([0u8; N], [0u8; N]);
        for _ in 0..count {
            a = identity();
            let mut prev: i32 = -1;
            for i in 0..STEPS {
                let m = if !GEN_DISTINCT || prev < 0 {
                    (next_f64() * 18.0).floor() as usize
                } else {
                    // the 15 turns on a different face, in table order
                    let k = (next_f64() * 15.0).floor() as usize;
                    let face = (prev as usize) / 3;
                    if k < face * 3 { k } else { k + 3 }
                };
                seq[i] = m as u8; prev = m as i32;
                apply(&a, m, &mut b); core::mem::swap(&mut a, &mut b);
            }
            let d = lookup(&a);
            let bin = if d < 0 { r + 1 } else { d as usize };
            BINS[bin] += 1;
            if EX_TRIAL[bin] < 0 {
                EX_TRIAL[bin] = TRIAL as i32;
                EX_SEQ[bin * MAX_STEPS..bin * MAX_STEPS + STEPS].copy_from_slice(&seq[..STEPS]);
            }
            if KEEP {
                (&mut *core::ptr::addr_of_mut!(T_SEQ)).extend_from_slice(&seq[..STEPS]);
                (&mut *core::ptr::addr_of_mut!(T_DIST)).push(d as i8);
            }
            TRIAL += 1;
        }
        TRIAL
    }
}

#[no_mangle] pub extern "C" fn trials_seq_ptr() -> *const u8 { unsafe { (*core::ptr::addr_of!(T_SEQ)).as_ptr() } }
#[no_mangle] pub extern "C" fn trials_dist_ptr() -> *const i8 { unsafe { (*core::ptr::addr_of!(T_DIST)).as_ptr() } }
