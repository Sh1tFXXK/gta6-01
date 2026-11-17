// pedestrians.js — people walking the pavements of Solmar Bay, fleeing danger.
// One job: pedestrian life.
import { TILE, CITY_SIZE, PED_NAMES, PED_SHIRTS } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { sidewalkPoint, circleHitsBuilding } from './city.js';
import { spawnBlood } from './player.js';

export function spawnPeds(S, rng, n) {
  for (let i = 0; i < n; i++) {
    const p = sidewalkPoint(rng, S.city);
    S.peds.push({
      x: p.x, y: p.y, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52), name: rng.pick(PED_NAMES),
      shirt: rng.pick(PED_SHIRTS), hp: 100, flee: 0,
      target: null, panic: 0, walkPhase: rng.range(0, 6),
    });
  }
}

export function updatePeds(S, rng, dt) {
  const px = S.player.x, py = S.player.y;
  for (const ped of S.peds) {
    if (ped.hp <= 0) continue;
    ped.walkPhase += dt * 6;
    // Flee from the player when they are violent or too close in a car.
    const pd = dist(ped.x, ped.y, px, py);
    const car = S.player.inCar;
    if ((car && Math.abs(car.speed) > 120 && pd < 130) || ped.flee > 0 || S.rampage.active) {
      ped.flee = Math.max(ped.flee, 1.5);
      const away = angleTo(px, py, ped.x, ped.y);
      ped.angle = away;
      const nx = ped.x + Math.cos(away) * 120 * dt, ny = ped.y + Math.sin(away) * 120 * dt;
      if (!circleHitsBuilding(S.city, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
      ped.flee -= dt;
      continue;
    }
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
      ped.target = sidewalkPoint(rng, S.city);
    }
    const want = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
    ped.angle = want;
    const nx = ped.x + Math.cos(want) * ped.speed * dt;
    const ny = ped.y + Math.sin(want) * ped.speed * dt;
    if (!circleHitsBuilding(S.city, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
    else ped.target = null;
    ped.x = clamp(ped.x, 16, CITY_SIZE - 16); ped.y = clamp(ped.y, 16, CITY_SIZE - 16);
  }
  // Dead peds fade out (they stay as a reminder, then despawn).
  for (let i = S.peds.length - 1; i >= 0; i--) {
    if (S.peds[i].hp <= 0) {
      S.peds[i].deadT = (S.peds[i].deadT || 0) + dt;
      if (S.peds[i].deadT > 6) S.peds.splice(i, 1);
    }
  }
}
