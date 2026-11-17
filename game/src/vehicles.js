// vehicles.js — cars: traffic AI, the player's driving, collisions and damage.
// One job: everything with four wheels.
import { TILE, CITY_SIZE, CAR_TYPES, CAR_TYPE_KEYS } from './config.js';
import { clamp, dist, angleDiff, angleTo } from './random.js';
import { isRoadTile, roadPoint, buildingAt, circleHitsBuilding } from './city.js';
import { addMessage } from './state.js';
import { raiseWanted, spawnExplosion } from './player.js';

let carId = 1;
export function makeCar(x, y, angle, typeKey, driver) {
  const t = CAR_TYPES[typeKey];
  return {
    id: carId++, type: typeKey, typeName: t.name, color: t.color,
    x, y, angle, speed: 0, top: t.top, accel: t.accel, grip: t.grip,
    len: t.len, wid: t.wid, driver: driver || null, parked: !driver,
    hp: 100, smoke: 0, dead: false, target: null, stuck: 0,
    dir: angle, cruise: 90 + Math.random() * 60, brake: false,
  };
}

export function spawnTraffic(S, rng, n) {
  for (let i = 0; i < n; i++) {
    const p = roadPoint(rng, S.city);
    const type = rng.pick(CAR_TYPE_KEYS);
    const c = makeCar(p.x, p.y, p.vertical ? Math.PI / 2 : 0, type, 'traffic');
    c.angle = p.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    c.speed = c.cruise * 0.6;
    S.cars.push(c);
  }
}
export function spawnParkedCars(S, rng, n) {
  for (let i = 0; i < n; i++) {
    const p = roadPoint(rng, S.city);
    const ox = p.vertical ? 30 : 0, oy = p.vertical ? 0 : 30;
    const c = makeCar(p.x + ox, p.y + oy, p.vertical ? Math.PI / 2 : 0, rng.pick(CAR_TYPE_KEYS), null);
    S.cars.push(c);
  }
}

// Steer a traffic car along roads: pick a random road junction ahead as target.
function pickTrafficTarget(S, c, rng) {
  const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE);
  const ahead = 5;
  const dirs = [];
  if (isRoadTile(tx + ahead, ty)) dirs.push(0);
  if (isRoadTile(tx - ahead, ty)) dirs.push(Math.PI);
  if (isRoadTile(tx, ty + ahead)) dirs.push(Math.PI / 2);
  if (isRoadTile(tx, ty - ahead)) dirs.push(-Math.PI / 2);
  const d = dirs.length ? rng.pick(dirs) : c.angle;
  const L = 260;
  c.target = { x: c.x + Math.cos(d) * L, y: c.y + Math.sin(d) * L };
}

export function updateTraffic(S, rng, dt) {
  for (const c of S.cars) {
    if (c.driver !== 'traffic' || c.dead) continue;
    if (!c.target || dist(c.x, c.y, c.target.x, c.target.y) < 60) pickTrafficTarget(S, c, rng);
    const want = angleTo(c.x, c.y, c.target.x, c.target.y);
    const diff = angleDiff(c.angle, want);
    c.angle += clamp(diff, -1.8 * dt, 1.8 * dt);
    // Slow for the car ahead.
    let slow = false;
    for (const o of S.cars) {
      if (o === c || o.dead) continue;
      const d = dist(c.x, c.y, o.x, o.y);
      if (d < 70 && Math.abs(angleDiff(c.angle, angleTo(c.x, c.y, o.x, o.y))) < 0.6) { slow = true; break; }
    }
    const targetSpeed = slow ? 0 : c.cruise;
    c.speed += clamp(targetSpeed - c.speed, -260 * dt, 140 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!circleHitsBuilding(S.city, nx, ny, 20)) { c.x = nx; c.y = ny; }
    else { c.speed = 0; c.target = null; }
    c.x = clamp(c.x, 24, CITY_SIZE - 24); c.y = clamp(c.y, 24, CITY_SIZE - 24);
  }
}

export function updatePlayerCar(S, input, dt, audio) {
  const p = S.player, car = p.inCar;
  if (!car) return;
  const k = input.keys;
  const fwd = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
  const steer = (k['a'] || k['arrowleft'] ? 1 : 0) - (k['d'] || k['arrowright'] ? 1 : 0);
  const handbrake = !!k[' '];
  if (fwd > 0) car.speed += car.accel * dt;
  else if (fwd < 0) car.speed -= car.accel * 0.9 * dt;
  else car.speed -= Math.sign(car.speed) * 60 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 420 * dt;
  car.speed = clamp(car.speed, -car.top * 0.45, car.top);
  if (Math.abs(car.speed) < 4 && !fwd) car.speed = 0;
  const steerAmt = steer * car.grip * dt * clamp(Math.abs(car.speed) / 90, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmt * (handbrake ? 1.5 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!circleHitsBuilding(S.city, nx, ny, car.wid / 2 + 4)) { car.x = nx; car.y = ny; }
  else {
    if (Math.abs(car.speed) > 120) damageCar(S, car, 12, audio);
    car.speed *= -0.25;
  }
  car.x = clamp(car.x, 24, CITY_SIZE - 24); car.y = clamp(car.y, 24, CITY_SIZE - 24);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // Exhaust puffs.
  if (Math.abs(car.speed) > 40 && Math.random() < 0.3) {
    S.particles.push({
      x: car.x - Math.cos(car.angle) * car.len / 2, y: car.y - Math.sin(car.angle) * car.len / 2,
      vx: -Math.cos(car.angle) * 30, vy: -Math.sin(car.angle) * 30,
      life: 0.5, max: 0.5, color: '#999', size: 3,
    });
  }
  if (car.hp < 45) car.smoke += dt;
  if (audio) audio.setEngine(Math.abs(car.speed) / car.top, true);
}

export function damageCar(S, car, dmg, audio) {
  car.hp -= dmg;
  S.cam.shake = Math.max(S.cam.shake, 6);
  if (car.hp <= 0 && !car.dead) {
    car.dead = true; car.speed = 0;
    spawnExplosion(S, car.x, car.y, 1);
    if (audio) audio.explosion();
    if (car.driver === 'player') {
      S.player.inCar = null;
      S.player.health -= 25;
      addMessage(S, 'Your car blew up! Get out and run!');
    }
  }
}

// Car-vs-car and car-vs-pedestrian collisions, run once per frame.
export function collideCars(S, dt, audio) {
  const cars = S.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.dead || b.dead) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      const min = (a.len + b.len) / 2 - 6;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 140) { damageCar(S, a, 8, audio); damageCar(S, b, 8, audio); }
        a.speed *= 0.6; b.speed *= 0.6;
        if ((a.driver === 'player' || b.driver === 'player') && impact > 180) {
          raiseWanted(S, 0, ''); // crash noise draws heat
          S.wantedHeat = 1;
        }
      }
    }
  }
  // Player car hitting pedestrians.
  const pc = S.player.inCar;
  if (pc && Math.abs(pc.speed) > 60) {
    for (const ped of S.peds) {
      if (ped.hp <= 0) continue;
      if (dist(pc.x, pc.y, ped.x, ped.y) < 30) {
        ped.hp = 0; ped.flee = 0; S.stats.pedsHit++;
        raiseWanted(S, 1, 'Pedestrian hit!');
        spawnExplosion(S, ped.x, ped.y, 0.15);
        if (audio) audio.punch();
      }
    }
  }
}
