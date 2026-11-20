// streetlife.js — new faces and new rides for Solmar Bay. One job: make the
// city feel bigger without touching the old systems.
//   * Two new cars (a long limo and a pickup truck) join traffic and parking.
//   * Three new pedestrian kinds: joggers who run the beach road, tourists
//     who stroll and gawp, and a street vendor who never moves from his cart.
//   * Three new pickups: a wrench (repairs your car), a coffee (refills
//     sprint stamina) and a briefcase (a little walking-around money).
// Pickup effects live in combat.js (updatePickups) and their drawing in
// render.js (drawPickups); this file only spawns them.
import { TILE } from './config.js';
import { addMessage } from './state.js';
import { sidewalkPoint } from './city.js';
import { makeCar } from './vehicles.js';

// Special pedestrians are ordinary peds with a kind flag and tuned speed, so
// updatePeds already knows how to walk them, flee them and despawn them.
// The kind only changes how they look and how fast they move.
export const STREET_PED_KINDS = {
  jogger: { speed: 95, shirt: '#ff6b6b', name: 'Jogger' },
  tourist: { speed: 26, shirt: '#f5c518', name: 'Tourist' },
  vendor: { speed: 0, shirt: '#2ecc71', name: 'Vendor' },
};

function spawnSpecialPed(S, rng, kind) {
  const spec = STREET_PED_KINDS[kind];
  const p = sidewalkPoint(rng, S.city);
  const ped = {
    x: p.x, y: p.y, angle: rng.range(0, Math.PI * 2),
    speed: spec.speed, name: spec.name,
    shirt: spec.shirt, hp: 100, flee: 0,
    target: null, panic: 0, walkPhase: rng.range(0, 6),
    // Vendors never walk: a huge idle timer pins them to their cart, and
    // the update loop treats idle peds as standing still.
    idle: kind === 'vendor' ? 9999 : 0,
    kind,
  };
  S.peds.push(ped);
  return ped;
}

// Park a few of the new cars around the city, and put the new faces on the
// pavements. Called once at world creation and again on restart.
export function spawnStreetLife(S, rng) {
  // Two limos outside the hotel, two pickups by the docks — parked, so the
  // player can steal one the moment they walk past.
  const limoSpots = [
    { x: 35 * TILE, y: 18 * TILE, a: 0 },
    { x: 35 * TILE, y: 19 * TILE, a: Math.PI },
  ];
  for (const spot of limoSpots) {
    S.cars.push(makeCar(spot.x, spot.y, spot.a, 'limo', null));
  }
  const pickupSpots = [
    { x: 56 * TILE, y: 52 * TILE, a: Math.PI / 2 },
    { x: 58 * TILE, y: 54 * TILE, a: -Math.PI / 2 },
  ];
  for (const spot of pickupSpots) {
    S.cars.push(makeCar(spot.x, spot.y, spot.a, 'pickup', null));
  }
  // Joggers run the beach road, tourists drift around the Plaza and the
  // Pier, and one vendor holds down his cart at the Plaza all day.
  for (let i = 0; i < 4; i++) spawnSpecialPed(S, rng, 'jogger');
  for (let i = 0; i < 4; i++) spawnSpecialPed(S, rng, 'tourist');
  spawnSpecialPed(S, rng, 'vendor');
  const plaza = S.city.places.plaza;
  const vendor = S.peds[S.peds.length - 1];
  vendor.x = plaza.x + 80;
  vendor.y = plaza.y + 40;
}

// New pickups, scattered on pavements like the old ones. Counts are small
// on purpose: a wrench should feel like a find, not like litter.
export function spawnStreetPickups(S, rng, n) {
  const kinds = ['wrench', 'wrench', 'coffee', 'coffee', 'briefcase', 'briefcase'];
  const total = n || 10;
  for (let i = 0; i < total; i++) {
    const p = sidewalkPoint(rng, S.city);
    const kind = kinds[i % kinds.length];
    S.pickups.push({
      x: p.x, y: p.y, kind,
      value: kind === 'briefcase' ? 75 : 0,
      bob: rng.range(0, 6),
    });
  }
}

// What each new pickup does when the player walks over it. Called from
// updatePickups in combat.js; returns true when this module handled it.
export function applyStreetPickup(S, pk, audio) {
  if (pk.kind === 'wrench') {
    if (S.player.inCar) {
      S.player.inCar.hp = Math.min(100, S.player.inCar.hp + 60);
      return 'Wrench — car repaired +60';
    }
    return 'Wrench — no car to fix right now';
  }
  if (pk.kind === 'coffee') {
    S.player.stamina = 100;
    return 'Coffee! Sprint stamina refilled';
  }
  if (pk.kind === 'briefcase') {
    return null; // money is added by the caller, like the cash pickup
  }
  return null;
}

// The Plaza vendor sells coffee for $5: walk up to his cart and press B.
// It is the only thing in Solmar Bay you can buy with a keypress, and it
// exists so the vendor is a person, not scenery.
export const VENDOR_COFFEE_PRICE = 5;

export function nearestVendor(S) {
  let best = null, bestD = 80;
  for (const ped of S.peds) {
    if (ped.kind !== 'vendor' || ped.hp <= 0) continue;
    const d = Math.hypot(ped.x - S.player.x, ped.y - S.player.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

export function buyCoffee(S, audio) {
  const vendor = nearestVendor(S);
  if (!vendor) { addMessage(S, 'No vendor nearby — the coffee cart is at the Plaza.'); return; }
  if (S.money < VENDOR_COFFEE_PRICE) {
    addMessage(S, `Coffee is $${VENDOR_COFFEE_PRICE} — you are $${VENDOR_COFFEE_PRICE - S.money} short.`);
    return;
  }
  S.money -= VENDOR_COFFEE_PRICE;
  S.player.stamina = 100;
  addMessage(S, 'Vendor: "Hot coffee, fresh off the cart. Run well, Rook." — stamina full');
  if (audio) audio.pickup();
}

// A short line for the title screen and the pause screen, so new players
// know the new systems exist before they find them by accident.
export function streetLifeLines() {
  return [
    'New in town: street races (V at a 🏁 pad), gang turf to take,',
    'a limo and a pickup to steal, joggers, tourists and a vendor.',
    'Look for wrenches (fix your car), coffee (sprint) and briefcases ($75).',
  ];
}

// How many of the new rides the player has stolen — a small stat for the
// end screen, next to cars stolen and stunts landed.
export function countNewRidesStolen(S) {
  return (S.stats.carsStolenByType && S.stats.carsStolenByType.limo || 0)
    + (S.stats.carsStolenByType && S.stats.carsStolenByType.pickup || 0);
}
