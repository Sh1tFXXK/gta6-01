// SBPD for Solmar Nights 3D: wanted stars, chasing cruisers, on-foot
// cops who bust you, the Air One helicopter with its spotlight, and the
// dispatch board data the HUD renders.

import * as THREE from 'three';
import { S, W } from './state.js';
import { spawnCar, removeCar } from './vehicles.js';
import { collideCircle, nearestRoadPoint } from './city.js';
import { clamp, angDiff, dist2d } from './random.js';
import { sfx } from './audio.js';
import { makePedMesh } from './pedestrians.js';

const UNIT_NAMES = ['KITE-1', 'MARLIN-3', 'TARPON 38', 'TIDE 37', 'PIER 5', 'REEF 12', 'CORAL 9', 'SURGE 4'];
const UNIT_ROLES = ['RAMMING', 'FLANKING', 'CLOSING IN', 'ROADBLOCK', 'SPOTLIGHT', 'PURSUIT', 'CUTTING OFF'];
export const DISPATCH = []; // { name, role, dist } — read by hud.js

let spawnT = 0;
let bustT = 0;

export function updatePolice(dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  // Heat decays when the player is unseen (low speed, on foot, far from cops).
  const nearestCop = S.cops.length ? Math.min(...S.cops.map(c => dist2d(c.x, c.z, px, pz))) : 999;
  if (S.wanted > 0 && nearestCop > 90 && !p.car) {
    S.wantedHeat -= dt * 6;
    if (S.wantedHeat <= 0) { S.wantedHeat = 100; S.wanted = Math.max(0, S.wanted - 1); if (S.wanted === 0) S.banner = { text: 'HEAT LOST', sub: 'The SBPD lost you', t: 2 }; }
  }
  // Spawn cruisers up to the wanted level (max 5).
  spawnT -= dt;
  const wantCops = Math.min(5, S.wanted + (S.wanted >= 3 ? 1 : 0));
  if (S.wanted > 0 && S.cops.filter(c => c.inCar).length < wantCops && spawnT <= 0) {
    spawnT = 2.5;
    const a = Math.random() * Math.PI * 2;
    const sx = clamp(px + Math.sin(a) * 90, -520, 520);
    const sz = clamp(pz + Math.cos(a) * 90, -520, 520);
    const road = nearestRoadPoint(sx, sz);
    const car = spawnCar('police', road.x, road.z, 0, { cop: true, driver: 'cop' });
    S.cops.push({ inCar: true, car, x: road.x, z: road.z, heading: 0, mesh: null, speed: 0 });
  }
  // Cop cars chase: steer at the player's predicted position.
  for (let i = S.cops.length - 1; i >= 0; i--) {
    const cop = S.cops[i];
    if (!cop.inCar) continue;
    const car = cop.car;
    if (car.dead) { removeCar(car); S.cops.splice(i, 1); continue; }
    const lead = S.wanted >= 3 ? 0.55 : 0.25;
    const pvx = p.car ? Math.sin(p.car.heading) * p.car.speed : 0;
    const pvz = p.car ? Math.cos(p.car.heading) * p.car.speed : 0;
    const tx = px + pvx * lead, tz = pz + pvz * lead;
    const want = Math.atan2(tx - car.x, tz - car.z);
    const dh = angDiff(car.heading, want);
    car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const targetSpeed = car.def.top * (S.wanted >= 4 ? 0.95 : 0.8);
    car.speed += clamp(targetSpeed - car.speed, -18 * dt, 16 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const f = collideCircle(nx, nz, car.def.len / 2);
    car.x = f.x; car.z = f.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    cop.x = car.x; cop.z = car.z;
    // Ram the player's car.
    if (p.car && dist2d(car.x, car.z, p.car.x, p.car.z) < 4.5) {
      p.car.damage += 9 * dt * 10;
      p.car.speed *= 0.94;
      car.speed *= 0.8;
      if (Math.random() < dt * 2) sfx.punch();
    }
    // Light bar flash.
    if (car.mesh.userData.lightBar) {
      car.mesh.userData.lightBar.material.color.setHex(Math.floor(performance.now() / 220) % 2 ? 0xff2a2a : 0x2a5aff);
    }
    // On-foot player: cop gets out and busts at close range.
    if (!p.car && dist2d(car.x, car.z, p.x, p.z) < 26 && S.wanted > 0) {
      bustT += dt;
      if (bustT > 1.6) { bustPlayer(); bustT = 0; }
    }
  }
  if (p.car || dist2d(px, pz, px, pz) >= 0) { /* keep bust timer honest */ }
  if (S.cops.every(c => !c.inCar) || S.wanted === 0) bustT = Math.max(0, bustT - dt * 2);

  // Despawn far cops when the heat is gone.
  if (S.wanted === 0) {
    for (let i = S.cops.length - 1; i >= 0; i--) {
      const cop = S.cops[i];
      if (cop.inCar && dist2d(cop.x, cop.z, px, pz) > 220) { removeCar(cop.car); S.cops.splice(i, 1); }
    }
  }

  updateHeli(dt, px, pz);
  updateDispatch(px, pz);
}

export function bustPlayer() {
  S.mode = 'busted';
  S.money = Math.max(0, S.money - 150);
  S.wanted = 0; S.wantedHeat = 0;
  sfx.bust();
}

export function addWanted(n) {
  S.wanted = clamp(S.wanted + n, 0, 5);
  S.wantedHeat = 100;
}

export function updateHeli(dt, px, pz) {
  if (S.wanted >= 3 && !W.heli) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 1.8, 2.4), new THREE.MeshLambertMaterial({ color: 0x1d2f4a }));
    body.position.y = 0; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0x1d2f4a }));
    tail.position.set(-4, 0.3, 0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.3; g.add(rotor);
    g.userData.rotor = rotor;
    const light = new THREE.SpotLight(0xfff2c0, 900, 120, 0.32, 0.45, 1.2);
    light.position.set(0, -1, 0);
    g.add(light);
    g.add(light.target);
    W.heliLight = light;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, 55, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
    );
    W.heliCone = cone;
    W.scene.add(cone);
    g.position.set(px + 30, 55, pz - 20);
    W.scene.add(g);
    W.heli = g;
    S.banner = { text: 'AIR ONE DEPLOYED', sub: 'SBPD helicopter overhead', t: 3 };
  } else if (S.wanted < 3 && W.heli) {
    W.scene.remove(W.heli);
    if (W.heliCone) W.scene.remove(W.heliCone);
    W.heli = null; W.heliLight = null; W.heliCone = null;
  }
  if (W.heli) {
    const t = performance.now() / 1000;
    // Hover ahead of the player so the helicopter reads in the chase frame.
    const p = S.player;
    const fwd = p.car ? p.car.heading : p.heading;
    const hx = px + Math.sin(fwd) * 80 + Math.sin(t * 0.5) * 10;
    const hz = pz + Math.cos(fwd) * 80 + Math.cos(t * 0.4) * 10;
    W.heli.position.x += (hx - W.heli.position.x) * Math.min(1, dt * 0.8);
    W.heli.position.z += (hz - W.heli.position.z) * Math.min(1, dt * 0.8);
    W.heli.position.y = 42 + Math.sin(t * 0.8) * 2;
    W.heli.rotation.y = Math.atan2(px - W.heli.position.x, pz - W.heli.position.z);
    W.heli.userData.rotor.rotation.y = t * 22;
  }
}

function updateDispatch(px, pz) {
  DISPATCH.length = 0;
  const units = [];
  for (const cop of S.cops) {
    if (cop.inCar) units.push({ x: cop.x, z: cop.z });
  }
  if (W.heli) units.push({ x: W.heli.position.x, z: W.heli.position.z, air: true });
  units.forEach((u, i) => {
    DISPATCH.push({
      name: u.air ? 'AIR ONE' : UNIT_NAMES[i % UNIT_NAMES.length],
      role: u.air ? 'SPOTLIGHT' : UNIT_ROLES[(i + Math.floor(S.time / 6)) % UNIT_ROLES.length],
      dist: Math.round(dist2d(u.x, u.z, px, pz)),
    });
  });
}
