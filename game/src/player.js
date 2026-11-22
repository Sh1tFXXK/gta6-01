// Rook Marlow on foot: third-person movement, sprint stamina,
// stealing cars, and the player character mesh.

import * as THREE from 'three';
import { S, W } from './state.js';
import { collideCircle } from './city.js';
import { clamp, angDiff } from './random.js';
import { moveInput } from './input.js';
import { nearestCar } from './vehicles.js';
import { sfx } from './audio.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a4a6a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0xd84a3a }));
  cap.position.y = 1.92; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pants);
  legL.position.set(-0.16, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), jacket);
  armL.position.set(-0.42, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export function initPlayer() {
  W.playerMesh = makePlayerMesh();
  W.playerMesh.position.set(S.player.x, 0, S.player.z);
  W.scene.add(W.playerMesh);
}

export function updatePlayer(dt) {
  const p = S.player;
  if (p.car) return; // driving is handled by vehicles.js
  const input = moveInput();
  const sprinting = (window.__shift || false) && S.stamina > 0 && (input.f !== 0 || input.s !== 0);
  const speed = sprinting ? 9.5 : 5.2;
  if (sprinting) {
    S.stamina = Math.max(0, S.stamina - 22 * dt);
    S.stats.sprintM += speed * dt;
  } else {
    S.stamina = Math.min(100, S.stamina + 14 * dt);
  }
  // Movement is relative to the camera yaw.
  const cy = S.camYaw;
  const fx = -Math.sin(cy), fz = -Math.cos(cy);
  const sx = -Math.cos(cy), sz = Math.sin(cy);
  let mx = fx * input.f + sx * input.s;
  let mz = fz * input.f + sz * input.s;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    const want = Math.atan2(mx, mz);
    p.heading += angDiff(p.heading, want) * Math.min(1, dt * 12);
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    const fixed = collideCircle(nx, nz, 0.6);
    p.x = fixed.x; p.z = fixed.z;
    p.speed = speed;
    // Walk-cycle swing.
    const t = performance.now() / 1000 * (sprinting ? 11 : 7);
    W.playerMesh.userData.legL.rotation.x = Math.sin(t) * 0.6;
    W.playerMesh.userData.legR.rotation.x = -Math.sin(t) * 0.6;
    W.playerMesh.userData.armL.rotation.x = -Math.sin(t) * 0.5;
    W.playerMesh.userData.armR.rotation.x = Math.sin(t) * 0.5;
  } else {
    p.speed = 0;
    W.playerMesh.userData.legL.rotation.x *= 0.8;
    W.playerMesh.userData.legR.rotation.x *= 0.8;
    W.playerMesh.userData.armL.rotation.x *= 0.8;
    W.playerMesh.userData.armR.rotation.x *= 0.8;
  }
  W.playerMesh.position.set(p.x, 0, p.z);
  W.playerMesh.rotation.y = p.heading;
}

export function tryEnterCar() {
  const p = S.player;
  if (p.car) {
    // Exit the car.
    const car = p.car;
    car.driver = null;
    p.car = null; p.onFoot = true;
    p.x = car.x + Math.cos(car.heading) * 3; p.z = car.z - Math.sin(car.heading) * 3;
    p.heading = car.heading;
    W.playerMesh.visible = true;
    return;
  }
  const car = nearestCar(p.x, p.z, 6);
  if (!car) return;
  const wasParked = car.parked;
  car.driver = 'player';
  car.parked = false;
  p.car = car; p.onFoot = false;
  W.playerMesh.visible = false;
  if (wasParked || car.type === 'police') {
    // Stealing a parked car (or a cop car) draws heat.
    S.wanted = Math.max(S.wanted, 1);
    S.wantedHeat = 100;
    S.stats.carsStolen++;
  }
  sfx.click();
}
