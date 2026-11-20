// main.js — the game loop and state machine for Solmar Nights.
// One job: wire every module together and run the game.
import { VIEW_W, VIEW_H, CITY_SIZE, TILE, MISSION_DEFS } from './config.js';
import { makeRng, clamp } from './random.js';
import { createState, addMessage } from './state.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { updatePlayerOnFoot, exitCar, tryEnterCar, raiseWanted } from './player.js';
import { spawnTraffic, spawnParkedCars, updateTraffic, updatePlayerCar, collideCars } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { fireBullet, updateBullets, updateEnemies, updatePickups, spawnPickups, spawnStash } from './combat.js';
import { nextMission, updateMission, startRampage, updateRampage, startTaxiFare, updateTaxiFare, saveGame, loadGame } from './missions.js';
import { initRaces, tryStartRace, updateRaces } from './races.js';
import { initTerritory, updateTerritory } from './territory.js';
import { spawnStreetLife, spawnStreetPickups, buyCoffee } from './streetlife.js';
import { initChallenges, updateChallenges } from './challenges.js';
import { drawHUD, drawMinimap } from './hud.js';
import { drawWorld, drawTitle, drawPause, drawEndScreen, drawMissionDone } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W; canvas.height = VIEW_H;
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shot = params.get('shot') || '';
const rng = makeRng(seed * 7919 + 13);

const S = createState(seed);
const input = createInput(canvas);
const audio = createAudio();
window.__solmar = S; // exposed for play-testing from the console

// World population.
spawnTraffic(S, rng, 16);
spawnParkedCars(S, rng, 12);
spawnPeds(S, rng, 26);
spawnPickups(S, rng, 12);
spawnStash(S, rng);
// Round 3: race pads, turf zones and the new street life join the city.
initRaces(S); initTerritory(S);
spawnStreetLife(S, rng); spawnStreetPickups(S, rng, 10);
initChallenges(S);
S.mission.objective = 'Press N to start your first mission — Vera has work for you.';
S.player.x = 21 * TILE; S.player.y = 21 * TILE;

if (shot) {
  applyShot(S, shot, makeRng(seed * 7919 + 13));
  if (S.screen === 'play') audio.startMusic();
}

function startGame() {
  S.screen = 'play';
  audio.unlock(); audio.startMusic();
  addMessage(S, 'Welcome to Solmar Bay. Press N for your first job.');
  statusEl.textContent = 'Solmar Nights: playing in Solmar Bay.';
}

function restart() {
  const fresh = createState(seed);
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, fresh);
  spawnTraffic(S, rng, 16); spawnParkedCars(S, rng, 12); spawnPeds(S, rng, 26); spawnPickups(S, rng, 12);
  spawnStash(S, rng);
  // Round 3 systems restart with the world.
  initRaces(S); initTerritory(S);
  spawnStreetLife(S, rng); spawnStreetPickups(S, rng, 10);
  initChallenges(S);
  S.mission.objective = 'Press N to start your first mission — Vera has work for you.';
  S.screen = 'play';
}

function updateCamera(dt) {
  const tx = clamp(S.player.x - VIEW_W / 2, 0, CITY_SIZE - VIEW_W);
  const ty = clamp(S.player.y - VIEW_H / 2, 0, CITY_SIZE - VIEW_H);
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 5);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 5);
  S.cam.shake = Math.max(0, S.cam.shake - dt * 30);
  S.flash = Math.max(0, S.flash - dt);
}

// Weather: clear skies, then rain showers roll in and out on their own timer.
// The first change comes after ~50 seconds, so screenshot scenes stay dry.
function updateWeather(dt, audio) {
  const w = S.weather;
  w.t -= dt;
  if (w.t <= 0) {
    const raining = Math.random() < 0.4;
    w.kind = raining ? 'rain' : 'clear';
    w.t = 40 + Math.random() * 50;
    w.intensity = raining ? 0.6 + Math.random() * 0.4 : 0;
    if (audio) audio.setRain(raining);
    if (raining) {
      addMessage(S, 'Rain rolling in over Solmar Bay.');
      if (audio && Math.random() < 0.5) audio.thunder();
    }
  }
}

function autopilotDrive(S, dt) {
  // Screenshot autopilot: the player car cruises forward along the road.
  const car = S.player.inCar;
  if (!car) return;
  car.speed = Math.min(car.speed + 120 * dt, 260);
  car.angle += Math.sin(S.time * 0.3) * 0.12 * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  S.player.x = car.x; S.player.y = car.y;
}

function step(dt) {
  S.time += dt;
  S.clockMin += dt * 0.6; // a game hour every ~100 real seconds
  if (S.clockMin >= 1440) { S.clockMin -= 1440; S.day++; addMessage(S, `Day ${S.day} in Solmar Bay.`); }
  updateWeather(dt, audio);
  for (const m of S.messages) m.t -= dt;
  S.messages = S.messages.filter((m) => m.t > 0);
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const pt = S.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) S.particles.splice(i, 1);
  }
  if (S.screen !== 'play') return;
  // Global keys.
  if (input.consume('p') || input.consume('escape')) { S.screen = 'pause'; return; }
  if (input.consume('m')) { const on = audio.toggleMute(); addMessage(S, on ? 'Sound on' : 'Sound muted'); }
  if (input.consume('h')) saveGame(S);
  if (input.consume('l')) loadGame(S);
  if (input.consume('n')) nextMission(S, rng, audio);
  if (input.consume('r')) startRampage(S, audio);
  if (input.consume('t')) startTaxiFare(S, rng);
  if (input.consume('v')) tryStartRace(S, rng, audio);
  if (input.consume('b')) buyCoffee(S, audio);
  if (input.consume('g') && S.player.inCar) audio.horn();
  if (S.player.inCar && input.consume('e')) exitCar(S);
  if (S.autopilot) autopilotDrive(S, dt);
  if (S.player.inCar) updatePlayerCar(S, input, dt, audio);
  else updatePlayerOnFoot(S, input, dt, audio);
  // Shooting (mouse) — on foot or drive-by from the car.
  S.player.shootCd = Math.max(0, (S.player.shootCd || 0) - dt);
  if (input.mouse.down && S.player.shootCd <= 0 && S.screen === 'play') {
    const fromCar = !!S.player.inCar;
    const ang = fromCar ? S.player.angle : (S.player.aimAngle ?? 0);
    const fx = S.player.x + Math.cos(ang) * 26, fy = S.player.y + Math.sin(ang) * 26;
    fireBullet(S, fx, fy, ang, true, audio);
    S.player.shootCd = fromCar ? 0.28 : 0.22;
    if (S.wanted < 1 && Math.random() < 0.3) { S.wanted = 1; S.wantedHeat = 1; addMessage(S, 'Shots fired — someone called the SBPD!'); }
  }
  updateTraffic(S, rng, dt, audio);
  updatePeds(S, rng, dt);
  updatePolice(S, rng, dt, audio);
  updateBullets(S, dt, audio);
  updateEnemies(S, dt, audio);
  updatePickups(S, dt, audio);
  updateMission(S, rng, dt, audio);
  updateRampage(S, dt, audio);
  updateTaxiFare(S, dt, audio);
  // Round 3 systems tick with the rest of the city.
  updateRaces(S, dt, audio);
  updateTerritory(S, rng, dt, audio);
  updateChallenges(S, dt, audio);
  collideCars(S, dt, audio);
  // Respawn traffic / peds that wandered off, keeping the city alive.
  if (S.cars.filter((c) => c.driver === 'traffic').length < 10) spawnTraffic(S, rng, 4);
  if (S.peds.length < 16) spawnPeds(S, rng, 6);
  updateCamera(dt);
  if (S.screen === 'play' && S.mission.index >= MISSION_DEFS.length && !S.mission.active && S.stats.missionsDone >= MISSION_DEFS.length) {
    S.screen = 'storyDone';
  }
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (S.screen === 'title') { drawTitle(ctx, S); return; }
  drawWorld(ctx, S);
  drawHUD(ctx, S);
  drawMinimap(ctx, S);
  if (S.screen === 'pause') drawPause(ctx, S);
  else if (S.screen === 'busted' || S.screen === 'wasted') drawEndScreen(ctx, S, S.screen);
  else if (S.screen === 'storyDone') drawMissionDone(ctx, S);
}

// Title / menu input.
function menuKeys() {
  if (S.screen === 'title') {
    if (input.consume('enter') || input.mouse.clicked) startGame();
    if (input.consume('l')) { if (loadGame(S)) S.screen = 'play'; }
  } else if (S.screen === 'pause') {
    if (input.consume('p') || input.consume('escape')) S.screen = 'play';
    if (input.consume('h')) saveGame(S);
    if (input.consume('l')) { loadGame(S); S.screen = 'play'; }
    if (input.consume('enter')) restart();
  } else if (S.screen === 'busted' || S.screen === 'wasted') {
    if (input.consume('enter')) {
      if (S.screen === 'busted') S.money = Math.max(0, S.money - 200);
      restart();
    }
  } else if (S.screen === 'storyDone') {
    if (input.consume('enter')) S.screen = 'play';
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  menuKeys();
  step(dt);
  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
