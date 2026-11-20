// shots.js — deterministic screenshot scenes for ?shot= URLs.
// One job: set up each named shot so the screenshot reliably shows the game.
// Each scene uses the seeded city, places the player and traffic in view, and
// turns on a light autopilot (traffic, peds and the player car keep moving).
import { TILE } from './config.js';
import { makeRng } from './random.js';
import { makeCar, spawnTraffic, spawnParkedCars } from './vehicles.js';
import { spawnPeds } from './pedestrians.js';
import { spawnGang } from './combat.js';
import { spawnCopCar } from './police.js';
import { startMission } from './missions.js';

function baseScene(S, rng) {
  S.cars = []; S.peds = []; S.cops = []; S.copCars = []; S.bullets = [];
  S.enemies = []; S.pickups = [];
  spawnTraffic(S, rng, 14);
  spawnParkedCars(S, rng, 10);
  spawnPeds(S, rng, 18);
  S.pickups.push({ x: 24 * TILE, y: 20 * TILE, kind: 'cash', value: 50, bob: 0 });
  S.pickups.push({ x: 26 * TILE, y: 20 * TILE, kind: 'health', value: 0, bob: 0 });
  S.pickups.push({ x: 28 * TILE, y: 20 * TILE, kind: 'ammo', value: 0, bob: 0 });
  // A stash drop in view, so the shot shows the new collectible too.
  S.pickups.push({ x: 22 * TILE, y: 22 * TILE, kind: 'stash', value: 100, bob: 0 });
  // Clear morning light for every shot — no night veil, no rain.
  S.weather = { kind: 'clear', t: 60, intensity: 0 };
}

// A few traffic cars on the same road near (x, y), so the shot shows traffic.
// Kept well clear of the HUD panels: the first car starts 320px ahead, so
// no taxi ever sits half-hidden under the top-left status panel.
function nearbyTraffic(S, x, y, angle, n) {
  const types = ['sedan', 'taxi', 'truck', 'van'];
  for (let i = 0; i < n; i++) {
    const along = 320 + i * 170;
    const c = makeCar(x + Math.cos(angle) * along, y + Math.sin(angle) * along, angle, types[i % types.length], 'traffic');
    c.speed = 110 + i * 20; c.cruise = 130;
    S.cars.push(c);
  }
}

export function applyShot(S, name, rng) {
  S.autopilot = true; S.shotName = name;
  S.screen = 'play';
  if (name === 'start') {
    S.screen = 'title';
    S.autopilot = false;
    return;
  }
  baseScene(S, rng);
  const P = S.city.places;
  if (name === 'drive') {
    // Player driving a sports car down a main road, traffic ahead, HUD + minimap on.
    // A stunt ramp sits 7 tiles ahead on this road — the autopilot crosses it.
    const car = makeCar(17 * TILE, 25 * TILE, 0, 'sports', 'player');
    car.speed = 260;
    S.cars.push(car);
    nearbyTraffic(S, car.x, car.y, 0, 3);
    S.player.inCar = car; S.player.x = car.x; S.player.y = car.y;
    S.player.health = 100; S.player.ammo = 60; S.money = 1240;
    S.mission.objective = 'Free roam — press N to start the next mission. Collect the $ pickups!';
    S.mission.active = false;
    S.cam.x = car.x - 640; S.cam.y = car.y - 400;
  } else if (name === 'chase') {
    const car = makeCar(25 * TILE, 33 * TILE, Math.PI / 2, 'sedan', 'player');
    car.speed = 300;
    S.cars.push(car);
    nearbyTraffic(S, car.x, car.y, Math.PI / 2, 2);
    S.player.inCar = car; S.player.x = car.x; S.player.y = car.y;
    S.player.health = 78; S.player.ammo = 42; S.money = 1875;
    S.wanted = 3; S.wantedHeat = 1;
    spawnCopCar(S, rng); spawnCopCar(S, rng);
    // Put the cop cars right behind the player so the chase is in frame.
    S.copCars[0].x = car.x - 60; S.copCars[0].y = car.y - 140; S.copCars[0].angle = Math.PI / 2; S.copCars[0].speed = 320;
    if (S.copCars[1]) { S.copCars[1].x = car.x + 150; S.copCars[1].y = car.y - 60; S.copCars[1].angle = Math.PI / 2; S.copCars[1].speed = 310; }
    S.cops.push({ x: car.x + 200, y: car.y + 80, angle: 0, speed: 150, hp: 100, bustT: 0 });
    S.mission.objective = 'Lose the cops! Drive fast and break line of sight.';
    S.mission.banner = 'WANTED ★★★ — the SBPD is on you!';
    S.mission.bannerT = 99;
    S.cam.x = car.x - 640; S.cam.y = car.y - 400;
  } else if (name === 'mission') {
    // Mission 2 (Package Run) in progress, on foot with a car nearby, marker visible.
    S.player.x = 22 * TILE; S.player.y = 19 * TILE;
    S.player.health = 92; S.player.ammo = 48; S.money = 640;
    S.mission.index = 1; S.mission.done = false;
    startMission(S, rng, null);
    const car = makeCar(22 * TILE + 40, 19 * TILE + 60, 0, 'taxi', null);
    S.cars.push(car);
    spawnGang(S, rng, P.arcade.x, P.arcade.y, 2);
    S.cam.x = S.player.x - 640; S.cam.y = S.player.y - 400;
  }
  // Keep the camera centred on the player for every play shot.
  S.cam.x = Math.max(0, Math.min(S.player.x - 640, 3072 - 1280));
  S.cam.y = Math.max(0, Math.min(S.player.y - 400, 3072 - 800));
}
