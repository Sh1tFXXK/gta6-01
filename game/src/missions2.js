// missions2.js — story missions 7 and 8 for Solmar Nights. One job: the two
// late-game jobs Vera hands Rook after The Last Delivery.
//   7 "Vera's Escort": Vera drives a route across the city while the Vipers
//      ambush her at every stop — stay close and keep her car alive.
//   8 "The Vault Job": crack the Bay Bank vault under a timer with the SBPD
//      already on the way, then run for the Safehouse.
// The functions take a hooks object ({ complete, fail }) from missions.js so
// this module never imports missions.js back — no circular import.
import { TILE } from './config.js';
import { dist, angleTo, clamp } from './random.js';
import { addMessage, addMoney } from './state.js';
import { spawnGang } from './combat.js';
import { makeCar } from './vehicles.js';
import { raiseWanted } from './player.js';
import { circleHitsBuilding } from './city.js';

// Escort tuning: how close the player must stay, how long they may stray,
// how fast Vera drives, and how long the vault takes to crack.
export const ESCORT_MAX_DIST = 420;
export const ESCORT_LOST_TIME = 8;
export const ESCORT_CAR_SPEED = 135;
export const VAULT_CRACK_TIME = 18;
export const VAULT_TIMER = 150;

// The escort route: Vera stops at the hotel, the pier and the safehouse.
// Vipers ambush her at each stop, so the player has to clear them before
// she rolls on.
const ESCORT_STOPS = ['hotel', 'pier', 'safehouse'];

export function setupMission78(S, rng, audio) {
  const m = S.mission;
  const P = S.city.places;
  if (m.index === 6) {
    // Mission 7 — Vera's Escort.
    if (m.stage === 0) {
      m.target = { x: P.plaza.x, y: P.plaza.y, label: 'Plaza' };
      m.objective = 'Meet Vera at the Plaza — she needs an escort across town';
    } else if (m.stage === 1) {
      // Vera's car spawns at the Plaza once the player reaches her.
      if (!S.escort) {
        const car = makeCar(P.plaza.x + 60, P.plaza.y + 60, 0, 'sedan', 'vera');
        car.hp = 120;
        S.cars.push(car);
        S.escort = { car, stop: 0, lostT: 0, ambushed: [false, false, false], stuckT: 0, lastD: 0 };
        addMessage(S, 'Vera: "Follow me, Rook. The Vipers know I\'m moving — keep them off me."');
      }
      const stop = ESCORT_STOPS[S.escort.stop];
      const place = P[stop];
      m.target = { x: place.x, y: place.y, label: place.label };
      m.objective = `Escort Vera to ${place.label} — stay close, keep her car alive`;
    }
  } else if (m.index === 7) {
    // Mission 8 — The Vault Job.
    if (m.stage === 0) {
      m.target = { x: P.bank.x, y: P.bank.y, label: 'Bay Bank' };
      m.objective = 'Get to Bay Bank — the vault job starts there';
    } else if (m.stage === 1) {
      m.target = { x: P.bank.x, y: P.bank.y, label: 'Bay Bank Vault' };
      m.objective = `Crack the vault — stay by the bank! (${Math.ceil(VAULT_CRACK_TIME - (m.crackT || 0))}s)`;
      if (!m.vaultStarted) {
        m.vaultStarted = true;
        m.timer = VAULT_TIMER;
        m.crackT = 0;
        raiseWanted(S, 3, 'The vault alarm is screaming — the SBPD is coming!');
        addMessage(S, 'Vera: "The alarm is live. Hold the bank until the safe pops!"');
        if (audio) audio.siren();
      }
    } else if (m.stage === 2) {
      m.target = { x: P.safehouse.x, y: P.safehouse.y, label: 'Safehouse' };
      m.objective = 'Vault cracked! Get to the Safehouse — lose the heat first';
    }
  }
}

// Vera's car drives itself: it steers at the current stop and slides around
// buildings instead of ramming them. If it gets properly wedged (a narrow
// alley, a parked truck), it finds a shortcut after a few seconds rather
// than soft-locking the mission.
function driveEscortCar(S, rng, dt, audio) {
  const esc = S.escort;
  if (!esc || !esc.car) return;
  const car = esc.car;
  const P = S.city.places;
  const stop = ESCORT_STOPS[esc.stop];
  const place = P[stop];
  if (!place) return;
  const d = dist(car.x, car.y, place.x, place.y);
  // Stuck detection: if the car has not closed in for 6 seconds, nudge it
  // 100px toward the stop — a shortcut, not a cheat, and the player sees it.
  if (d > (esc.lastD || Infinity) - 2) esc.stuckT += dt;
  else esc.stuckT = 0;
  esc.lastD = d;
  if (esc.stuckT > 6) {
    const a = angleTo(car.x, car.y, place.x, place.y);
    car.x += Math.cos(a) * 100;
    car.y += Math.sin(a) * 100;
    esc.stuckT = 0;
    addMessage(S, 'Vera found a shortcut through the alleys.');
  }
  const want = angleTo(car.x, car.y, place.x, place.y);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
  const nx = car.x + Math.cos(car.angle) * ESCORT_CAR_SPEED * dt;
  const ny = car.y + Math.sin(car.angle) * ESCORT_CAR_SPEED * dt;
  if (!circleHitsBuilding(S.city, nx, ny, 22)) { car.x = nx; car.y = ny; }
  else if (!circleHitsBuilding(S.city, nx, car.y, 22)) { car.x = nx; }
  else if (!circleHitsBuilding(S.city, car.x, ny, 22)) { car.y = ny; }
  car.speed = ESCORT_CAR_SPEED;
  // Ambush at the stop: the first time Vera pulls up, Vipers come out.
  if (d < 110 && !esc.ambushed[esc.stop]) {
    esc.ambushed[esc.stop] = true;
    spawnGang(S, rng, place.x, place.y, 3);
    addMessage(S, `Vipers at ${place.label}! Clear them so Vera can move on.`);
    if (audio) audio.siren();
  }
}

// The escort is done when Vera has visited every stop and the player is
// still with her. Vipers left standing at the last stop do not block it —
// Vera just drives off once the shooting stops mattering.
function escortStopCleared(S) {
  const esc = S.escort;
  const P = S.city.places;
  const stop = ESCORT_STOPS[esc.stop];
  const place = P[stop];
  let vipersNear = 0;
  for (const e of S.enemies) {
    if (!e.dead && dist(e.x, e.y, place.x, place.y) < 200) vipersNear++;
  }
  return vipersNear === 0;
}

function cleanupEscort(S) {
  if (!S.escort) return;
  const i = S.cars.indexOf(S.escort.car);
  if (i >= 0) S.cars.splice(i, 1);
  S.escort = null;
}

export function updateMission78(S, rng, dt, audio, hooks) {
  const m = S.mission;
  if (!m.active) return;
  if (m.bannerT > 0) m.bannerT -= dt;
  // The vault timer is the only clock in these two missions.
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      if (m.index === 7) {
        cleanupEscort(S);
        return hooks.fail('Out of time — the vault job went cold.');
      }
    }
  }
  if (m.index === 6) {
    // ---- Mission 7: Vera's Escort ----
    if (m.stage === 0) {
      const t = m.target;
      if (t && dist(S.player.x, S.player.y, t.x, t.y) < 90) {
        m.stage = 1;
        setupMission78(S, rng, audio);
        if (audio) audio.pickup();
      }
      return;
    }
    // Stage 1: Vera is driving; the player is her shadow.
    const esc = S.escort;
    if (!esc || !esc.car) return;
    if (esc.car.hp <= 0 || esc.car.dead) {
      cleanupEscort(S);
      return hooks.fail('Vera\'s car got totalled — the escort is over.');
    }
    driveEscortCar(S, rng, dt, audio);
    // Stay close: drifting too far for too long loses the escort.
    const pd = dist(S.player.x, S.player.y, esc.car.x, esc.car.y);
    if (pd > ESCORT_MAX_DIST) {
      esc.lostT += dt;
      m.objective = `Get back to Vera! (${Math.ceil(ESCORT_LOST_TIME - esc.lostT)}s)`;
      if (esc.lostT >= ESCORT_LOST_TIME) {
        cleanupEscort(S);
        return hooks.fail('You lost Vera in the city — she went dark.');
      }
    } else {
      esc.lostT = 0;
      const P = S.city.places;
      const stop = ESCORT_STOPS[esc.stop];
      m.objective = `Escort Vera to ${P[stop].label} — stay close, keep her car alive`;
    }
    // Vera rolls on once the stop is clear of Vipers.
    const P = S.city.places;
    const stop = ESCORT_STOPS[esc.stop];
    const place = P[stop];
    if (dist(esc.car.x, esc.car.y, place.x, place.y) < 110 && escortStopCleared(S)) {
      esc.stop++;
      if (esc.stop >= ESCORT_STOPS.length) {
        addMessage(S, 'Vera: "We made it, Rook. The whole city saw us roll in together."');
        cleanupEscort(S);
        return hooks.complete();
      }
      setupMission78(S, rng, audio);
    }
    return;
  }
  if (m.index === 7) {
    // ---- Mission 8: The Vault Job ----
    const t = m.target;
    if (!t) return;
    const d = dist(S.player.x, S.player.y, t.x, t.y);
    if (m.stage === 0) {
      if (d < 90) {
        m.stage = 1;
        setupMission78(S, rng, audio);
      }
      return;
    }
    if (m.stage === 1) {
      // Cracking the vault: standing by the bank fills the crack meter.
      // Step away and the meter drains — the crew cannot work alone.
      if (d < 110) {
        m.crackT = (m.crackT || 0) + dt;
        m.objective = `Crack the vault — stay by the bank! (${Math.ceil(VAULT_CRACK_TIME - m.crackT)}s)`;
        if (Math.random() < dt * 2 && audio) audio.vaultTick();
        if (m.crackT >= VAULT_CRACK_TIME) {
          m.stage = 2;
          addMoney(S, 300, 'vault cash grabbed');
          raiseWanted(S, 4, 'The vault is open — every cop in Solmar Bay is coming!');
          setupMission78(S, rng, audio);
          if (audio) audio.cash();
        }
      } else {
        m.crackT = Math.max(0, (m.crackT || 0) - dt * 0.5);
        m.objective = `Get back to the bank — the crack is stalling! (${Math.ceil(VAULT_CRACK_TIME - (m.crackT || 0))}s left)`;
      }
      return;
    }
    if (m.stage === 2) {
      if (d < 90 && S.wanted <= 1) return hooks.complete();
      if (d < 90) {
        m.objective = 'Too hot! Lose the cops first (get wanted to 1★ or less), then reach the Safehouse.';
      }
      return;
    }
  }
}

// Vera's car health bar, drawn by the HUD while mission 7 is running.
export function escortStatus(S) {
  if (!S.escort || !S.escort.car) return null;
  return {
    hp: Math.max(0, Math.ceil(S.escort.car.hp)),
    stop: S.escort.stop + 1,
    stops: ESCORT_STOPS.length,
  };
}
