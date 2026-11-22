// Pedestrians for Solmar Nights 3D: walkers, joggers, tourists and
// vendors who idle, chat, and flee when shots go off.

import * as THREE from 'three';
import { S, W } from './state.js';
import { mulberry32, pick, dist2d } from './random.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xd8d8d8, 0xe8a03a, 0x4a8a5a, 0x8a4a6a, 0x3a6a8a, 0xc25a4a, 0x7a5a9a];
const KINDS = ['walker', 'jogger', 'tourist', 'vendor'];

export function makePedMesh(kind, shirtColor) {
  const g = new THREE.Group();
  const skinTones = [0xc98a5e, 0x8a5a3a, 0xe8b88a];
  const skin = new THREE.MeshLambertMaterial({ color: skinTones[Math.floor(Math.random() * skinTones.length)] });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2c34 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), shirt);
  body.position.y = 1.0; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.65; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legL.position.set(-0.14, 0.32, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  if (kind === 'tourist') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xe8d8a0 }));
    hat.position.y = 1.85; g.add(hat);
  }
  if (kind === 'vendor') {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x8a5a2a }));
    tray.position.set(0, 1.15, 0.35); g.add(tray);
  }
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function scatterPeds() {
  const rng = mulberry32(S.seed + 21);
  for (let i = 0; i < 22; i++) {
    const kind = KINDS[Math.floor(rng() * 3)]; // walkers, joggers, tourists
    const x = (rng() * 2 - 1) * 480, z = (rng() * 2 - 1) * 480;
    const mesh = makePedMesh(kind, SHIRTS[Math.floor(rng() * SHIRTS.length)]);
    mesh.position.set(x, 0, z);
    W.scene.add(mesh);
    S.peds.push({
      kind, mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: kind === 'jogger' ? 3.4 : 1.4 + rng(),
      idleT: rng() * 4, chat: rng() < 0.25, fleeT: 0, walkT: 0,
    });
  }
}

export function updatePeds(dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  for (const ped of S.peds) {
    const d = dist2d(ped.x, ped.z, px, pz);
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.x - px, ped.z - pz);
      ped.heading = away;
      const nx = ped.x + Math.sin(away) * 6 * dt;
      const nz = ped.z + Math.cos(away) * 6 * dt;
      const f = collideCircle(nx, nz, 0.5);
      ped.x = f.x; ped.z = f.z;
    } else if (ped.idleT > 0) {
      ped.idleT -= dt;
      if (ped.idleT <= 0) ped.heading = Math.random() * Math.PI * 2;
    } else {
      ped.walkT += dt;
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      const f = collideCircle(nx, nz, 0.5);
      if (f.x !== nx || f.z !== nz) ped.heading += Math.PI / 2 + Math.random();
      ped.x = f.x; ped.z = f.z;
      if (Math.random() < dt * 0.05) ped.idleT = 2 + Math.random() * 4;
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    const swing = ped.fleeT > 0 ? 11 : 6;
    ped.mesh.userData.legL.rotation.x = Math.sin(ped.walkT * swing) * 0.55;
    ped.mesh.userData.legR.rotation.x = -Math.sin(ped.walkT * swing) * 0.55;
  }
}

export function scarePeds(x, z, radius = 40) {
  for (const ped of S.peds) {
    if (dist2d(ped.x, ped.z, x, z) < radius) ped.fleeT = 2.5 + Math.random() * 2;
  }
}
