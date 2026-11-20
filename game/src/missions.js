// missions.js — the story chain plus side jobs (taxi fares, package collect,
// rampage timer). One job: objectives, progress, success and failure.
import { MISSION_DEFS } from './config.js';
import { dist } from './random.js';
import { addMessage, addMoney } from './state.js';
import { spawnGang } from './combat.js';
import { makeCar } from './vehicles.js';
import { raiseWanted } from './player.js';
import { setupMission78, updateMission78 } from './missions2.js';

export function currentMissionDef(S) { return MISSION_DEFS[S.mission.index] || null; }

export function startMission(S, rng, audio) {
  const def = currentMissionDef(S);
  if (!def) { S.mission.active = false; S.mission.objective = 'All story missions complete — free roam Solmar Bay!'; return; }
  const m = S.mission;
  m.active = true; m.stage = 0; m.delivered = 0; m.kills = 0; m.timer = 0;
  m.passenger = false; m.done = false;
  m.banner = `MISSION: ${def.title}`; m.bannerT = 4;
  addMessage(S, def.briefing);
  if (audio) audio.missionOk();
  // Mission 6 starts hot: the SBPD is already on you when the clock starts.
  if (m.index === 5) {
    raiseWanted(S, 2, 'The SBPD is already on your tail — move!');
    m.timer = 150;
  }
  setupMissionStage(S, rng, audio);
}

function setTarget(S, place, objective) {
  S.mission.target = { x: place.x, y: place.y, label: place.label };
  S.mission.objective = objective;
}

export function setupMissionStage(S, rng, audio) {
  const m = S.mission, P = S.city.places;
  if (m.index === 0) {
    setTarget(S, P.docks, 'Steal any car and drive to the Docks');
  } else if (m.index === 1) {
    const stops = [P.plaza, P.hotel, P.gas];
    setTarget(S, stops[m.stage], `Deliver package ${m.stage + 1} of 3 — ${stops[m.stage].label}`);
  } else if (m.index === 2) {
    if (m.stage === 0) { setTarget(S, P.plaza, 'Get a taxi, then pick up the fare at the Plaza'); m.timer = 150; }
    else setTarget(S, P.hotel, 'Drop the fare at Hotel Solmar — beat the clock!');
  } else if (m.index === 3) {
    if (m.stage === 0) {
      setTarget(S, P.arcade, 'Go to the Old Arcade and take down the Rust Vipers');
      if (S.enemies.length === 0) spawnGang(S, rng, P.arcade.x, P.arcade.y, 4);
    }
  } else if (m.index === 4) {
    if (m.stage === 0) setTarget(S, P.bank, 'Go to Bay Bank and grab the cash');
    else if (m.stage === 1) setTarget(S, P.safehouse, 'Lose the cops — reach the Safehouse!');
  } else if (m.index === 5) {
    // The Last Delivery: three drops on one clock, cops already chasing.
    const stops = [P.gas, P.pier, P.hotel];
    setTarget(S, stops[m.stage], `Drop ${m.stage + 1} of 3 — ${stops[m.stage].label} (${Math.ceil(m.timer)}s left)`);
  } else if (m.index === 6 || m.index === 7) {
    // Round 3: missions 7 (Vera's Escort) and 8 (The Vault Job) live in missions2.js.
    setupMission78(S, rng, audio);
  }
}

export function updateMission(S, rng, dt, audio) {
  const m = S.mission;
  if (!m.active) return;
  // Round 3 missions (7 and 8) run their own update in missions2.js.
  if (m.index >= 6) {
    return updateMission78(S, rng, dt, audio, {
      complete: () => completeMission(S, audio),
      fail: (why) => failMission(S, why, audio),
    });
  }
  if (m.bannerT > 0) m.bannerT -= dt;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      if (m.index === 2) return failMission(S, 'The fare got tired of waiting.', audio);
      if (m.index === 5) return failMission(S, 'Out of time — the drops went cold.', audio);
    }
  }
  const t = m.target;
  if (!t) return;
  const d = dist(S.player.x, S.player.y, t.x, t.y);
  const near = d < 90;
  if (m.index === 0) {
    if (near && S.player.inCar) completeMission(S, audio);
  } else if (m.index === 1) {
    if (near) {
      m.delivered++; addMoney(S, 60, 'package delivered');
      if (audio) audio.cash();
      if (m.delivered >= 3) completeMission(S, audio);
      else { m.stage++; setupMissionStage(S, rng, audio); }
    }
  } else if (m.index === 2) {
    if (m.stage === 0) {
      const inTaxi = S.player.inCar && S.player.inCar.type === 'taxi';
      if (near && inTaxi) {
        m.stage = 1; m.passenger = true; m.timer = 120;
        setupMissionStage(S, rng, audio);
        addMessage(S, 'Fare aboard! "Hotel Solmar, and step on it!"');
        if (audio) audio.pickup();
      } else if (near && !inTaxi) {
        m.objective = 'You need a TAXI for this fare — steal one (yellow car)!';
      }
    } else if (near && m.passenger) {
      addMoney(S, 80, 'fare + tip'); completeMission(S, audio);
    }
  } else if (m.index === 3) {
    if (m.kills >= 4) completeMission(S, audio);
  } else if (m.index === 4) {
    if (m.stage === 0 && near) {
      m.stage = 1; addMoney(S, 200, 'bank cash grabbed');
      raiseWanted(S, 3, 'The bank job is on — the SBPD is coming!');
      setupMissionStage(S, rng, audio);
      if (audio) audio.siren();
    } else if (m.stage === 1 && near && S.wanted <= 1) {
      completeMission(S, audio);
    } else if (m.stage === 1 && near) {
      m.objective = 'Too hot! Lose the cops first (get wanted to 1★ or less), then reach the Safehouse.';
    }
  } else if (m.index === 5) {
    if (near) {
      m.delivered++; addMoney(S, 80, 'drop delivered');
      if (audio) audio.cash();
      if (m.delivered >= 3) completeMission(S, audio);
      else { m.stage++; setupMissionStage(S, rng, audio); }
    }
  }
}

export function completeMission(S, audio) {
  const def = currentMissionDef(S);
  S.mission.active = false; S.mission.done = true;
  S.mission.banner = `MISSION COMPLETE: ${def.title}  +$${def.reward}`;
  S.mission.bannerT = 5;
  S.mission.objective = S.mission.index >= MISSION_DEFS.length - 1
    ? 'Story complete! Free roam Solmar Bay — find the stash, hit the ramps.'
    : 'Mission complete! Press N for the next mission.';
  addMoney(S, def.reward, def.title);
  S.stats.missionsDone++;
  if (audio) audio.missionOk();
  saveGame(S);
}

export function failMission(S, why, audio) {
  S.mission.active = false;
  S.mission.banner = `MISSION FAILED: ${why}`;
  S.mission.bannerT = 5;
  S.mission.objective = 'Mission failed — press N to retry it.';
  if (audio) audio.missionFail();
}

export function nextMission(S, rng, audio) {
  if (S.mission.active) { addMessage(S, 'Finish the current mission first (or press N after it ends).'); return; }
  if (S.mission.done) S.mission.index++;
  const def = currentMissionDef(S);
  if (!def) {
    S.mission.objective = 'All story missions complete — free roam Solmar Bay!';
    addMessage(S, 'You finished the story! Free roam, collect the stash (◆), hit a ramp, start a rampage (R).');
    return;
  }
  startMission(S, rng, audio);
}

// --- Side jobs ------------------------------------------------------------
export function startRampage(S, audio) {
  if (S.rampage.active) return;
  S.rampage.active = true; S.rampage.timer = 60; S.rampage.kills = 0;
  S.mission.banner = 'RAMPAGE! Cause chaos for 60 seconds — every takedown pays $20.';
  S.mission.bannerT = 4;
  raiseWanted(S, 2, 'Rampage started!');
  if (audio) audio.siren();
}
export function updateRampage(S, dt, audio) {
  if (!S.rampage.active) return;
  S.rampage.timer -= dt;
  if (S.rampage.timer <= 0) {
    S.rampage.active = false;
    const pay = S.rampage.kills * 20;
    if (pay > 0) addMoney(S, pay, `rampage: ${S.rampage.kills} takedowns`);
    addMessage(S, `Rampage over — ${S.rampage.kills} takedowns.`);
  }
}
export function startTaxiFare(S, rng) {
  if (S.taxi.active) return;
  const inTaxi = S.player.inCar && S.player.inCar.type === 'taxi';
  if (!inTaxi) { addMessage(S, 'Taxi fares need a taxi — steal a yellow cab first.'); return; }
  S.taxi.active = true;
  S.taxi.fare = { x: S.city.places.hotel.x, y: S.city.places.hotel.y, label: 'Hotel Solmar' };
  S.taxi.timer = 90;
  addMessage(S, 'Fare: "Hotel Solmar, quick!" — 90 seconds.');
}
export function updateTaxiFare(S, dt, audio) {
  if (!S.taxi.active) return;
  S.taxi.timer -= dt;
  if (S.taxi.timer <= 0) { S.taxi.active = false; addMessage(S, 'Fare cancelled — too slow.'); return; }
  if (dist(S.player.x, S.player.y, S.taxi.fare.x, S.taxi.fare.y) < 90) {
    S.taxi.active = false; addMoney(S, 45, 'taxi fare');
    if (audio) audio.cash();
  }
}

// --- Save / load ----------------------------------------------------------
import { SAVE_KEY } from './config.js';
export function saveGame(S) {
  try {
    const data = {
      money: S.money, health: S.player.health, ammo: S.player.ammo,
      x: S.player.x, y: S.player.y, wanted: S.wanted,
      missionIndex: S.mission.index, missionsDone: S.stats.missionsDone,
      carsStolen: S.stats.carsStolen, cashEarned: S.stats.cashEarned,
      day: S.day, stashGot: S.stashGot, stunts: S.stats.stunts,
      // Round 3: race best times and turf income survive a reload.
      raceBest: S.race ? S.race.best : {},
      racesWon: S.race ? S.race.won : 0,
      turfEarned: S.turf ? S.turf.earned : 0,
      turfCaptured: S.turf ? S.turf.captured : 0,
      challengesClaimed: S.daily ? S.daily.claimed : {},
      challengesDay: S.daily ? S.daily.day : 0,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    addMessage(S, 'Game saved.');
  } catch { /* storage unavailable */ }
}
export function loadGame(S) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { addMessage(S, 'No save found yet.'); return false; }
    const d = JSON.parse(raw);
    S.money = d.money; S.player.health = d.health; S.player.ammo = d.ammo;
    S.player.x = d.x; S.player.y = d.y; S.wanted = d.wanted || 0;
    S.mission.index = d.missionIndex || 0;
    S.stats.missionsDone = d.missionsDone || 0;
    S.stats.carsStolen = d.carsStolen || 0;
    S.stats.cashEarned = d.cashEarned || 0;
    S.day = d.day || 1;
    S.stashGot = d.stashGot || 0;
    S.stats.stunts = d.stunts || 0;
    // Round 3 save fields (older saves simply lack them).
    if (S.race) { S.race.best = d.raceBest || {}; S.race.won = d.racesWon || 0; }
    if (S.turf) { S.turf.earned = d.turfEarned || 0; S.turf.captured = d.turfCaptured || 0; }
    // Round 3 challenge progress (same-day saves keep claimed challenges).
    if (S.daily && d.challengesDay === S.daily.day) S.daily.claimed = d.challengesClaimed || {};
    addMessage(S, 'Save loaded. Welcome back to Solmar Bay.');
    return true;
  } catch { addMessage(S, 'Save could not be read.'); return false; }
}
