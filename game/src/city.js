// city.js — builds Solmar Bay: roads, blocks, buildings, parks, beach and water.
// One job: the static city. Collision and lookup helpers live here too.
import { TILE, CITY_TILES, CITY_SIZE, COLORS } from './config.js';
import { makeRng } from './random.js';

const ROAD_STEP = 8;   // roads every 8 tiles, 2 tiles wide
const WATER_START = 60; // tiles >= 60 are sea; 58..59 are sand beach

export function isRoadTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= CITY_TILES || ty >= CITY_TILES) return false;
  return (tx % ROAD_STEP) < 2 || (ty % ROAD_STEP) < 2;
}
export function isWaterTile(tx, ty) { return tx >= WATER_START; }
export function isSandTile(tx, ty) { return tx >= 58 && tx < WATER_START; }

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = []; // {x,y,w,h,color,roof}
  const parks = [];     // {x,y,w,h}
  const roofColors = [COLORS.buildingRoof, COLORS.buildingRoof2, COLORS.buildingRoof3, COLORS.buildingRoof4, '#7fb069'];
  // Blocks: between roads, tiles 2..7, 10..15, ... in each axis.
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 8; by++) {
      const x0 = bx * ROAD_STEP + 2, y0 = by * ROAD_STEP + 2;
      if (x0 + 6 > 58) continue; // keep the beach clear
      if (rng.chance(0.14)) {
        parks.push({ x: x0 * TILE, y: y0 * TILE, w: 6 * TILE, h: 6 * TILE, trees: [] });
        const park = parks[parks.length - 1];
        for (let i = 0; i < 7; i++) park.trees.push({ x: park.x + rng.range(20, 6 * TILE - 20), y: park.y + rng.range(20, 6 * TILE - 20), r: rng.range(8, 14) });
        continue;
      }
      // One or two buildings per block, with a courtyard gap.
      const split = rng.chance(0.55);
      const bw = split ? 2.6 * TILE : 4.6 * TILE;
      buildings.push({
        x: x0 * TILE + 8, y: y0 * TILE + 8, w: bw, h: 4.4 * TILE,
        color: rng.pick(roofColors), hgt: rng.int(2, 5),
      });
      if (split) buildings.push({
        x: x0 * TILE + 8 + 3.1 * TILE, y: y0 * TILE + 8, w: 1.9 * TILE, h: 4.4 * TILE,
        color: rng.pick(roofColors), hgt: rng.int(1, 3),
      });
    }
  }
  // Landmark plazas (open squares, no buildings) — cleared by removing overlaps.
  const plazas = [
    { name: 'Plaza', x: 18 * TILE, y: 18 * TILE, w: 6 * TILE, h: 6 * TILE },
    { name: 'Docks', x: 56 * TILE, y: 50 * TILE, w: 2 * TILE, h: 6 * TILE },
  ];
  for (const p of plazas) {
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y) buildings.splice(i, 1);
    }
  }
  // Stunt ramps: fixed spots on road intersections. Hit one fast and it pays.
  // Each sits on a road tile (tx % 8 < 2 and ty % 8 < 2) so cars can reach it.
  const ramps = [
    { x: 24 * TILE, y: 25 * TILE, label: 'JUMP', cd: 0 },
    { x: 40 * TILE, y: 17 * TILE, label: 'JUMP', cd: 0 },
    { x: 16 * TILE, y: 41 * TILE, label: 'JUMP', cd: 0 },
    { x: 48 * TILE, y: 49 * TILE, label: 'JUMP', cd: 0 },
  ];
  // Named places: fixed, road-adjacent, used by missions and the minimap.
  const places = {
    docks:     { x: 57 * TILE, y: 53 * TILE, label: 'Docks' },
    plaza:     { x: 21 * TILE, y: 21 * TILE, label: 'Plaza' },
    hotel:     { x: 34 * TILE, y: 18 * TILE, label: 'Hotel Solmar' },
    arcade:    { x: 42 * TILE, y: 34 * TILE, label: 'Old Arcade' },
    bank:      { x: 26 * TILE, y: 42 * TILE, label: 'Bay Bank' },
    safehouse: { x: 10 * TILE, y: 50 * TILE, label: 'Safehouse' },
    hospital:  { x: 50 * TILE, y: 10 * TILE, label: 'Hospital' },
    gas:       { x: 34 * TILE, y: 50 * TILE, label: 'Gas Station' },
    pier:      { x: 57 * TILE, y: 10 * TILE, label: 'Pier' },
  };
  return { seed, buildings, parks, plazas, places, ramps, rng };
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}
export function pointBlocked(city, x, y) {
  if (x < 0 || y < 0 || x >= CITY_SIZE || y >= CITY_SIZE) return true;
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (isWaterTile(tx, ty)) return true;
  return buildingAt(city, x, y) !== null;
}
export function circleHitsBuilding(city, x, y, r) {
  return pointBlocked(city, x - r, y) || pointBlocked(city, x + r, y) ||
         pointBlocked(city, x, y - r) || pointBlocked(city, x, y + r) ||
         pointBlocked(city, x, y);
}

// A point on a road centreline, for spawning cars / peds.
export function roadPoint(rng, city) {
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng.chance(0.5);
    const lane = rng.int(0, 7) * ROAD_STEP + TILE;
    const along = rng.range(2 * TILE, CITY_SIZE - 4 * TILE);
    const x = vertical ? lane : along;
    const y = vertical ? along : lane;
    if (isWaterTile(Math.floor(x / TILE), Math.floor(y / TILE))) continue;
    return { x, y, vertical };
  }
  return { x: 9 * TILE, y: 9 * TILE, vertical: true };
}
export function sidewalkPoint(rng, city) {
  for (let tries = 0; tries < 40; tries++) {
    const tx = rng.int(2, 57), ty = rng.int(2, 63);
    if (isRoadTile(tx, ty) || isWaterTile(tx, ty)) continue;
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    if (buildingAt(city, x, y)) continue;
    return { x, y };
  }
  return { x: 9 * TILE, y: 9 * TILE };
}
