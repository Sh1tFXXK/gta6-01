// police.js — the SBPD: wanted-level response, cop cars that chase and ram,
// on-foot officers who try to bust the player. One job: the law.
import { TILE, CITY_SIZE } from './config.js';
import { clamp, dist, angleDiff, angleTo } from './random.js';
import { makeCar } from './vehicles.js';
import { roadPoint, circleHitsBuilding } from './city.js';
import { addMessage } from './state.js';
import { damageCar } from './vehicles.js';

export function wantedFromStars(S) { return S.wanted; }

// How many cop cars the wanted level should field.
export function desiredCopCars(S) {
  if (S.wanted <= 0) return 0;
  return Math.min(1 + Math.floor(S.wanted / 2), 4);
}

export function spawnCopCar(S, rng) {
  // Spawn on a road a little way from the player, so the chase is visible.
  for (let i = 0; i < 12; i++) {
    const p = roadPoint(rng, S.city);
    if (dist(p.x, p.y, S.player.x, S.player.y) > 420) {
      const c = makeCar(p.x, p.y, 0, 'police', 'cop');
      c.cruise = 300;
      S.copCars.push(c); S.cars.push(c);
      return c;
    }
  }
  const c = makeCar(S.player.x + 500, S.player.y, Math.PI, 'police', 'cop');
  S.copCars.push(c); S.cars.push(c);
  return c;
}

export function spawnCopOnFoot(S, rng) {
  const a = rng.range(0, Math.PI * 2);
  S.cops.push({
    x: S.player.x + Math.cos(a) * 260, y: S.player.y + Math.sin(a) * 260,
    angle: 0, speed: 150, hp: 100, bustT: 0,
  });
}

export function updatePolice(S, rng, dt, audio) {
  // Decay: if the player is far from every cop and out of the chase, cool down.
  const anyCopNear = S.copCars.some((c) => !c.dead && dist(c.x, c.y, S.player.x, S.player.y) < 520) ||
    S.cops.some((c) => dist(c.x, c.y, S.player.x, S.player.y) < 300);
  if (S.wanted > 0) {
    S.wantedHeat = anyCopNear ? 1 : Math.max(0, S.wantedHeat - dt * 0.08);
    if (S.wantedHeat <= 0) {
      S.wanted = Math.max(0, S.wanted - 1);
      S.wantedHeat = S.wanted > 0 ? 0.6 : 0;
      addMessage(S, S.wanted > 0 ? `Heat cooling off… wanted ${S.wanted}★` : 'You lost the cops. Clean for now.');
    }
  }
  // Spawn / despawn cop cars to match the wanted level.
  const alive = S.copCars.filter((c) => !c.dead);
  if (alive.length < desiredCopCars(S) && Math.random() < dt * 0.8) spawnCopCar(S, rng);
  if (S.wanted === 0) {
    for (const c of S.copCars) { c.driver = null; c.parked = true; }
    S.copCars = S.copCars.filter((c) => c.driver === 'cop');
  }
  // Round 2: cop cars steer at where the player WILL be, not where they are —
  // at wanted 3+ they cut the corner, so outrunning them takes real driving.
  const pc = S.player.inCar;
  const pvx = pc ? Math.cos(pc.angle) * pc.speed : 0;
  const pvy = pc ? Math.sin(pc.angle) * pc.speed : 0;
  const lead = S.wanted >= 3 ? 0.55 : 0.2;
  // Cop cars chase the player and ram.
  for (const c of S.copCars) {
    if (c.dead || c.driver !== 'cop') continue;
    const want = angleTo(c.x, c.y, S.player.x + pvx * lead, S.player.y + pvy * lead);
    const diff = angleDiff(c.angle, want);
    c.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    const targetSpeed = S.wanted >= 3 ? c.top * 0.95 : c.top * 0.8;
    c.speed += clamp(targetSpeed - c.speed, -300 * dt, 260 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!circleHitsBuilding(S.city, nx, ny, 20)) { c.x = nx; c.y = ny; }
    else { c.speed *= 0.4; }
    // Ram the player's car.
    if (pc && dist(c.x, c.y, pc.x, pc.y) < 55) {
      damageCar(S, pc, 6 * dt * 4, audio);
      if (Math.random() < dt * 0.5 && audio) audio.siren();
    }
    if (Math.random() < dt * 0.25 && audio && S.wanted > 0) audio.siren();
  }
  // On-foot cops: walk at the player, bust when close and the player is on foot.
  if (S.wanted >= 2 && S.cops.length < S.wanted && Math.random() < dt * 0.4) spawnCopOnFoot(S, rng);
  for (const cop of S.cops) {
    const d = dist(cop.x, cop.y, S.player.x, S.player.y);
    const want = angleTo(cop.x, cop.y, S.player.x, S.player.y);
    cop.angle = want;
    if (d > 34) {
      const nx = cop.x + Math.cos(want) * cop.speed * dt;
      const ny = cop.y + Math.sin(want) * cop.speed * dt;
      if (!circleHitsBuilding(S.city, nx, ny, 10)) { cop.x = nx; cop.y = ny; }
    } else if (!S.player.inCar) {
      cop.bustT += dt;
      if (cop.bustT > 1.6) {
        S.screen = 'busted';
        addMessage(S, 'BUSTED by the SBPD.');
      }
    }
  }
  // Player health: wasted when it hits zero.
  if (S.player.health <= 0 && S.screen === 'play') {
    S.player.health = 0;
    S.screen = 'wasted';
  }
}
