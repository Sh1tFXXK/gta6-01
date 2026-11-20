// races.js — street racing in Solmar Bay. One job: checkpoint races with a
// rival driver, best times, and an unlock chain (win one to open the next).
// Races are started on foot or in a car by pressing V near a start pad.
import { TILE } from './config.js';
import { dist, angleTo, clamp } from './random.js';
import { addMessage, addMoney } from './state.js';
import { makeCar } from './vehicles.js';
import { circleHitsBuilding } from './city.js';

// Three races, each a loop of checkpoints on the road grid. A checkpoint is
// a tile position; driving within 100px of it ticks it off. Rewards grow
// with the difficulty, and each race unlocks only after the previous one
// has a recorded best time.
export const RACE_DEFS = [
  {
    id: 1, name: 'Sunset Sprint', reward: 200, rivalSpeed: 210,
    start: { x: 17 * TILE, y: 25 * TILE },
    checkpoints: [
      { x: 33 * TILE, y: 25 * TILE },
      { x: 33 * TILE, y: 41 * TILE },
      { x: 49 * TILE, y: 41 * TILE },
      { x: 49 * TILE, y: 25 * TILE },
      { x: 33 * TILE, y: 17 * TILE },
    ],
  },
  {
    id: 2, name: 'Dockside Dash', reward: 350, rivalSpeed: 250,
    start: { x: 41 * TILE, y: 49 * TILE },
    checkpoints: [
      { x: 41 * TILE, y: 33 * TILE },
      { x: 25 * TILE, y: 33 * TILE },
      { x: 25 * TILE, y: 49 * TILE },
      { x: 57 * TILE, y: 49 * TILE },
      { x: 57 * TILE, y: 33 * TILE },
    ],
  },
  {
    id: 3, name: 'Bay Loop', reward: 600, rivalSpeed: 290,
    start: { x: 9 * TILE, y: 9 * TILE },
    checkpoints: [
      { x: 25 * TILE, y: 9 * TILE },
      { x: 41 * TILE, y: 9 * TILE },
      { x: 57 * TILE, y: 9 * TILE },
      { x: 57 * TILE, y: 25 * TILE },
      { x: 41 * TILE, y: 25 * TILE },
      { x: 25 * TILE, y: 25 * TILE },
    ],
  },
  {
    id: 4, name: 'Midnight Run', reward: 800, rivalSpeed: 320,
    start: { x: 9 * TILE, y: 41 * TILE },
    checkpoints: [
      { x: 9 * TILE, y: 25 * TILE },
      { x: 25 * TILE, y: 41 * TILE },
      { x: 41 * TILE, y: 41 * TILE },
      { x: 57 * TILE, y: 41 * TILE },
      { x: 57 * TILE, y: 57 * TILE },
      { x: 25 * TILE, y: 57 * TILE },
    ],
  },
  {
    id: 5, name: 'Harbor Lights', reward: 1000, rivalSpeed: 340,
    start: { x: 57 * TILE, y: 17 * TILE },
    checkpoints: [
      { x: 57 * TILE, y: 33 * TILE },
      { x: 41 * TILE, y: 33 * TILE },
      { x: 41 * TILE, y: 49 * TILE },
      { x: 25 * TILE, y: 49 * TILE },
      { x: 25 * TILE, y: 17 * TILE },
      { x: 41 * TILE, y: 17 * TILE },
    ],
  },
  {
    id: 6, name: 'Viper Alley', reward: 1200, rivalSpeed: 360,
    start: { x: 17 * TILE, y: 57 * TILE },
    checkpoints: [
      { x: 33 * TILE, y: 57 * TILE },
      { x: 49 * TILE, y: 57 * TILE },
      { x: 49 * TILE, y: 41 * TILE },
      { x: 33 * TILE, y: 25 * TILE },
      { x: 17 * TILE, y: 25 * TILE },
      { x: 17 * TILE, y: 41 * TILE },
    ],
  },
  {
    id: 7, name: 'Sunset Strip', reward: 1500, rivalSpeed: 380,
    start: { x: 25 * TILE, y: 57 * TILE },
    checkpoints: [
      { x: 25 * TILE, y: 41 * TILE },
      { x: 9 * TILE, y: 41 * TILE },
      { x: 9 * TILE, y: 17 * TILE },
      { x: 33 * TILE, y: 17 * TILE },
      { x: 57 * TILE, y: 17 * TILE },
      { x: 57 * TILE, y: 49 * TILE },
    ],
  },
];

// The race state lives on S.race so save/load, the HUD and the renderer can
// all read it without importing each other.
export function initRaces(S) {
  S.race = {
    active: false, def: null, cp: 0, timer: 0, countdown: 0,
    best: {}, rival: null, won: 0, started: false,
  };
}

// Is the player standing on (or driving over) a race start pad?
export function raceAt(S) {
  if (!S.race || S.race.active) return null;
  for (const def of RACE_DEFS) {
    if (dist(S.player.x, S.player.y, def.start.x, def.start.y) < 130) return def;
  }
  return null;
}

// A race unlocks when the previous race has a best time on the board.
export function raceUnlocked(S, def) {
  if (!S.race) return false;
  if (def.id === 1) return true;
  return !!S.race.best[def.id - 1];
}

// Press V near a start pad to line up. The race needs a car — on foot the
// starter just shakes his head and tells you to bring wheels.
export function tryStartRace(S, rng, audio) {
  if (!S.race) initRaces(S);
  if (S.race.active) { addMessage(S, 'Race already running — hit the checkpoints!'); return; }
  const def = raceAt(S);
  if (!def) { addMessage(S, 'No race start here — look for the checkered pad (🏁 on the map).'); return; }
  if (!raceUnlocked(S, def)) {
    addMessage(S, `${def.name} is locked — win race ${def.id - 1} first.`);
    return;
  }
  if (!S.player.inCar) {
    addMessage(S, 'You need a car to race — steal one and come back to the pad.');
    return;
  }
  S.race.active = true;
  S.race.def = def;
  S.race.cp = 0;
  S.race.timer = 0;
  S.race.countdown = 3.2;
  S.race.started = false;
  // The rival talks before the light goes green — and again if he beats
  // the player to the line. It costs nothing and makes losing sting.
  const taunts = [
    'Rival: "Hope that thing has brakes, Rook."',
    'Rival: "I own these streets. Try to keep up."',
    'Rival: "Vera\'s boy thinks he can drive? Cute."',
    'Rival: "Last one to the line buys the coffee."',
  ];
  addMessage(S, taunts[Math.floor(Math.random() * taunts.length)]);
  // The rival lines up beside the player, same road, same direction.
  const rival = makeCar(def.start.x - 60, def.start.y + 40, 0, 'muscle', 'rival');
  rival.cruise = def.rivalSpeed;
  S.cars.push(rival);
  S.race.rival = rival;
  S.mission.banner = `${def.name.toUpperCase()} — GET READY`;
  S.mission.bannerT = 3.2;
  addMessage(S, `${def.name}: ${def.checkpoints.length} checkpoints. Beat the rival, beat the clock.`);
  if (audio) audio.raceBeep();
}

function removeRival(S) {
  if (!S.race.rival) return;
  const i = S.cars.indexOf(S.race.rival);
  if (i >= 0) S.cars.splice(i, 1);
  S.race.rival = null;
}

// The rival is a dumb but determined driver: it steers at the current
// checkpoint and slides around buildings instead of getting stuck on them.
function updateRival(S, dt) {
  const r = S.race.rival;
  if (!r || !S.race.def) return;
  const cps = S.race.def.checkpoints;
  const target = cps[Math.min(S.race.cp, cps.length - 1)];
  const want = angleTo(r.x, r.y, target.x, target.y);
  let diff = want - r.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  r.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  const speed = S.race.def.rivalSpeed;
  const nx = r.x + Math.cos(r.angle) * speed * dt;
  const ny = r.y + Math.sin(r.angle) * speed * dt;
  if (!circleHitsBuilding(S.city, nx, ny, 20)) { r.x = nx; r.y = ny; }
  else if (!circleHitsBuilding(S.city, nx, r.y, 20)) { r.x = nx; }
  else if (!circleHitsBuilding(S.city, r.x, ny, 20)) { r.y = ny; }
  r.speed = speed;
  // The rival also ticks checkpoints off; if it finishes first, it just
  // cruises on — the player can still finish for a smaller payout.
  if (dist(r.x, r.y, target.x, target.y) < 110) {
    r.cp = (r.cp || 0) + 1;
    if (r.cp >= cps.length) { r.finished = true; }
  }
}

export function updateRaces(S, dt, audio) {
  if (!S.race || !S.race.active) return;
  const race = S.race;
  // Countdown: the player can rev but the clock only starts at GO.
  if (race.countdown > 0) {
    const before = Math.ceil(race.countdown);
    race.countdown -= dt;
    const after = Math.ceil(race.countdown);
    if (after < before && after > 0 && audio) audio.raceBeep();
    if (race.countdown <= 0) {
      race.countdown = 0;
      race.started = true;
      S.mission.banner = 'GO!';
      S.mission.bannerT = 1.2;
      if (audio) audio.raceGo();
    }
    return;
  }
  race.timer += dt;
  const def = race.def;
  const cps = def.checkpoints;
  const target = cps[race.cp];
  // Checkpoint reached: chime, move to the next one, or finish the race.
  if (target && dist(S.player.x, S.player.y, target.x, target.y) < 100) {
    race.cp++;
    if (audio) audio.raceCheckpoint();
    if (race.cp >= cps.length) {
      finishRace(S, audio);
      return;
    }
    addMessage(S, `Checkpoint ${race.cp} of ${cps.length} — keep going!`);
  }
  // The rival only drives once the light goes green.
  if (race.started) updateRival(S, dt);
  // Quitting mid-race by getting busted or wasted ends it with no payout.
  if (S.screen !== 'play') endRace(S, false);
}

// Crossing the last checkpoint pays out. Beating the rival doubles the
// reward; a first finish always records the best time for the race. Racing
// after dark pays a 50% night bonus — the streets are emptier, the stakes
// are higher, and the city looks better with its lights on.
function finishRace(S, audio) {
  const race = S.race;
  const def = race.def;
  const rivalDone = race.rival && race.rival.finished;
  let payout = rivalDone ? def.reward : def.reward * 2;
  if (rivalDone) addMessage(S, 'Rival: "Told you. Same time tomorrow, if you dare."');
  const hour = (S.clockMin / 60) % 24;
  const isNight = hour >= 20 || hour < 5;
  if (isNight) payout = Math.round(payout * 1.5);
  const t = race.timer;
  const prev = race.best[def.id];
  const isRecord = !prev || t < prev;
  if (isRecord) race.best[def.id] = Math.round(t * 10) / 10;
  race.won++;
  addMoney(S, payout, `${def.name} ${rivalDone ? '(rival won)' : 'WIN!'} — ${t.toFixed(1)}s${isNight ? ' (night bonus x1.5)' : ''}`);
  S.mission.banner = rivalDone
    ? `${def.name.toUpperCase()} DONE — ${t.toFixed(1)}s`
    : `${def.name.toUpperCase()} — YOU WIN! ${t.toFixed(1)}s`;
  S.mission.bannerT = 5;
  if (isRecord) addMessage(S, `New best time for ${def.name}: ${t.toFixed(1)}s!`);
  if (audio) audio.raceWin();
  removeRival(S);
  race.active = false;
  race.def = null;
  race.cp = 0;
  race.started = false;
}

// Called when a race ends without a finish (busted, wasted, or paused out).
export function endRace(S, finished) {
  if (!S.race || !S.race.active) return;
  if (!finished) addMessage(S, 'Race abandoned — the start pad is still there when you are ready.');
  removeRival(S);
  S.race.active = false;
  S.race.def = null;
  S.race.cp = 0;
  S.race.started = false;
  S.race.countdown = 0;
}

// World-space drawing: start pads, checkpoint rings, and the next-target
// arrow. Called from drawWorld, inside the camera transform.
export function drawRaces(ctx, S) {
  if (!S.race) return;
  // Start pads are always visible so players can find the races.
  for (const def of RACE_DEFS) {
    if (def.start.x < S.cam.x - 100 || def.start.x > S.cam.x + 1280 + 100) continue;
    if (def.start.y < S.cam.y - 100 || def.start.y > S.cam.y + 800 + 100) continue;
    const locked = !raceUnlocked(S, def);
    const pulse = 0.6 + Math.sin(S.time * 3) * 0.2;
    ctx.save();
    ctx.translate(def.start.x, def.start.y);
    ctx.fillStyle = locked ? `rgba(120,120,120,${pulse})` : `rgba(255,255,255,${pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (i % 2 === 0) ctx.fillRect(Math.cos(a) * 22 - 5, Math.sin(a) * 22 - 5, 10, 10);
    }
    ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = locked ? '#999' : '#ffd23f';
    ctx.fillText(locked ? `🔒 RACE ${def.id}` : `🏁 ${def.name.toUpperCase()}`, 0, -40);
    const best = S.race.best[def.id];
    if (best) { ctx.fillStyle = '#fff'; ctx.fillText(`BEST ${best.toFixed(1)}s`, 0, 48); }
    ctx.restore();
  }
  // Active race: the current checkpoint is a big pulsing gold ring, later
  // ones are faint outlines so the route reads at a glance.
  if (!S.race.active || !S.race.def) return;
  const cps = S.race.def.checkpoints;
  for (let i = S.race.cp; i < cps.length; i++) {
    const cp = cps[i];
    const isNext = i === S.race.cp;
    const pulse = isNext ? 1 + Math.sin(S.time * 5) * 0.15 : 1;
    ctx.save();
    ctx.translate(cp.x, cp.y);
    ctx.strokeStyle = isNext ? '#ffd23f' : 'rgba(255,210,63,0.35)';
    ctx.lineWidth = isNext ? 5 : 2;
    ctx.beginPath(); ctx.arc(0, 0, 42 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = isNext ? 'rgba(255,210,63,0.2)' : 'rgba(255,210,63,0.05)';
    ctx.beginPath(); ctx.arc(0, 0, 42 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isNext ? '#ffd23f' : 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 0, 6);
    ctx.restore();
  }
  // Countdown numbers over the player while the light is red.
  if (S.race.countdown > 0) {
    ctx.save();
    ctx.translate(S.player.x, S.player.y - 70);
    ctx.font = 'bold 44px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText(String(Math.ceil(S.race.countdown)), 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}
