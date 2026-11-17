// player.js — Rook Marlow on foot: walking, aiming, entering and exiting cars.
// One job: the player character. Driving physics live in vehicles.js.
import { TILE, CITY_SIZE } from './config.js';
import { clamp, angleTo } from './random.js';
import { circleHitsBuilding } from './city.js';
import { addMessage } from './state.js';

export function updatePlayerOnFoot(S, input, dt, audio) {
  const p = S.player;
  if (p.inCar || p.dead) return;
  const k = input.keys;
  let mx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
  let my = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
  const run = k['shift'] ? 1.6 : 1;
  const len = Math.hypot(mx, my) || 1;
  const spd = 170 * run;
  const nx = p.x + (mx / len) * spd * dt;
  const ny = p.y + (my / len) * spd * dt;
  if (mx || my) {
    if (!circleHitsBuilding(S.city, nx, p.y, 12)) p.x = nx;
    if (!circleHitsBuilding(S.city, p.x, ny, 12)) p.y = ny;
    p.angle = Math.atan2(my, mx);
  }
  p.x = clamp(p.x, 16, CITY_SIZE - 16);
  p.y = clamp(p.y, 16, CITY_SIZE - 16);
  // Aim at the mouse (screen -> world).
  const wx = S.cam.x + input.mouse.x, wy = S.cam.y + input.mouse.y;
  p.aimAngle = angleTo(p.x, p.y, wx, wy);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  if (input.consume('e')) tryEnterCar(S, audio);
  if (input.consume('f')) punch(S, audio);
}

export function nearestCar(S, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of S.cars) {
    if (c.dead) continue;
    const dx = c.x - x, dy = c.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function tryEnterCar(S, audio) {
  const p = S.player;
  const car = nearestCar(S, p.x, p.y, 64);
  if (!car) { addMessage(S, 'No car close by — walk up to one and press E.'); return; }
  p.inCar = car; car.driver = 'player'; car.parked = false;
  p.x = car.x; p.y = car.y;
  S.stats.carsStolen++;
  if (car.driverWas !== 'player') raiseWanted(S, 1, 'Car stolen!');
  if (audio) audio.pickup();
  addMessage(S, `Got in the ${car.typeName}. Drive with W A S D.`);
}

export function exitCar(S) {
  const p = S.player, car = p.inCar;
  if (!car) return;
  p.inCar = null; car.driver = null; car.parked = true;
  const side = { x: p.x + Math.cos(car.angle + Math.PI / 2) * 34, y: p.y + Math.sin(car.angle + Math.PI / 2) * 34 };
  if (!circleHitsBuilding(S.city, side.x, side.y, 12)) { p.x = side.x; p.y = side.y; }
  else { p.x = car.x - 34; p.y = car.y; }
  addMessage(S, 'On foot. Press E near a car to get in.');
}

export function punch(S, audio) {
  const p = S.player;
  if (p.punchCd > 0 || p.inCar) return;
  p.punchCd = 0.45;
  if (audio) audio.punch();
  const reach = 34, ax = p.x + Math.cos(p.aimAngle ?? p.angle) * reach, ay = p.y + Math.sin(p.aimAngle ?? p.angle) * reach;
  for (const e of S.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - ax, e.y - ay) < 30) { hurtEnemy(S, e, 34, audio); return; }
  }
  for (const ped of S.peds) {
    if (Math.hypot(ped.x - ax, ped.y - ay) < 26) {
      ped.flee = 3; ped.hp -= 20; raiseWanted(S, 1, 'Assault!');
      spawnBlood(S, ped.x, ped.y);
    }
  }
}

export function hurtEnemy(S, e, dmg, audio) {
  e.hp -= dmg;
  spawnBlood(S, e.x, e.y);
  if (e.hp <= 0 && !e.dead) {
    e.dead = true; S.mission.kills++; S.rampage.kills++;
    addMoney(S, 25, 'gang member down');
    if (audio) audio.pickup();
    spawnExplosion(S, e.x, e.y, 0.4);
  }
}

export function spawnBlood(S, x, y) {
  for (let i = 0; i < 8; i++) {
    S.particles.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.5, max: 0.5, color: '#c0392b', size: 3 });
  }
}
export function spawnExplosion(S, x, y, scale) {
  S.cam.shake = Math.max(S.cam.shake, 10 * scale);
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220 * scale;
    S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7, max: 0.7, color: ['#ff9f1c', '#ff5e3a', '#555'][i % 3], size: 4 + Math.random() * 5 });
  }
  S.flash = 0.12;
}

export function raiseWanted(S, n, why) {
  S.wanted = Math.min(5, S.wanted + n);
  S.wantedHeat = 1;
  if (why) addMessage(S, why + `  Wanted: ${'★'.repeat(S.wanted)}`);
}
