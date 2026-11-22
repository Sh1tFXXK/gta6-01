// Solmar Nights 3D — entry point. Boots the world, runs the loop,
// wires every key, and keeps the save honest.

import * as THREE from 'three';
import { S, W, saveGame, loadGame, addRespect } from './state.js';
import { initRender, updateSky, updateCamera, nightFactor } from './render.js';
import { buildCity } from './city.js';
import { initPlayer, updatePlayer, tryEnterCar } from './player.js';
import { scatterCars, drivePlayerCar, updateTraffic, updateParticles } from './vehicles.js';
import { scatterPeds, updatePeds } from './pedestrians.js';
import { updatePolice, addWanted } from './police.js';
import { updateCombat, updateTracers, damagePlayer } from './combat.js';
import { updateMissions, tryStartNextMission } from './missions.js';
import { updateMissions2, clearVera } from './missions2.js';
import { updateRaces, tryStartRaceAtPad } from './races.js';
import { initTurfs, updateTurfs } from './territory.js';
import { updateCourier, startCourier } from './courier.js';
import { initChallenges, updateChallenges } from './challenges.js';
import { buildStreetlife, updateStreetlife, tryGarageRepair, tryBuyCoffee } from './streetlife.js';
import { initHud, updateHud } from './hud.js';
import { attachInput, keys, hit, mouse, moveInput, endFrameInput } from './input.js';
import { ensureAudio, setEngine, setSiren, setRain, radioTick, sfx } from './audio.js';
import { parseShot, applyShot, autopilotInput } from './shots.js';
import { RANKS, CREW, RADIO, DIALOGUE } from './config.js';
import { clamp } from './random.js';

let lastT = performance.now();
let frames = 0;
let lastMissionsDone = 0;

function boot() {
  attachInput();
  initRender();
  buildCity();
  scatterCars();
  scatterPeds();
  buildStreetlife();
  initPlayer();
  initTurfs();
  initChallenges();
  initHud();
  const shot = parseShot();
  if (shot) applyShot(shot);
  else S.mode = 'title';
  // Debug / playtest hook: the harness reads window.__S.
  window.__S = S;
  window.__W = W;
  window.__ready = false;
  requestAnimationFrame(loop);
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
  lastT = now;
  frames++;
  if (frames === 5) window.__ready = true;
  window.__shift = !!(keys['ShiftLeft'] || keys['ShiftRight']);

  if (S.mode === 'play') {
    S.time += dt;
    // Clock: one game hour every two real minutes.
    S.clockMin += dt * 0.5;
    if (S.clockMin >= 1440) { S.clockMin -= 1440; S.day++; }
    updateWeather(dt);
    updateCrew(dt);
    updateRank();
    handleKeys(dt);
    // Driving or walking.
    const p = S.player;
    if (p.car) {
      const input = S.autopilot ? autopilotInput() : moveInput();
      drivePlayerCar(p.car, input, dt);
      setEngine(Math.abs(p.car.speed) * 3.6, true);
    } else {
      updatePlayer(dt);
      setEngine(0, false);
    }
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateCombat(dt);
    updateMissions(dt);
    updateMissions2(dt);
    updateRaces(dt);
    updateTurfs(dt);
    updateCourier(dt);
    updateChallenges();
    updateStreetlife(dt);
    updateParticles(dt);
    updateTracers(dt);
    updateSky(dt);
    setSiren(S.wanted >= 2, S.time);
    setRain(S.weather.rain);
    radioTick(dt);
    // Autosave after a mission completes.
    if (S.missionsDone.length > lastMissionsDone) {
      lastMissionsDone = S.missionsDone.length;
      saveGame();
    }
    // Health / wanted edge cases.
    if (S.health <= 0) S.mode = 'wasted';
  } else if (S.mode === 'title' || S.mode === 'pause') {
    // The city stays alive behind the screens: slow camera drift.
    S.time += dt * 0.2;
    updateSky(dt * 0.2);
    if (S.mode === 'title') {
      const t = performance.now() / 1000;
      W.camera.position.set(Math.sin(t * 0.05) * 120, 42, -420 + Math.cos(t * 0.05) * 40);
      W.camera.lookAt(0, 18, 0);
    }
    handleMenuKeys();
  } else if (S.mode === 'busted' || S.mode === 'wasted' || S.mode === 'complete') {
    handleMenuKeys();
  }

  // Mouse-drag orbit feeds the camera.
  window.__dragDx = (window.__dragDx || 0) + mouse.dx;
  window.__dragDy = (window.__dragDy || 0) + mouse.dy;
  if (S.mode === 'play') updateCamera(dt);
  updateHud(dt);
  document.getElementById('crosshair').style.display = S.mode === 'play' ? 'block' : 'none';
  W.renderer.render(W.scene, W.camera);
  endFrameInput();
}

function updateWeather(dt) {
  const w = S.weather;
  w.rainT -= dt;
  if (w.rainT <= 0) {
    if (w.rain > 0) { w.rain = 0; w.rainT = 50 + Math.random() * 80; }
    else if (Math.random() < dt * 0.02) { w.rain = 1; w.rainT = 30 + Math.random() * 40; }
    else w.rainT = 5;
  }
  if (w.rain > 0 && Math.random() < dt * 0.05) {
    w.thunderT = 0.2;
    sfx.thunder();
  }
  if (w.thunderT > 0) {
    w.thunderT -= dt;
    W.sun.intensity = 4;
  }
}

function updateCrew(dt) {
  for (const id of ['plates', 'fix', 'eyes']) {
    if (S.crewCd[id] > 0) S.crewCd[id] -= dt;
  }
  if (S.eyesT > 0) S.eyesT -= dt;
}

function updateRank() {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (S.rp >= RANKS[i].rp) r = i;
  if (r > S.respectRank) {
    S.respectRank = r;
    S.banner = { text: 'RANK UP — ' + RANKS[r].title, sub: 'New weapons unlocked', t: 3 };
    sfx.unlock();
  }
}

function handleKeys(dt) {
  if (hit('KeyP') || hit('Escape')) { S.mode = 'pause'; setPauseStats(); return; }
  // E: steal / enter / exit a car (handled here so it works while driving).
  if (hit('KeyE')) tryEnterCar();
  if (hit('KeyN')) tryStartNextMission();
  if (hit('KeyV')) tryStartRaceAtPad();
  if (hit('KeyC')) startCourier();
  if (hit('KeyG')) {
    if (S.garageNear) tryGarageRepair();
    else sfx.horn();
  }
  if (hit('KeyB')) tryBuyCoffee();
  if (hit('KeyR')) {
    S.radio.station = (S.radio.station + 1) % RADIO.length;
    S.radio.track = 0; S.radio.trackT = 0;
    sfx.click();
  }
  if (hit('KeyH')) { if (saveGame()) { S.banner = { text: 'SAVED', sub: 'Progress stored', t: 2 }; sfx.pickup(); } }
  if (hit('KeyL')) { if (loadGame()) { S.banner = { text: 'LOADED', sub: 'Save restored', t: 2 }; sfx.pickup(); } }
  // Crew skills.
  if (hit('KeyZ')) useCrew('plates');
  if (hit('KeyX')) useCrew('fix');
  if (hit('KeyF')) useCrew('eyes');
  // Ammo pickups are automatic; debug-freeze guard: never let health go NaN.
  if (!isFinite(S.health)) S.health = 100;
}

function useCrew(id) {
  if ((S.crewCd[id] || 0) > 0) { sfx.fail(); return; }
  const def = CREW.find(c => c.id === id);
  if (id === 'plates') {
    if (S.wanted === 0) { S.banner = { text: 'SWAP PLATES', sub: 'No heat to lose', t: 2 }; return; }
    S.wanted = Math.max(0, S.wanted - 1);
    S.wantedHeat = 100;
    S.banner = { text: 'SWAP PLATES', sub: 'One star gone', t: 2 };
  } else if (id === 'fix') {
    if (!S.player.car) { S.banner = { text: 'QUICK FIX', sub: 'Get in a car first', t: 2 }; return; }
    S.player.car.damage = Math.max(0, S.player.car.damage - 40);
    S.banner = { text: 'QUICK FIX', sub: 'Car repaired 40%', t: 2 };
  } else if (id === 'eyes') {
    S.eyesT = 20;
    S.banner = { text: 'EYES OUT', sub: 'All markers revealed for 20s', t: 2 };
  }
  S.crewCd[id] = def.cd;
  sfx.unlock();
}

function setPauseStats() {
  const el = document.getElementById('pause-stats');
  if (el) {
    const owned = Object.values(S.turfs).filter(t => t.owner === 'player').length;
    el.textContent = `DAY ${S.day} · ${S.missionsDone.length}/8 JOBS · ${owned}/5 TURFS · ${S.rp} RP · ${Math.round(S.stats.kmDriven)} KM DRIVEN`;
  }
}

function handleMenuKeys() {
  if (S.mode === 'title' && (hit('Enter') || hit('NumpadEnter'))) {
    ensureAudio();
    S.mode = 'play';
    S.dialogue = { name: DIALOGUE.intro[0], line: DIALOGUE.intro[1], t: 7 };
    S.objective = 'Press N to start your first job — or just drive';
    return;
  }
  if (S.mode === 'pause' && (hit('KeyP') || hit('Escape'))) { S.mode = 'play'; return; }
  if (S.mode === 'pause' && hit('KeyH')) saveGame();
  if (S.mode === 'pause' && hit('KeyL')) loadGame();
  if (S.mode === 'busted' && hit('Enter')) {
    S.mode = 'play';
    S.health = 100;
    S.player.x = 50; S.player.z = 50; S.player.heading = 0;
    if (S.player.car) { S.player.car.driver = null; S.player.car = null; S.player.onFoot = true; }
    W.playerMesh.visible = true;
  }
  if (S.mode === 'wasted' && hit('Enter')) {
    S.mode = 'play';
    S.health = 100;
    S.money = Math.max(0, S.money - 100);
    S.player.x = 50; S.player.z = 50; S.player.heading = 0;
    if (S.player.car) { S.player.car.driver = null; S.player.car = null; S.player.onFoot = true; }
    W.playerMesh.visible = true;
  }
  if (S.mode === 'complete' && hit('Enter')) S.mode = 'play';
}

boot();
