// render3d · one shared WebGL renderer paints every cube on the page (main stage, proof lanes, tree previews)
// into its own 2D canvas. Rounded black cubies, glossy stickers, soft studio light. Falls back to the 2D view if WebGL is missing.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rotate } from './model.js';

const STICKER = { U: '#f7f7f5', D: '#ffd21f', F: '#16b86a', B: '#1f6fe5', R: '#e5243b', L: '#ff7a1a' };
const VIEWS = [.61, 2.18, 3.72, 5.27];

let renderer, scene, camera, cubies, bodyGeo, stickerGeo, bodyMat, stickerMats, ok = false;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .55;
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(4, 7, 5); scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8e0, .55));
  const rim = new THREE.DirectionalLight(0xb4a0d6, .9); rim.position.set(-5, 2, -6); scene.add(rim);   // violet rim so the black body reads on a dark page
  camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
  bodyGeo = new RoundedBoxGeometry(.96, .96, .96, 4, .12);
  const s = new THREE.Shape(), h = .41, r = .1;
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  stickerGeo = new THREE.ShapeGeometry(s, 6);
  bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x111114, roughness: .38, metalness: 0, clearcoat: .6, clearcoatRoughness: .3 });
  stickerMats = Object.fromEntries(Object.entries(STICKER).map(([f, c]) => [f, new THREE.MeshPhysicalMaterial({ color: c, roughness: .22, clearcoat: 1, clearcoatRoughness: .08, side: THREE.DoubleSide })]));
  cubies = new THREE.Group(); scene.add(cubies);
  ok = true;
} catch { ok = false; }
export const ready = () => ok;

const Z = new THREE.Vector3(0, 0, 1);
const key3 = p => p.map(v => v.toFixed(3)).join(',');
// mid-turn: the residual angle (mod 90°) of the turning layer, read from any sticker normal in it
function residual(conf, hl) {
  if (!hl) return 0;
  for (const st of conf) { if (Math.abs(st.position[hl.axis] - hl.sign) > .01 || Math.abs(st.normal[hl.axis]) > .5) continue;
    const a = (hl.axis + 1) % 3, b = (hl.axis + 2) % 3, ang = Math.atan2(st.normal[b], st.normal[a]);
    const snap = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2); return ang - snap; }
  return 0;
}
const toV = ([x, y, z]) => new THREE.Vector3(x, y, z);

export function draw3d(canvas, conf, hl, view = 0, zoom = 1) {
  if (!ok) return false;
  if (!canvas._hd) { const k = Math.min(2, devicePixelRatio || 1) >= 1.5 ? 2 : 1.5; canvas.width = Math.round(canvas.width * k); canvas.height = Math.round(canvas.height * k); canvas._hd = 1; }
  const W = canvas.width, H = canvas.height;
  renderer.setSize(W, H, false); camera.aspect = W / H;
  // camera: same angles as the old ring view (yaw from VIEWS, pitch .56)
  const yaw = typeof view === 'object' ? view.yaw : (VIEWS[view] || VIEWS[0]), pitch = typeof view === 'object' ? (view.pitch ?? .56) : .56, dist = 13.2 / (1 + (zoom - 1) * .18) * Math.max(1, (H / W) * 1.1);
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  // rebuild cubies from sticker state
  cubies.clear();
  const theta = residual(conf, hl), groups = new Map();
  for (const st of conf) { const k = key3(st.position); if (!groups.has(k)) groups.set(k, { pos: st.position, st: [] }); groups.get(k).st.push(st); }
  for (const { pos, st } of groups.values()) {
    const g = new THREE.Group(); g.position.copy(toV(pos));
    const moving = hl && Math.abs(pos[hl.axis] - hl.sign) < .01 && theta;
    const t = moving ? theta : 0;
    // build in the snapped frame, then turn the whole cubie by the residual angle around the layer axis
    const inner = new THREE.Group(); g.add(inner);
    inner.add(new THREE.Mesh(bodyGeo, bodyMat));
    for (const s of st) {
      const n = t ? rotate(s.normal, hl.axis, -t, true) : s.normal.map(Math.round);
      const m = new THREE.Mesh(stickerGeo, stickerMats[s.face]); const nv = toV(n);
      m.quaternion.setFromUnitVectors(Z, nv); m.position.copy(nv.multiplyScalar(.483)); inner.add(m);
    }
    if (t) { const e = [0, 0, 0]; e[hl.axis] = 1; inner.setRotationFromAxisAngle(toV(e), t); }
    cubies.add(g);
  }
  renderer.render(scene, camera);
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, W, H); ctx.drawImage(renderer.domElement, 0, 0, W, H);
  return true;
}
