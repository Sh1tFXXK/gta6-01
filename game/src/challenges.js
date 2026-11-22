// Daily challenges for Solmar Nights 3D: three picked by the date seed
// from a pool of fourteen; they auto-claim the moment they are done.

import { S } from './state.js';
import { CHALLENGE_POOL } from './config.js';
import { hashSeed, shuffle } from './random.js';
import { sfx } from './audio.js';

export function initChallenges() {
  const today = new Date().toISOString().slice(0, 10);
  const rng = shuffle.bind(null, null);
  const seeded = (() => {
    let a = hashSeed(today);
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const picked = shuffle(seeded, CHALLENGE_POOL).slice(0, 3);
  S.challenges = picked.map(c => ({ id: c.id, text: c.text, done: false, check: c.check }));
}

export function updateChallenges() {
  for (const c of S.challenges) {
    if (!c.done && c.check(S)) {
      c.done = true;
      S.money += 75;
      S.banner = { text: 'CHALLENGE DONE', sub: `${c.text} — +$75`, t: 3 };
      sfx.mission();
    }
  }
}
