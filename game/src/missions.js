// Story missions 1–5 for Solmar Nights 3D, plus the generic stage engine:
// goto / pickup / kill / crack / escape stages with waypoint beacons.

import { S, W } from './state.js';
import { MISSION_DEFS, GARAGE } from './config.js';
import { dist2d, fmtTime } from './random.js';
import { sfx } from './audio.js';
import { setWaypoint } from './render.js';
import { spawnGang } from './combat.js';
import { addWanted } from './police.js';
import { addRespect } from './state.js';
import { spawnCar, nearestCar } from './vehicles.js';

export const MISSION_STAGES = {
  1: [ // First Wheels
    { type: 'steal', text: 'Steal a car (press E near one)' },
    { type: 'goto', x: -350, z: 300, r: 14, text: 'Drive it to the Docks' },
  ],
  2: [ // Package Run
    { type: 'goto', x: 50, z: -50, r: 10, text: 'Pick up the package at Solmar Plaza' },
    { type: 'goto', x: 350, z: -300, r: 10, text: 'Deliver it to Marina Row', timer: 120 },
  ],
  3: [ // Taxi Rush
    { type: 'taxi', text: 'Get into a taxi (yellow cab)' },
    { type: 'goto', x: 250, z: 200, r: 10, text: 'Pick up the fare on Kumala Strand' },
    { type: 'goto', x: 100, z: -150, r: 10, text: 'Drop them at the hotel', timer: 90 },
  ],
  4: [ // Gang Trouble
    { type: 'spawn', n: 4, x: -350, z: 300, text: 'Vipers at the Docks — drop 4' },
    { type: 'kill', n: 4, text: 'Vipers down: 0/4' },
  ],
  5: [ // The Big Score
    { type: 'goto', x: -50, z: -100, r: 10, text: 'Reach the bank on Old Market' },
    { type: 'crack', x: -50, z: -100, secs: 18, text: 'Crack the vault — stay in the circle' },
    { type: 'escape', text: 'Lose the heat, then reach the Safehouse' },
  ],
};

export const MISSION_REWARDS = { 1: 150, 2: 250, 3: 300, 4: 400, 5: 800, 6: 600, 7: 700, 8: 1000 };

export function startMission(id) {
  const def = MISSION_DEFS.find(m => m.id === id);
  if (!def || S.missionsDone.includes(id) || S.mission) return false;
  const stages = MISSION_STAGES[id];
  if (!stages) return false;
  S.mission = { id, stage: 0, t: 0, data: {}, stages };
  S.dialogue = { name: def.giver, line: def.brief, t: 6 };
  S.objective = `JOB ${id}/8 — ${def.name}`;
  sfx.mission();
  if (id === 6) S.wanted = Math.max(S.wanted, 2); // M6 starts hot
  return true;
}

export function missionTarget() {
  if (!S.mission) return null;
  const st = S.mission.stages[S.mission.stage];
  if (!st) return null;
  if (st.type === 'goto' || st.type === 'crack' || st.type === 'spawn') return { x: st.x, z: st.z };
  return null;
}

export function updateMissions(dt) {
  const m = S.mission;
  if (!m) { setWaypoint(0, 0, false); return; }
  const st = m.stages[m.stage];
  if (!st) { completeMission(); return; }
  const p = S.player;
  const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
  m.t += dt;
  S.objective = `JOB ${m.id}/8 — ${st.text}`;
  const target = missionTarget();
  if (target) setWaypoint(target.x, target.z, true);
  else setWaypoint(0, 0, false);

  switch (st.type) {
    case 'steal':
      if (p.car) nextStage();
      break;
    case 'taxi':
      if (p.car && p.car.type === 'taxi') nextStage();
      break;
    case 'goto': {
      const d = dist2d(px, pz, st.x, st.z);
      if (st.timer && m.t > st.timer) { failMission('Too slow — the job went cold.'); return; }
      if (d < st.r) { sfx.pickup(); nextStage(); }
      break;
    }
    case 'spawn':
      spawnGang(st.x, st.z, st.n);
      m.data.need = st.n;
      m.data.startVipers = S.stats.vipersDown;
      nextStage();
      break;
    case 'kill': {
      const down = S.stats.vipersDown - (m.data.startVipers || 0);
      st.text = `Vipers down: ${down}/${m.data.need}`;
      if (down >= m.data.need) nextStage();
      break;
    }
    case 'crack': {
      const d = dist2d(px, pz, st.x ?? -50, st.z ?? -100);
      if (d < 12) {
        m.data.crack = (m.data.crack || 0) + dt;
        st.text = `Cracking the vault… ${Math.ceil(st.secs - m.data.crack)}s`;
        if (m.data.crack >= st.secs) { addWanted(3); nextStage(); }
      } else {
        st.text = 'Get back to the vault circle!';
      }
      break;
    }
    case 'escape': {
      if (S.wanted <= 1 && dist2d(px, pz, 450, 400) < 16) { nextStage(); return; }
      if (S.wanted <= 1) {
        // Safehouse beacon at North Hills.
        setWaypoint(450, 400, true);
        st.text = 'Heat is low — reach the Safehouse (north-east)';
      } else {
        setWaypoint(0, 0, false);
        st.text = `Lose the heat first — wanted ${S.wanted}★`;
      }
      break;
    }
    case 'wait':
      if (m.t > (st.secs || 5)) nextStage();
      break;
  }
  // Mission timer display.
  const timed = m.stages[m.stage];
  if (timed && timed.timer) {
    S.missionClock = Math.max(0, timed.timer - m.t);
  } else S.missionClock = 0;
}

export function nextStage() {
  S.mission.stage++;
  S.mission.t = 0;
  sfx.pickup();
}

export function completeMission() {
  const id = S.mission.id;
  const reward = MISSION_REWARDS[id] || 200;
  S.money += reward;
  addRespect(reward);
  S.missionsDone.push(id);
  if (S.clockMin >= 20 * 60 || S.clockMin < 6 * 60) S.stats.nightJobs++;
  S.banner = { text: 'JOB COMPLETE', sub: `+$${reward}  •  +${reward} RP`, t: 3 };
  sfx.mission();
  S.mission = null;
  setWaypoint(0, 0, false);
  if (S.missionsDone.length >= 8) {
    S.mode = 'complete';
    S.banner = { text: 'SOLMAR NIGHTS — STORY COMPLETE', sub: 'Rook owns the Bay now', t: 6 };
  }
}

export function failMission(reason) {
  S.banner = { text: 'JOB FAILED', sub: reason, t: 3 };
  sfx.fail();
  S.mission = null;
  setWaypoint(0, 0, false);
}

// N starts the next available story mission.
export function tryStartNextMission() {
  if (S.mission) return;
  for (let id = 1; id <= 8; id++) {
    if (!S.missionsDone.includes(id)) { startMission(id); return; }
  }
}
