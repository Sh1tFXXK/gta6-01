// Story missions 6–8 for Solmar Nights 3D: the timed delivery run,
// Vera's escort (her car drives a route while Vipers ambush it),
// and the vault job. Registers its stages into the mission engine.

import { S, W } from './state.js';
import { MISSION_STAGES, nextStage, failMission } from './missions.js';
import { dist2d } from './random.js';
import { spawnCar, removeCar } from './vehicles.js';
import { spawnGang } from './combat.js';
import { addWanted } from './police.js';
import { setWaypoint } from './render.js';
import { sfx } from './audio.js';

MISSION_STAGES[6] = [ // The Last Delivery — 3 timed drops, cops already on you
  { type: 'goto', x: -150, z: -200, r: 10, text: 'Drop 1/3 — Old Market', timer: 150 },
  { type: 'goto', x: 350, z: 200, r: 10, text: 'Drop 2/3 — Kumala Strand', timer: 150 },
  { type: 'goto', x: 50, z: 400, r: 10, text: 'Drop 3/3 — North Hills', timer: 150 },
];

MISSION_STAGES[7] = [ // Vera's Escort
  { type: 'escort', stop: 0, x: 150, z: -100, text: 'Escort Vera — stay close to her car' },
  { type: 'escort', stop: 1, x: -350, z: 300, text: 'Escort Vera — the Pier, Vipers incoming' },
  { type: 'escort', stop: 2, x: 450, z: 400, text: 'Escort Vera — final stop, the Safehouse' },
];

MISSION_STAGES[8] = [ // The Vault Job
  { type: 'goto', x: -50, z: -100, r: 10, text: 'Reach the vault on Old Market', timer: 150 },
  { type: 'crack', x: -50, z: -100, secs: 18, text: 'Crack the vault — 18 seconds' },
  { type: 'escape', text: 'Drop to 1 star, then reach the Safehouse' },
];

// Vera's car for mission 7, driven by the route logic below.
let veraCar = null;
const VERA_ROUTE = [
  { x: 150, z: -100 }, // hotel
  { x: -350, z: 300 }, // pier
  { x: 450, z: 400 },  // safehouse
];
let ambushed = [false, false, false];

export function updateMissions2(dt) {
  const m = S.mission;
  if (!m || m.id !== 7) {
    if (veraCar) { removeCar(veraCar); veraCar = null; }
    return;
  }
  const st = m.stages[m.stage];
  if (!st || st.type !== 'escort') return;
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  if (!veraCar) {
    veraCar = spawnCar('sports', 140, -140, 0, { driver: 'vera' });
    veraCar.mesh.userData.def = veraCar.def;
    ambushed = [false, false, false];
    S.dialogue = { name: 'VERA SOLANO', line: 'Stay close, Rook. If my car takes a bullet, this whole night is wasted.', t: 6 };
  }
  const target = VERA_ROUTE[st.stop];
  const d = dist2d(veraCar.x, veraCar.z, target.x, target.z);
  // Vera drives toward her stop at a cruising speed.
  const want = Math.atan2(target.x - veraCar.x, target.z - veraCar.z);
  let dh = want - veraCar.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  veraCar.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
  veraCar.speed += (d > 8 ? 16 - veraCar.speed : 0 - veraCar.speed) * Math.min(1, dt * 0.8);
  veraCar.x += Math.sin(veraCar.heading) * veraCar.speed * dt;
  veraCar.z += Math.cos(veraCar.heading) * veraCar.speed * dt;
  veraCar.mesh.position.set(veraCar.x, 0, veraCar.z);
  veraCar.mesh.rotation.y = veraCar.heading;
  setWaypoint(veraCar.x, veraCar.z, true);
  // Ambush at each stop: Vipers spawn once when Vera arrives.
  if (d < 14 && !ambushed[st.stop]) {
    ambushed[st.stop] = true;
    spawnGang(veraCar.x + 20, veraCar.z + 10, 3);
    addWanted(1);
    S.dialogue = { name: 'VERA SOLANO', line: 'Vipers! Get them off me!', t: 4 };
    sfx.horn();
  }
  // Fail if her car is destroyed or the player strays too far.
  if (veraCar.damage >= 100 || veraCar.dead) {
    removeCar(veraCar); veraCar = null;
    failMission("Vera's car was destroyed.");
    return;
  }
  const pd = dist2d(px, pz, veraCar.x, veraCar.z);
  if (pd > 70) {
    st.text = 'Too far from Vera — get back to her car!';
  } else {
    st.text = st.stop === 0 ? 'Escort Vera — stay close to her car'
      : st.stop === 1 ? 'Escort Vera — the Pier, Vipers incoming'
      : 'Escort Vera — final stop, the Safehouse';
  }
  if (d < 10 && pd < 40) {
    if (st.stop === 2) {
      removeCar(veraCar); veraCar = null;
      nextStage(); // completes mission 7 via the engine (stage past the end)
    } else {
      nextStage();
    }
  }
}

export function clearVera() {
  if (veraCar) { removeCar(veraCar); veraCar = null; }
}
