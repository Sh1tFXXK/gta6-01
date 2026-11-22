// Street life for Solmar Nights 3D: stash cash drops, wrench / coffee /
// briefcase pickups, and food vendors who sell a stamina coffee.

import * as THREE from 'three';
import { S, W } from './state.js';
import { GARAGE } from './config.js';
import { dist2d } from './random.js';
import { sfx } from './audio.js';

let pickupMeshes = [];
let stashMeshes = [];
let vendorMeshes = [];

const PICKUP_COLORS = { wrench: 0x8a8f96, coffee: 0x6a4a2a, briefcase: 0xd8b93a };

export function buildStreetlife() {
  clearStreetlife();
  const geo = new THREE.OctahedronGeometry(1.1);
  for (const pk of S.pickups) {
    if (pk.taken) continue;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PICKUP_COLORS[pk.kind] || 0xffffff }));
    m.position.set(pk.x, 1.4, pk.z);
    W.scene.add(m);
    pickupMeshes.push({ mesh: m, pk });
  }
  const stashGeo = new THREE.BoxGeometry(1.4, 1.0, 1.0);
  for (const st of S.stash) {
    if (st.taken) continue;
    const m = new THREE.Mesh(stashGeo, new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    m.position.set(st.x, 1.0, st.z);
    W.scene.add(m);
    stashMeshes.push({ mesh: m, st });
  }
  const vendorGeo = new THREE.CylinderGeometry(1.6, 1.8, 2.6, 8);
  for (const v of S.vendors) {
    const m = new THREE.Mesh(vendorGeo, new THREE.MeshLambertMaterial({ color: 0xd85a3a }));
    m.position.set(v.x, 1.3, v.z);
    W.scene.add(m);
    vendorMeshes.push({ mesh: m, v });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 0.2), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    sign.position.set(v.x, 3.2, v.z);
    W.scene.add(sign);
    vendorMeshes.push({ mesh: sign, v });
  }
}

function clearStreetlife() {
  for (const p of pickupMeshes) W.scene.remove(p.mesh);
  for (const p of stashMeshes) W.scene.remove(p.mesh);
  for (const p of vendorMeshes) W.scene.remove(p.mesh);
  pickupMeshes = []; stashMeshes = []; vendorMeshes = [];
}

export function updateStreetlife(dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  const t = performance.now() / 1000;
  for (const { mesh, pk } of pickupMeshes) {
    mesh.rotation.y += dt * 2;
    mesh.position.y = 1.4 + Math.sin(t * 3 + pk.x) * 0.25;
    if (!pk.taken && dist2d(px, pz, pk.x, pk.z) < 3.5) {
      pk.taken = true;
      mesh.visible = false;
      if (pk.kind === 'wrench' && p.car) { p.car.damage = Math.max(0, p.car.damage - 50); S.banner = { text: 'WRENCH', sub: 'Car patched up', t: 2 }; }
      if (pk.kind === 'coffee') { S.stamina = 100; S.banner = { text: 'COFFEE', sub: 'Stamina full', t: 2 }; }
      if (pk.kind === 'briefcase') { S.money += 60; S.banner = { text: 'FOUND CASH', sub: '+$60', t: 2 }; sfx.cash(); }
      sfx.pickup();
    }
  }
  for (const { mesh, st } of stashMeshes) {
    mesh.rotation.y += dt * 1.5;
    if (!st.taken && dist2d(px, pz, st.x, st.z) < 3.5) {
      st.taken = true;
      mesh.visible = false;
      S.money += 100;
      S.banner = { text: 'STASH FOUND', sub: '+$100', t: 2.5 };
      sfx.cash();
    }
  }
  // Garage: drive in and press G to repair for $120.
  const gd = dist2d(px, pz, GARAGE.x, GARAGE.z);
  S.garageNear = gd < GARAGE.r;
  if (S.garageNear && p.car && p.car.damage > 0 && S.money >= GARAGE.price) {
    S.objective = `At ${GARAGE.name} — press G to repair ($${GARAGE.price})`;
  }
}

export function tryGarageRepair() {
  const p = S.player;
  if (!S.garageNear || !p.car) return;
  if (p.car.damage <= 0) { S.banner = { text: "MACK'S GARAGE", sub: 'She\'s already clean', t: 2 }; return; }
  if (S.money < GARAGE.price) { S.banner = { text: "MACK'S GARAGE", sub: 'Not enough cash — $120', t: 2 }; sfx.fail(); return; }
  S.money -= GARAGE.price;
  p.car.damage = 0;
  S.dialogue = { name: 'MACK', line: 'You break it, I bill it. Hundred and twenty, and she\'ll run like new.', t: 5 };
  sfx.mission();
}

export function tryBuyCoffee() {
  const p = S.player;
  if (p.car) return;
  for (const v of S.vendors) {
    if (dist2d(p.x, p.z, v.x, v.z) < 5) {
      if (S.money < 5) { sfx.fail(); return; }
      S.money -= 5;
      S.stamina = 100;
      S.banner = { text: 'COFFEE — $5', sub: 'Stamina full', t: 2 };
      sfx.pickup();
      return;
    }
  }
}
