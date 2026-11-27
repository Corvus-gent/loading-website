// C → WebAssembly optimal solver (≤ 8 moves). Source: /solver/solver.c (freestanding C, clang --target=wasm32).
import { MOVE_PERM } from './lab.js';
import { moves } from './model.js';
export async function loadSolver(source = new URL('./solver.wasm', import.meta.url)) {
  const bytes = source instanceof Uint8Array ? source : await (await fetch(source)).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {}); const x = instance.exports;
  const mem = () => new Uint8Array(x.memory.buffer);
  moves.forEach((m, i) => mem().set(MOVE_PERM[m], x.perm_ptr() + i * 54));
  return {
    build: () => x.build(),
    /** pos: Uint8Array/Array(54) as in lab.js applySequence. returns ['R', "U'", …], [] if solved, or null if > 8 moves */
    solve(pos) { mem().set(pos, x.io_ptr()); const n = x.solve(); if (n < 0) return null; return Array.from(mem().subarray(x.path_ptr(), x.path_ptr() + n), i => moves[i]); },
  };
}
