// Checkpoint street races for Solmar Nights 3D: 7 routes, rival cars,
// countdown starts, best times, and a 1.5x night bonus.

import * as THREE from 'three';
import { S, W } from './state.js';
import { RACE_DEFS } from './config.js';
import { dist2d, fmtTime } from './random.js';
import { sfx } from './audio.js';
import { spawnCar, removeCar } from './vehicles.js';
import { addRespect } from './state.js';

let ringMeshes = [];
let rivals = [];

export function racePadNear(x, z) {
  for (const def of RACE_DEFS) {
    const [px, pz] = def.pads[0];
    if (dist2d(x, z, px, pz) < 10) return def;
  }
  return null;
}

export function startRace(id) {
  const def = RACE_DEFS.find(r => r.id === id);
  if (!def || S.race || !S.player.car) return false;
  S.race = { id, cp: 1, t: 0, count: 3.2, def }; // cp 1: the start pad is already behind the player
  S.banner = { text: def.name, sub: 'Get ready…', t: 2 };
  // Rival cars line up beside the player.
  const [px, pz] = def.pads[0];
  for (let i = 0; i < 2; i++) {
    const r = spawnCar(i ? 'muscle' : 'comet', px - 6 - i * 5, pz + 6, 0, { driver: 'rival' });
    r.route = def.pads.map(([x, z]) => ({ x, z }));
    r.routeI = 0;
    rivals.push(r);
  }
  showRings(def);
  return true;
}

function showRings(def) {
  clearRings();
  const geo = new THREE.TorusGeometry(7, 0.5, 8, 28);
  for (const [x, z] of def.pads) {
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 2.2, z);
    W.scene.add(ring);
    ringMeshes.push(ring);
  }
}

function clearRings() {
  for (const r of ringMeshes) W.scene.remove(r);
  ringMeshes = [];
}

function clearRivals() {
  for (const r of rivals) removeCar(r);
  rivals = [];
}

export function updateRaces(dt) {
  const r = S.race;
  if (!r) return;
  const p = S.player;
  if (!p.car) { cancelRace('You left the car.'); return; }
  if (r.count > 0) {
    r.count -= dt;
    const n = Math.ceil(r.count);
    S.raceCount = n > 0 ? String(n) : 'GO!';
    if (r.count <= 0) sfx.horn();
    return;
  }
  S.raceCount = '';
  r.t += dt;
  const cp = r.def.pads[r.cp];
  // Highlight the next checkpoint.
  ringMeshes.forEach((ring, i) => {
    ring.material.opacity = i === r.cp ? 0.95 : 0.25;
    ring.rotation.z += dt * (i === r.cp ? 1.5 : 0.2);
  });
  const d = dist2d(p.car.x, p.car.z, cp[0], cp[1]);
  if (d < 9) {
    r.cp++;
    sfx.pickup();
    if (r.cp >= r.def.pads.length) { finishRace(); return; }
  }
  // Rivals follow the checkpoint route.
  for (const rv of rivals) {
    if (rv.dead) continue;
    const target = rv.route[rv.routeI % rv.route.length];
    const td = dist2d(rv.x, rv.z, target.x, target.z);
    if (td < 8) { rv.routeI++; continue; }
    const want = Math.atan2(target.x - rv.x, target.z - rv.z);
    let dh = want - rv.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    rv.heading += Math.max(-1.8 * dt, Math.min(1.8 * dt, dh));
    rv.speed += (rv.def.top * 0.62 - rv.speed) * Math.min(1, dt);
    rv.x += Math.sin(rv.heading) * rv.speed * dt;
    rv.z += Math.cos(rv.heading) * rv.speed * dt;
    rv.mesh.position.set(rv.x, 0, rv.z);
    rv.mesh.rotation.y = rv.heading;
  }
  // Rival taunts.
  if (Math.random() < dt * 0.06) {
    const taunts = ['Too slow, Rook!', 'My grandma drives faster!', 'The Bay is mine tonight!', 'Eat my dust!'];
    S.dialogue = { name: 'RIVAL', line: taunts[Math.floor(Math.random() * taunts.length)], t: 3 };
  }
}

function finishRace() {
  const r = S.race;
  const isNight = S.clockMin >= 20 * 60 || S.clockMin < 6 * 60;
  const rivalBest = r.t + 4 + Math.random() * 6; // rivals are beatable but not free
  const won = r.t < rivalBest;
  const base = won ? 350 : 80;
  const prize = Math.round(base * (isNight ? 1.5 : 1));
  S.money += prize;
  addRespect(prize);
  const prev = S.raceBest[r.id];
  if (!prev || r.t < prev) S.raceBest[r.id] = r.t;
  if (won) S.stats.racesWon++;
  S.banner = {
    text: won ? 'RACE WON — ' + r.def.name : 'RACE DONE — ' + r.def.name,
    sub: `${fmtTime(r.t)}  •  +$${prize}${isNight ? ' (night bonus x1.5)' : ''}`,
    t: 3.5,
  };
  sfx.mission();
  clearRings(); clearRivals();
  S.race = null;
  S.raceCount = '';
}

function cancelRace(reason) {
  S.banner = { text: 'RACE OVER', sub: reason, t: 2.5 };
  clearRings(); clearRivals();
  S.race = null;
  S.raceCount = '';
}

export function tryStartRaceAtPad() {
  if (S.race || !S.player.car) return;
  const def = racePadNear(S.player.car.x, S.player.car.z);
  if (def) startRace(def.id);
}
