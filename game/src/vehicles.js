// Cars for Solmar Nights 3D: box-built bodies, arcade driving physics,
// parked stealables, traffic AI that follows the street grid.

import * as THREE from 'three';
import { S, W } from './state.js';
import { VEHICLES } from './config.js';
import { collideCircle, onRoad, nearestRoadPoint, CITY } from './city.js';
import { mulberry32, pick, clamp, angDiff, dist2d } from './random.js';
import { sfx } from './audio.js';

const carGeos = {};
function geo(key, w, h, d) {
  if (!carGeos[key]) carGeos[key] = new THREE.BoxGeometry(w, h, d);
  return carGeos[key];
}

export function makeCarMesh(type) {
  const def = VEHICLES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
  const body = new THREE.Mesh(geo('b' + type, def.wid, 0.85, def.len), bodyMat);
  body.position.y = 0.75; g.add(body);
  const cabin = new THREE.Mesh(geo('c' + type, def.wid * 0.82, 0.7, def.len * 0.45), glassMat);
  cabin.position.set(0, 1.45, -def.len * 0.05); g.add(cabin);
  const wheelGeo = geo('wheel', 0.35, 0.7, 0.7);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wy = 0.35, wx = def.wid / 2 - 0.1, wz = def.len / 2 - 0.9;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, wy, z); g.add(w);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(geo('taxsign', 0.9, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    sign.position.set(0, 1.95, 0); g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(geo('lightbar', 1.1, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    bar.position.set(0, 1.9, -0.2); g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(geo('stripe', def.wid + 0.02, 0.3, def.len + 0.02), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.95; g.add(stripe);
  }
  if (type === 'bike') {
    // Narrow the body for a bike silhouette.
    body.scale.x = 0.45; cabin.visible = false;
  }
  g.userData.def = def;
  return g;
}

export function spawnCar(type, x, z, heading = 0, opts = {}) {
  const mesh = makeCarMesh(type);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  W.scene.add(mesh);
  const car = {
    type, def: VEHICLES[type], mesh,
    x, z, heading, speed: 0,
    damage: 0, dead: false, smokeT: 0,
    parked: !!opts.parked, traffic: !!opts.traffic, cop: !!opts.cop,
    route: opts.route || null, routeI: 0, honkT: 0, brake: false,
    driver: opts.driver || null, // 'player' | 'traffic' | 'cop' | 'rival' | 'vera'
    explodeT: 0,
  };
  S.cars.push(car);
  return car;
}

export function scatterCars() {
  const rng = mulberry32(S.seed + 7);
  const types = ['sedan', 'taxi', 'comet', 'truck', 'sports', 'van', 'bike', 'muscle', 'limo', 'pickup'];
  // Parked stealables along streets.
  for (let i = 0; i < 16; i++) {
    const t = pick(rng, types);
    const along = Math.round((rng() * 10 - 5)) * 100;
    const cross = Math.round((rng() * 10 - 5)) * 100;
    const onXRoad = rng() < 0.5;
    const x = onXRoad ? along : cross + (rng() < 0.5 ? 8.5 : -8.5);
    const z = onXRoad ? cross + (rng() < 0.5 ? 8.5 : -8.5) : along;
    if (Math.abs(x) > 540 || Math.abs(z) > 540) continue;
    spawnCar(t, x, z, onXRoad ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), { parked: true });
  }
  // Moving traffic.
  for (let i = 0; i < 14; i++) {
    const t = pick(rng, ['sedan', 'taxi', 'truck', 'van', 'pickup', 'limo', 'sports']);
    const start = randomRoadPoint(rng);
    const c = spawnCar(t, start.x, start.z, start.heading, { traffic: true, driver: 'traffic' });
    c.route = buildRoute(rng, start);
  }
}

export function randomRoadPoint(rng) {
  const along = (Math.floor(rng() * 11) - 5) * 100;
  const cross = (Math.floor(rng() * 11) - 5) * 100;
  const onXRoad = rng() < 0.5;
  const heading = onXRoad ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
  return { x: onXRoad ? along : cross, z: onXRoad ? cross : along, heading };
}

function buildRoute(rng, start) {
  const pts = [{ x: start.x, z: start.z }];
  let x = start.x, z = start.z;
  for (let i = 0; i < 6; i++) {
    if (rng() < 0.5) x = clamp(x + (rng() < 0.5 ? 100 : -100) * (1 + Math.floor(rng() * 3)), -500, 500);
    else z = clamp(z + (rng() < 0.5 ? 100 : -100) * (1 + Math.floor(rng() * 3)), -500, 500);
    pts.push({ x, z });
  }
  return pts;
}

// --- player driving ---
export function drivePlayerCar(car, input, dt) {
  const def = car.def;
  const accel = input.f * def.accel;
  if (input.f > 0) car.speed += accel * dt;
  else if (input.f < 0) car.speed -= (car.speed > 0.5 ? def.brake : def.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = clamp(car.speed, -def.top * 0.35, def.top);
  const steer = input.s * def.grip * clamp(Math.abs(car.speed) / 12, 0, 1);
  car.heading += steer * dt * (car.speed >= 0 ? 1 : -1) * 0.55;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collideCircle(nx, nz, def.len / 2);
  if (fixed.x !== nx || fixed.z !== nz) {
    // hit a building: scrape speed off, small damage
    if (Math.abs(car.speed) > 12) { car.damage += 4; sfx.punch(); }
    car.speed *= 0.55;
  }
  car.x = fixed.x; car.z = fixed.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Ramps: airborne stunt.
  for (const r of CITY.ramps) {
    if (dist2d(car.x, car.z, r.x, r.z) < 7 && Math.abs(car.speed) > 22 && !car.airT) {
      car.airT = 0.9;
      S.stats.jumps++;
      S.money += 75; S.banner = { text: 'STUNT JUMP!', sub: '+$75', t: 2 };
      sfx.stunt();
    }
  }
  if (car.airT > 0) {
    car.airT -= dt;
    car.mesh.position.y = Math.sin((0.9 - car.airT) / 0.9 * Math.PI) * 2.2;
  } else car.mesh.position.y = 0;
  // Damage smoke + explosion.
  if (car.damage >= 60 && car.damage < 100) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) { car.smokeT = 0.12; spawnSmoke(car.x, car.z); }
  }
  if (car.damage >= 100 && !car.dead) {
    car.dead = true; car.explodeT = 0.01;
    sfx.explosion();
    spawnExplosion(car.x, car.z);
    if (car.driver === 'player') {
      S.player.onFoot = true; S.player.car = null;
      S.player.x = car.x + 3; S.player.z = car.z + 3;
      S.health -= 25;
    }
  }
  S.stats.kmDriven += Math.abs(car.speed) * dt / 1000;
  S.stats.topSpeed = Math.max(S.stats.topSpeed, Math.abs(car.speed) * 3.6);
  if (S.weather.rain > 0.3) S.stats.rainKm += Math.abs(car.speed) * dt / 1000;
}

export function updateTraffic(dt) {
  for (const car of S.cars) {
    if (!car.traffic || car.dead) continue;
    if (!car.route || car.route.length === 0) continue;
    const target = car.route[car.routeI % car.route.length];
    const d = dist2d(car.x, car.z, target.x, target.z);
    if (d < 6) { car.routeI++; continue; }
    const want = Math.atan2(target.x - car.x, target.z - car.z);
    const dh = angDiff(car.heading, want);
    car.heading += clamp(dh, -1.4 * dt, 1.4 * dt);
    // Brake for a stopped car ahead.
    let blocked = false;
    for (const other of S.cars) {
      if (other === car || other.dead) continue;
      const ox = other.x - car.x, oz = other.z - car.z;
      const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 12 && side < 3 && Math.abs(other.speed) < 2) { blocked = true; break; }
    }
    car.brake = blocked;
    const targetSpeed = blocked ? 0 : car.def.top * 0.45;
    car.speed += clamp(targetSpeed - car.speed, -14 * dt, 8 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(nx, nz, car.def.len / 2);
    car.x = fixed.x; car.z = fixed.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Honk at a blocking player car.
    if (blocked && car.honkT <= 0) { car.honkT = 4; sfx.horn(); }
    car.honkT -= dt;
  }
}

export function nearestCar(x, z, maxD = 6) {
  let best = null, bd = maxD;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = dist2d(x, z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function removeCar(car) {
  W.scene.remove(car.mesh);
  S.cars = S.cars.filter(c => c !== car);
}

// --- particles ---
export function spawnSmoke(x, z) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.6 })
  );
  m.position.set(x, 1.5 + Math.random(), z);
  W.scene.add(m);
  W.particles.push({ mesh: m, t: 0.8, vy: 2 });
}

export function spawnExplosion(x, z) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9 })
  );
  m.position.set(x, 1.5, z);
  W.scene.add(m);
  W.particles.push({ mesh: m, t: 0.6, vy: 0, grow: 6 });
  const light = new THREE.PointLight(0xff8a2a, 60, 40);
  light.position.set(x, 4, z);
  W.scene.add(light);
  W.particles.push({ mesh: light, t: 0.5, vy: 0, isLight: true });
}

export function updateParticles(dt) {
  for (let i = W.particles.length - 1; i >= 0; i--) {
    const p = W.particles[i];
    p.t -= dt;
    if (p.t <= 0) { W.scene.remove(p.mesh); W.particles.splice(i, 1); continue; }
    if (p.isLight) { p.mesh.intensity *= 0.9; continue; }
    p.mesh.position.y += (p.vy || 0) * dt;
    if (p.grow) p.mesh.scale.setScalar(1 + (0.6 - p.t) * p.grow * 0.4);
    p.mesh.material.opacity = Math.max(0, p.t);
  }
}
