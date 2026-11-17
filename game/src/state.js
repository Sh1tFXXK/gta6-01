// state.js — the single shared game state object. One job: hold everything
// the modules read and write, so no module imports another's internals.
import { buildCity } from './city.js';
import { START_MONEY, START_HEALTH, START_AMMO } from './config.js';

export function createState(seed) {
  const city = buildCity(seed);
  return {
    seed, city,
    screen: 'title', // title | play | pause | busted | wasted | missionDone
    time: 0,         // seconds since game start
    clockMin: 8 * 60 + 12, // in-game clock, minutes since midnight
    money: START_MONEY,
    score: 0,
    wanted: 0,
    wantedHeat: 0,   // 0..1, decays when unseen
    cam: { x: 0, y: 0, shake: 0 },
    player: {
      x: 21 * 48, y: 21 * 48, angle: 0, speed: 0,
      health: START_HEALTH, ammo: START_AMMO, inCar: null, onFoot: true,
      punchCd: 0, shootCd: 0, dead: false, name: 'Rook Marlow',
    },
    cars: [],        // traffic + parked + player car (flagged)
    peds: [],
    cops: [],        // on-foot police
    copCars: [],
    bullets: [],
    particles: [],
    pickups: [],     // cash / health / ammo on the ground
    enemies: [],     // gang members for combat missions
    mission: {
      index: 0, active: false, stage: 0, timer: 0, done: false,
      objective: '', target: null, // {x,y,label}
      delivered: 0, kills: 0, passenger: false, banner: '', bannerT: 0,
    },
    taxi: { active: false, fare: null, timer: 0 },
    rampage: { active: false, timer: 0, kills: 0 },
    collect: { total: 0, got: 0 },
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0, cashEarned: 0 },
    messages: [],    // toast lines {text, t}
    autopilot: false, shotName: '',
    flash: 0,
  };
}

export function addMessage(S, text) {
  S.messages.push({ text, t: 4 });
  if (S.messages.length > 4) S.messages.shift();
}
export function addMoney(S, n, why) {
  S.money += n; S.stats.cashEarned += n;
  addMessage(S, `+$${n}  ${why || ''}`);
}
