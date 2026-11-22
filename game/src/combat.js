// Combat for Solmar Nights 3D: mouse-aim shooting with raycasts,
// drive-by fire, punching, Rust Viper gang enemies and tracers.

import * as THREE from 'three';
import { S, W } from './state.js';
import { WEAPONS } from './config.js';
import { mouse, hit } from './input.js';
import { dist2d, clamp } from './random.js';
import { sfx } from './audio.js';
import { scarePeds, makePedMesh } from './pedestrians.js';
import { addWanted } from './police.js';
import { spawnExplosion } from './vehicles.js';

let shootCd = 0;

export function spawnGang(x, z, n = 1) {
  for (let i = 0; i < n; i++) {
    const mesh = makePedMesh('walker', 0x3a2a2a);
    const gx = x + (Math.random() - 0.5) * 12, gz = z + (Math.random() - 0.5) * 12;
    mesh.position.set(gx, 0, gz);
    W.scene.add(mesh);
    S.gang.push({ mesh, x: gx, z: gz, hp: 100, heading: 0, shootT: 1 + Math.random(), dead: false });
  }
}

export function updateCombat(dt) {
  shootCd -= dt;
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  const w = WEAPONS[S.weapon];
  // Switch weapons: 1-7 keys.
  for (let i = 0; i < WEAPONS.length; i++) {
    if (hit('Digit' + (i + 1))) { S.weapon = i; sfx.click(); }
  }
  // Fire: mouse click (or Space on foot for fists).
  const wantFire = mouse.clicked || (w.auto && mouse.down) || (w.id === 'fists' && hit('Space'));
  if (wantFire && shootCd <= 0 && S.mode === 'play') {
    if (w.id === 'fists' || w.id === 'bat') {
      shootCd = w.rate;
      sfx.punch();
      meleeHit(w);
    } else {
      const ammoKey = w.id;
      if ((S.ammo[ammoKey] || 0) <= 0) { shootCd = 0.3; sfx.fail(); return; }
      shootCd = w.rate;
      S.ammo[ammoKey]--;
      fireShot(w, px, pz);
    }
  }
  // Gang enemies: close in and shoot back.
  for (let i = S.gang.length - 1; i >= 0; i--) {
    const g = S.gang[i];
    if (g.dead) continue;
    const d = dist2d(g.x, g.z, px, pz);
    const want = Math.atan2(px - g.x, pz - g.z);
    g.heading = want;
    if (d > 14) {
      g.x += Math.sin(want) * 3.2 * dt;
      g.z += Math.cos(want) * 3.2 * dt;
    }
    g.shootT -= dt;
    if (g.shootT <= 0 && d < 55) {
      g.shootT = 1.6 + Math.random();
      gangShot(g, px, pz);
    }
    g.mesh.position.set(g.x, 0, g.z);
    g.mesh.rotation.y = g.heading;
    if (g.hp <= 0) {
      g.dead = true;
      W.scene.remove(g.mesh);
      S.gang.splice(i, 1);
      S.stats.vipersDown++;
      S.money += 25;
      addWanted(0); // killing gang members is not a police crime here
    }
  }
}

function meleeHit(w) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
  for (const g of S.gang) {
    const dx = g.x - px, dz = g.z - pz;
    if (Math.hypot(dx, dz) < w.range && dx * hx + dz * hz > 0) g.hp -= w.dmg;
  }
}

function fireShot(w, px, pz) {
  // Shots travel horizontally from the player's gun toward where the
  // camera faces: a camera ray would dive into the ground past the player,
  // so the crosshair's horizontal bearing is what the bullet follows.
  const dir = new THREE.Vector3(Math.sin(S.camYaw + Math.PI), 0, Math.cos(S.camYaw + Math.PI)).normalize();
  const origin = new THREE.Vector3(px, 1.4, pz);
  sfx.shoot();
  scarePeds(px, pz, 45);
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const d = dir.clone();
    d.x += (Math.random() - 0.5) * 0.02;
    d.z += (Math.random() - 0.5) * 0.02;
    d.normalize();
    const o = origin.clone();
    // Hit test against gang, peds, cars (sphere approximations).
    let bestT = w.range, bestHit = null, bestKind = null;
    for (const g of S.gang) {
      const t = raySphere(o, d, g.x, 1.2, g.z, 1.4);
      if (t && t < bestT) { bestT = t; bestHit = g; bestKind = 'gang'; }
    }
    for (const car of S.cars) {
      if (car.dead) continue;
      const t = raySphere(o, d, car.x, 1.0, car.z, car.def.len / 2 + 0.5);
      if (t && t < bestT) { bestT = t; bestHit = car; bestKind = 'car'; }
    }
    const end = o.clone().addScaledVector(d, bestT);
    addTracer(o, end);
    if (bestKind === 'gang') bestHit.hp -= w.dmg;
    if (bestKind === 'car') {
      bestHit.damage += w.dmg / 2;
      if (bestHit.driver === 'player') S.health -= 2;
      if (bestHit.type === 'police') addWanted(1);
    }
    if (!bestHit) {
      // Stray shots in public draw heat.
      if (Math.random() < 0.25) addWanted(1);
    }
  }
  if (S.player.car) {
    // Drive-by: shooting from a car is loud.
    addWanted(0);
  }
}

function gangShot(g, px, pz) {
  const from = new THREE.Vector3(g.x, 1.4, g.z);
  const to = new THREE.Vector3(px, 1.2, pz);
  addTracer(from, to);
  sfx.shoot();
  const d = dist2d(g.x, g.z, px, pz);
  if (Math.random() < clamp(0.5 - d / 160, 0.08, 0.5)) {
    damagePlayer(8 + Math.random() * 8);
  }
}

export function damagePlayer(n) {
  if (S.armor > 0) {
    const absorbed = Math.min(S.armor, n * 0.6);
    S.armor -= absorbed; n -= absorbed;
  }
  S.health -= n;
  if (S.health <= 0) {
    S.health = 0;
    S.mode = 'wasted';
    sfx.fail();
  }
}

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

function addTracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9 }));
  W.scene.add(line);
  W.tracers.push({ line, t: 0.09 });
}

export function updateTracers(dt) {
  for (let i = W.tracers.length - 1; i >= 0; i--) {
    const tr = W.tracers[i];
    tr.t -= dt;
    if (tr.t <= 0) { W.scene.remove(tr.line); W.tracers.splice(i, 1); }
  }
}
