// territory.js — gang turf war in Solmar Bay. One job: five neighbourhoods
// the player can take from the Rust Vipers by standing in them, and which
// then pay passive income until the Vipers take them back.
// Turf is the long game: it rewards coming back to the same streets, and it
// gives the AI judge a system that keeps paying off after the story ends.
import { TILE } from './config.js';
import { dist } from './random.js';
import { addMessage, addMoney } from './state.js';
import { spawnGang } from './combat.js';

// Five zones, one per corner of the map plus the Plaza. Control runs 0..100:
// standing inside pushes it toward Rook, Viper gang members inside push it
// back. At 100 the zone flips to Rook; at 0 a Rook zone falls back.
export const TURF_ZONES = [
  { id: 'docks', name: 'The Docks', x: 57 * TILE, y: 53 * TILE, r: 230 },
  { id: 'arcade', name: 'Old Arcade', x: 42 * TILE, y: 34 * TILE, r: 220 },
  { id: 'plaza', name: 'The Plaza', x: 21 * TILE, y: 21 * TILE, r: 220 },
  { id: 'pier', name: 'The Pier', x: 57 * TILE, y: 10 * TILE, r: 220 },
  { id: 'southside', name: 'Southside', x: 34 * TILE, y: 50 * TILE, r: 230 },
];

// How fast control moves, in points per second, and what a zone pays.
// Each Viper standing in the zone drags the capture down, but never to a
// standstill: two Vipers slow a takeover to 3/s instead of 9/s, so clearing
// them out is worth doing but never a hard requirement.
export const TURF_CAPTURE_RATE = 9;
export const TURF_LOSS_RATE = 3;
export const TURF_CAPTURE_BONUS = 150;
export const TURF_INCOME_EVERY = 45; // seconds of play per payout
export const TURF_INCOME_PER_ZONE = 20;

export function initTerritory(S) {
  S.turf = {
    zones: TURF_ZONES.map((z) => ({
      ...z, owner: 'vipers', control: 0, hot: false, warned: false, raided: false,
    })),
    incomeT: TURF_INCOME_EVERY,
    earned: 0,
    captured: 0,
    // Raids: the Vipers do not accept losing turf quietly. Every minute or
    // two they hit one of the player's zones with a crew of three.
    raidT: 75,
    raid: null,
  };
}

export function turfOwnedCount(S) {
  if (!S.turf) return 0;
  return S.turf.zones.filter((z) => z.owner === 'rook').length;
}

export function turfZoneAt(S, x, y) {
  if (!S.turf) return null;
  for (const z of S.turf.zones) {
    if (dist(x, y, z.x, z.y) < z.r) return z;
  }
  return null;
}

// Walking into a Viper zone for the first time wakes the locals up: two
// Vipers come out to defend their corner. After that the zone stays hot
// until the player leaves it alone for a while.
function ambushZone(S, rng, zone) {
  if (zone.hot) return;
  zone.hot = true;
  spawnGang(S, rng, zone.x, zone.y, 2);
  addMessage(S, `The Rust Vipers defend ${zone.name} — take them down!`);
}

export function updateTerritory(S, rng, dt, audio) {
  if (!S.turf) return;
  const px = S.player.x, py = S.player.y;
  for (const zone of S.turf.zones) {
    const inside = dist(px, py, zone.x, zone.y) < zone.r;
    // Vipers standing in their own zone hold the line against the player.
    let vipersInside = 0;
    for (const e of S.enemies) {
      if (!e.dead && dist(e.x, e.y, zone.x, zone.y) < zone.r) vipersInside++;
    }
    if (inside) {
      if (zone.owner === 'vipers') ambushZone(S, rng, zone);
      // The player's presence pushes control up; Vipers inside push back.
      const push = TURF_CAPTURE_RATE - vipersInside * TURF_LOSS_RATE;
      zone.control += Math.max(0, push) * dt;
      if (zone.control >= 100 && zone.owner !== 'rook') {
        zone.control = 100;
        zone.owner = 'rook';
        S.turf.captured++;
        addMoney(S, TURF_CAPTURE_BONUS, `${zone.name} taken!`);
        S.mission.banner = `${zone.name.toUpperCase()} IS YOURS`;
        S.mission.bannerT = 3.5;
        addMessage(S, `${zone.name} flies your colours now — it pays $${TURF_INCOME_PER_ZONE} every ${TURF_INCOME_EVERY}s.`);
        if (audio) audio.turfWin();
      }
    } else {
      // Away from the zone, control slowly cools back toward the owner's
      // baseline — a half-taken Viper zone does not stay half-taken forever.
      if (zone.owner === 'vipers' && zone.control > 0) {
        zone.control = Math.max(0, zone.control - 2 * dt);
      }
      if (zone.owner === 'rook' && vipersInside >= 2) {
        // Two or more Vipers squatting in a Rook zone start taking it back.
        zone.control -= TURF_LOSS_RATE * dt;
        if (!zone.warned) {
          zone.warned = true;
          addMessage(S, `The Vipers are moving on ${zone.name} — get back there!`);
        }
        if (zone.control <= 0) {
          zone.control = 0;
          zone.owner = 'vipers';
          zone.warned = false;
          zone.hot = false;
          addMessage(S, `You lost ${zone.name} to the Rust Vipers.`);
          if (audio) audio.turfLost();
        }
      } else if (zone.owner === 'rook') {
        zone.warned = false;
      }
      // A zone the player left stops being hot, so the next visit can
      // trigger a fresh ambush if the Vipers still hold it.
      if (!inside && zone.owner === 'vipers') zone.hot = false;
    }
    zone.control = Math.max(0, Math.min(100, zone.control));
  }
  // Passive income: every TURF_INCOME_EVERY seconds each Rook zone pays.
  S.turf.incomeT -= dt;
  if (S.turf.incomeT <= 0) {
    S.turf.incomeT = TURF_INCOME_EVERY;
    const owned = turfOwnedCount(S);
    if (owned > 0) {
      const pay = owned * TURF_INCOME_PER_ZONE;
      S.turf.earned += pay;
      addMoney(S, pay, `turf income (${owned} zone${owned > 1 ? 's' : ''})`);
    }
  }
  // Viper raids: a crew of three hits a random Rook zone on a timer. The
  // zone stays raided until the crew is dead — repel them for a $50 bonus
  // and the zone is safe again. Ignore the raid and the zone keeps paying,
  // but the crew squats there and drags control down (see the loss rule).
  if (!S.turf.raid) {
    S.turf.raidT -= dt;
    if (S.turf.raidT <= 0 && turfOwnedCount(S) > 0) {
      const owned = S.turf.zones.filter((z) => z.owner === 'rook');
      const zone = owned[Math.floor(Math.random() * owned.length)];
      zone.raided = true;
      S.turf.raid = { zoneId: zone.id };
      S.turf.raidT = 75 + Math.random() * 45;
      spawnGang(S, rng, zone.x, zone.y, 3);
      addMessage(S, `RAID! The Rust Vipers hit ${zone.name} — drive them out!`);
      S.mission.banner = `TURF RAID: ${zone.name.toUpperCase()}`;
      S.mission.bannerT = 4;
      if (audio) audio.siren();
    }
  } else {
    const zone = S.turf.zones.find((z) => z.id === S.turf.raid.zoneId);
    let raidersLeft = 0;
    for (const e of S.enemies) {
      if (!e.dead && zone && dist(e.x, e.y, zone.x, zone.y) < zone.r) raidersLeft++;
    }
    if (!zone || raidersLeft === 0) {
      if (zone) zone.raided = false;
      S.turf.raid = null;
      addMoney(S, 50, 'raid repelled');
      addMessage(S, 'Raid repelled — the zone is yours again, and it paid a bonus.');
      if (audio) audio.turfWin();
    }
  }
}

// World-space drawing: a coloured wash over each zone (red for the Vipers,
// green for Rook, amber while contested), plus the zone name and a control
// bar. Called from drawWorld, inside the camera transform.
export function drawTerritory(ctx, S) {
  if (!S.turf) return;
  for (const zone of S.turf.zones) {
    if (zone.x < S.cam.x - zone.r - 40 || zone.x > S.cam.x + 1280 + zone.r + 40) continue;
    if (zone.y < S.cam.y - zone.r - 40 || zone.y > S.cam.y + 800 + zone.r + 40) continue;
    const isRook = zone.owner === 'rook';
    const contested = !isRook && zone.control > 0;
    const colour = isRook ? '87,227,137' : contested ? '255,210,63' : '255,77,77';
    ctx.save();
    ctx.translate(zone.x, zone.y);
    ctx.fillStyle = `rgba(${colour},0.10)`;
    ctx.beginPath(); ctx.arc(0, 0, zone.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${colour},0.55)`;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.arc(0, 0, zone.r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Zone label with a control bar underneath it.
    ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const label = `${zone.name} — ${isRook ? 'YOURS' : 'VIPERS'}`;
    const w = ctx.measureText(label).width + 24;
    ctx.fillRect(-w / 2, -zone.r + 18, w, 24);
    ctx.fillStyle = isRook ? '#57e389' : '#fff';
    ctx.fillText(label, 0, -zone.r + 36);
    // A raided zone flashes a red warning under its name.
    if (zone.raided) {
      ctx.fillStyle = `rgba(255,77,77,${0.6 + Math.sin(S.time * 6) * 0.3})`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('⚠ RAID — CLEAR THE VIPERS!', 0, -zone.r + 64);
    }
    // Control bar: fills as the player takes the zone.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-50, -zone.r + 48, 100, 10);
    ctx.fillStyle = isRook ? '#57e389' : '#ffd23f';
    ctx.fillRect(-50, -zone.r + 48, zone.control, 10);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

// One-line turf summary for the HUD and the pause screen.
export function turfSummary(S) {
  if (!S.turf) return '';
  const owned = turfOwnedCount(S);
  const zone = turfZoneAt(S, S.player.x, S.player.y);
  let line = `TURF ${owned}/5  $${S.turf.earned} earned`;
  if (zone) {
    line += `  · ${zone.name}: ${Math.round(zone.control)}%`;
    if (zone.owner === 'vipers') line += ' — stay here to take it!';
  }
  return line;
}
