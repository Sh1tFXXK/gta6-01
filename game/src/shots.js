// Deterministic screenshot scenes for Solmar Nights 3D.
// ?shot=chase | drive | mission | start, with &seed=<n>.
// Each scene stages a live moment; autopilot keeps the car rolling so
// the frame is alive instead of a frozen pose.

import { S } from './state.js';
import { spawnCar } from './vehicles.js';
import { startMission } from './missions.js';
import { DIALOGUE } from './config.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seed = Number(q.get('seed') || 1);
  return shot ? { name: shot, seed } : null;
}

export function applyShot(shot) {
  S.shot = shot;
  S.seed = shot.seed || 1;
  if (shot.name === 'start') {
    S.mode = 'title';
    S.player.x = 0; S.player.z = -440; S.player.heading = 0;
    S.camYaw = Math.PI;
    return;
  }
  S.mode = 'play';
  S.autopilot = true;
  if (shot.name === 'chase') {
    // Shot 1: the chase. Rook in the Comet GT, two cruisers on his tail,
    // Air One overhead, dispatch board lit, Vera on the line.
    const car = spawnCar('comet', 0, 60, 0, { driver: 'player' });
    S.player.car = car; S.player.onFoot = false;
    S.player.x = 0; S.player.z = 60;
    car.speed = 34;
    S.wanted = 3; S.wantedHeat = 100;
    S.money = 1840;
    S.dialogue = { name: 'SBPD DISPATCH', line: DIALOGUE.chase[1], t: 30 };
    S.objective = 'LOSE THE HEAT — Air One has you in the light';
    S.clockMin = 18 * 60 + 5;
    spawnCar('police', -4, 18, 0, { cop: true, driver: 'cop' });
    S.cops.push({ inCar: true, car: S.cars[S.cars.length - 1], x: -4, z: 18, heading: 0, mesh: null, speed: 30 });
    spawnCar('police', 5, 2, 0, { cop: true, driver: 'cop' });
    S.cops.push({ inCar: true, car: S.cars[S.cars.length - 1], x: 5, z: 2, heading: 0, mesh: null, speed: 30 });
    // Roadblock ahead, so the chase reads in the first frame.
    spawnCar('police', 0, 170, Math.PI, { cop: true, driver: 'cop' });
    S.cops.push({ inCar: true, car: S.cars[S.cars.length - 1], x: 0, z: 170, heading: Math.PI, mesh: null, speed: 0 });
  } else if (shot.name === 'drive') {
    // Shot 2: golden-hour cruise down Strand in the Vireo GT.
    const car = spawnCar('sports', 200, -300, Math.PI / 2, { driver: 'player' });
    S.player.car = car; S.player.onFoot = false;
    S.player.x = 200; S.player.z = -300;
    car.speed = 30;
    S.money = 920;
    S.clockMin = 18 * 60 + 40;
    S.objective = 'Free roam — Solmar Bay is yours tonight';
  } else if (shot.name === 'mission') {
    // Shot 3: Package Run live — waypoint beacon over the Plaza.
    const car = spawnCar('sedan', 100, 150, Math.PI, { driver: 'player' });
    S.player.car = car; S.player.onFoot = false;
    S.player.x = 100; S.player.z = 150;
    car.speed = 22;
    S.money = 640;
    startMission(2);
    S.dialogue = { name: 'VERA SOLANO', line: 'Pick up the package at the Plaza and drop it at the Marina. Fast.', t: 30 };
  }
}

// Autopilot for shot scenes: hold the throttle, steer gently to stay on
// the street the car started on.
export function autopilotInput() {
  const car = S.player.car;
  if (!car) return { f: 0, s: 0 };
  // Steer toward the nearest street centre line.
  const rx = Math.round(car.x / 100) * 100;
  const rz = Math.round(car.z / 100) * 100;
  const onXStreet = Math.abs(car.x - rx) < Math.abs(car.z - rz);
  let steer = 0;
  if (onXStreet) {
    // travelling along z on street x=rx
    const err = car.x - rx;
    const want = car.heading > Math.PI / 2 && car.heading < Math.PI * 1.5 ? Math.PI : 0;
    steer = (err > 1 ? -0.4 : err < -1 ? 0.4 : 0) * (Math.cos(car.heading) >= 0 ? 1 : -1);
  } else {
    const err = car.z - rz;
    steer = (err > 1 ? 0.4 : err < -1 ? -0.4 : 0) * (Math.sin(car.heading) >= 0 ? 1 : -1);
  }
  return { f: 1, s: steer };
}
