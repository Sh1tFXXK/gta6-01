// Gang turf for Solmar Nights 3D: five zones to capture by standing in
// them, passive income, Viper raid events, and the King of Solmar Bay bonus.

import { S } from './state.js';
import { TURFS } from './config.js';
import { dist2d } from './random.js';
import { sfx } from './audio.js';
import { spawnGang } from './combat.js';

const TURF_LOSS_RATE = 3; // capture stalls while Vipers stand in the zone
const CAPTURE_RATE = 9;   // progress per second while uncontested

export function initTurfs() {
  S.turfs = {};
  for (const t of TURFS) S.turfs[t.id] = { owner: 'none', progress: 0 };
}

export function updateTurfs(dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  for (const t of TURFS) {
    const turf = S.turfs[t.id];
    if (!turf) continue;
    const d = dist2d(px, pz, t.x, t.z);
    const vipersHere = S.gang.filter(g => !g.dead && dist2d(g.x, g.z, t.x, t.z) < t.r).length;
    if (d < t.r && turf.owner !== 'player') {
      turf.progress += (CAPTURE_RATE - vipersHere * TURF_LOSS_RATE) * dt;
      if (turf.progress >= 100) {
        turf.progress = 100;
        turf.owner = 'player';
        S.stats.turfsTaken++;
        S.money += 100;
        S.banner = { text: t.name + ' IS YOURS', sub: '+$100  •  turf income started', t: 3 };
        sfx.mission();
        if (Object.values(S.turfs).every(x => x.owner === 'player')) {
          S.money += 500;
          S.banner = { text: 'KING OF SOLMAR BAY', sub: 'All five turfs — +$500', t: 4 };
        }
      }
    } else if (d >= t.r && turf.owner !== 'player') {
      turf.progress = Math.max(0, turf.progress - 2 * dt);
    }
    S['turf_' + t.id] = turf.progress;
  }
  // Passive income every 45 s per owned turf.
  S.turfIncomeT += dt;
  if (S.turfIncomeT >= 45) {
    S.turfIncomeT = 0;
    const owned = Object.values(S.turfs).filter(t => t.owner === 'player').length;
    if (owned > 0) {
      S.money += owned * 25;
      S.banner = { text: 'TURF INCOME', sub: `+$${owned * 25} from ${owned} turf${owned > 1 ? 's' : ''}`, t: 2.5 };
      sfx.cash();
    }
    // Raid: Vipers try to take a turf back.
    if (owned > 0 && Math.random() < 0.5) {
      const ownedIds = TURFS.filter(t => S.turfs[t.id].owner === 'player');
      const target = ownedIds[Math.floor(Math.random() * ownedIds.length)];
      spawnGang(target.x, target.z, 3);
      S.banner = { text: 'VIPER RAID', sub: `They're hitting ${target.name} — +$50 if you hold it`, t: 3.5 };
      S.turfs[target.id].raid = true;
    }
  }
  // Raid cleared: reward when no gang left near a raided turf.
  for (const t of TURFS) {
    const turf = S.turfs[t.id];
    if (turf.raid && S.gang.filter(g => !g.dead && dist2d(g.x, g.z, t.x, t.z) < t.r + 20).length === 0) {
      turf.raid = false;
      S.money += 50;
      sfx.cash();
    }
  }
}

export function turfAt(x, z) {
  for (const t of TURFS) {
    if (dist2d(x, z, t.x, t.z) < t.r) return t;
  }
  return null;
}
