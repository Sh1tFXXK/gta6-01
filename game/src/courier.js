// Courier runs for Solmar Nights 3D: press C, pick up, drop off.
// Pay scales with distance, speed earns a tip, express jobs pay double,
// three in a row earns a loyalty bonus.

import { S } from './state.js';
import { dist2d } from './random.js';
import { sfx } from './audio.js';
import { setWaypoint } from './render.js';
import { addRespect } from './state.js';

const SPOTS = [
  [-400, -400], [400, -400], [-400, 400], [400, 400],
  [0, 0], [-200, -200], [200, 200], [100, 100], [-100, 100], [100, -400],
];

function randomSpot(except) {
  let s;
  do { s = SPOTS[Math.floor(Math.random() * SPOTS.length)]; }
  while (except && s[0] === except[0] && s[1] === except[1]);
  return s;
}

export function startCourier() {
  if (S.courier) return;
  const pickup = randomSpot();
  const drop = randomSpot(pickup);
  const express = Math.random() < 0.1;
  const dist = dist2d(pickup[0], pickup[1], drop[0], drop[1]);
  const timeLimit = express ? Math.max(45, dist / 9) : Math.max(60, dist / 6);
  S.courier = { stage: 'pickup', px: pickup[0], pz: pickup[1], dx: drop[0], dz: drop[1], t: 0, limit: timeLimit, express, dist };
  S.banner = { text: express ? 'EXPRESS COURIER — DOUBLE PAY' : 'COURIER RUN', sub: 'Pick up the parcel', t: 2.5 };
  sfx.click();
}

export function updateCourier(dt) {
  const c = S.courier;
  if (!c) { setWaypoint(0, 0, false); return; }
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  c.t += dt;
  const tx = c.stage === 'pickup' ? c.px : c.dx;
  const tz = c.stage === 'pickup' ? c.pz : c.dz;
  setWaypoint(tx, tz, true);
  S.objective = c.stage === 'pickup'
    ? `COURIER — pick up the parcel (${Math.max(0, Math.ceil(c.limit - c.t))}s)`
    : `COURIER — deliver it (${Math.max(0, Math.ceil(c.limit - c.t))}s)`;
  if (c.t > c.limit) {
    S.banner = { text: 'COURIER LATE', sub: 'The client went elsewhere', t: 2.5 };
    sfx.fail();
    S.courier = null;
    S.courierStreak = 0;
    return;
  }
  if (dist2d(px, pz, tx, tz) < 10) {
    if (c.stage === 'pickup') {
      c.stage = 'drop';
      sfx.pickup();
    } else {
      const speedTip = Math.floor((1 - c.t / c.limit) * 40);
      let pay = Math.round(c.dist / 10) + 20 + speedTip;
      if (c.express) pay *= 2;
      S.courierStreak++;
      if (S.courierStreak >= 3) { pay += 100; S.banner = { text: 'LOYALTY BONUS', sub: '3 runs in a row — +$100', t: 3 }; }
      S.money += pay;
      addRespect(40);
      S.stats.courierDone++;
      S.banner = { text: 'DELIVERED', sub: `+$${pay}${c.express ? ' (express x2)' : ''}`, t: 3 };
      sfx.cash();
      S.courier = null;
    }
  }
}
