// challenges.js — daily challenges for Solmar Bay. One job: give free-roam
// players a reason to keep playing after the story ends.
// Every in-game day the board holds three challenges drawn from the pool
// below. Finish one and the payout lands automatically — no menu to open,
// no button to press, just a banner and cash in hand.
// Progress is read straight off the stats the game already tracks, so a
// challenge can never desync from what the player actually did.
import { addMessage, addMoney } from './state.js';

// The pool. Each challenge names the stat it watches, the target to hit,
// and the payout. Targets are deliberately small: a challenge should take
// minutes, not a whole session, and three of them should be finishable in
// one good day of play.
export const CHALLENGE_POOL = [
  { id: 'wheels', name: 'Hot Wheels', desc: 'Steal 3 cars', stat: 'carsStolen', target: 3, reward: 120 },
  { id: 'wheelman', name: 'Wheelman', desc: 'Steal 6 cars', stat: 'carsStolen', target: 6, reward: 250 },
  { id: 'earner', name: 'Earner', desc: 'Earn $500 (all sources)', stat: 'cashEarned', target: 500, reward: 150 },
  { id: 'big-earner', name: 'Big Earner', desc: 'Earn $1500 (all sources)', stat: 'cashEarned', target: 1500, reward: 400 },
  { id: 'stuntman', name: 'Stuntman', desc: 'Land 3 stunt jumps', stat: 'stunts', target: 3, reward: 150 },
  { id: 'daredevil', name: 'Daredevil', desc: 'Land 6 stunt jumps', stat: 'stunts', target: 6, reward: 300 },
  { id: 'hunter', name: 'Treasure Hunter', desc: 'Find 5 stash drops', stat: 'stashGot', target: 5, reward: 200 },
  { id: 'marksman', name: 'Marksman', desc: 'Fire 40 shots', stat: 'shotsFired', target: 40, reward: 100 },
  { id: 'racer', name: 'Street Racer', desc: 'Win a street race', stat: 'racesWon', target: 1, reward: 250 },
  { id: 'turf-lord', name: 'Turf Lord', desc: 'Capture 2 turf zones', stat: 'turfCaptured', target: 2, reward: 350 },
  { id: 'professional', name: 'Professional', desc: 'Finish 3 story missions', stat: 'missionsDone', target: 3, reward: 200 },
  { id: 'legend', name: 'Solmar Legend', desc: 'Finish 6 story missions', stat: 'missionsDone', target: 6, reward: 500 },
  { id: 'courier', name: 'Courier', desc: 'Finish 2 courier gigs', stat: 'courierDone', target: 2, reward: 150 },
  { id: 'king', name: 'King of Solmar', desc: 'Capture 4 turf zones', stat: 'turfCaptured', target: 4, reward: 600 },
];

// Where each stat lives. Most are plain S.stats fields; the round-3 systems
// keep theirs on their own state objects, so the reader knows where to look.
export function challengeProgress(S, def) {
  switch (def.stat) {
    case 'stashGot': return S.stashGot || 0;
    case 'racesWon': return (S.race && S.race.won) || 0;
    case 'turfCaptured': return (S.turf && S.turf.captured) || 0;
    case 'courierDone': return (S.courier && S.courier.done) || 0;
    default: return (S.stats && S.stats[def.stat]) || 0;
  }
}

// Pick three challenges for the day. The pick is seeded by the day number,
// so every player on the same day gets the same board — and so a save/load
// mid-day never re-rolls the board under the player.
export function initChallenges(S) {
  const daySeed = (S.seed || 1) * 31 + (S.day || 1);
  let s = daySeed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pool = [...CHALLENGE_POOL];
  const list = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const pick = Math.floor(rnd() * pool.length);
    list.push(pool.splice(pick, 1)[0]);
  }
  S.daily = {
    day: S.day || 1,
    list,
    claimed: {},
    doneToday: 0,
  };
}

// A new day means a new board. The old board's unclaimed challenges are
// gone — the game says so, so nobody wonders where they went.
export function maybeNewDayChallenges(S) {
  if (!S.daily) { initChallenges(S); return; }
  if (S.daily.day !== S.day) {
    const lost = S.daily.list.filter((c) => !S.daily.claimed[c.id]).length;
    initChallenges(S);
    if (lost > 0) addMessage(S, `New day, new challenges — ${lost} unfinished ${lost > 1 ? 'challenges' : 'challenge'} expired.`);
    else addMessage(S, 'New day, new challenges on the board!');
  }
}

export function updateChallenges(S, dt, audio) {
  if (!S.daily) initChallenges(S);
  maybeNewDayChallenges(S);
  for (const def of S.daily.list) {
    if (S.daily.claimed[def.id]) continue;
    const have = challengeProgress(S, def);
    if (have >= def.target) {
      S.daily.claimed[def.id] = true;
      S.daily.doneToday++;
      addMoney(S, def.reward, `challenge complete: ${def.name}`);
      S.mission.banner = `CHALLENGE DONE: ${def.name.toUpperCase()}  +$${def.reward}`;
      S.mission.bannerT = 4;
      addMessage(S, `Challenge complete — ${def.name}: ${def.desc}. $${def.reward} in the pocket.`);
      if (audio) audio.challengeDone();
    }
  }
}

// The board, for the HUD: one line per challenge, with a progress bar.
// Only the first two lines fit under the status panel, so the HUD shows the
// next unclaimed challenge and a count of the rest.
export function challengeHudLines(S) {
  if (!S.daily) return [];
  const lines = [];
  const open = S.daily.list.filter((c) => !S.daily.claimed[c.id]);
  for (const def of open.slice(0, 1)) {
    const have = Math.min(challengeProgress(S, def), def.target);
    lines.push(`★ ${def.name}: ${have}/${def.target} — ${def.desc} ($${def.reward})`);
  }
  if (open.length > 1) lines.push(`★ +${open.length - 1} more challenge${open.length - 1 > 1 ? 's' : ''} on the board`);
  if (open.length === 0) lines.push('★ All of today\'s challenges done — come back tomorrow!');
  return lines;
}

// Full board text for the pause screen, so players can read all three.
export function challengeBoardText(S) {
  if (!S.daily) return ['No challenges yet — start playing.'];
  return S.daily.list.map((def) => {
    const have = Math.min(challengeProgress(S, def), def.target);
    const mark = S.daily.claimed[def.id] ? '✓' : '·';
    return `${mark} ${def.name}: ${def.desc} — ${have}/${def.target} ($${def.reward})`;
  });
}
