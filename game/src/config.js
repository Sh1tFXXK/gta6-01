// config.js — every tuneable number, name and colour for Solmar Nights.
// One clear job: constants only. No logic, no imports.
export const GAME_NAME = 'Solmar Nights';
export const CITY_NAME = 'Solmar Bay';
export const SAVE_KEY = 'solmar-nights-save-v1';

export const TILE = 48;              // pixels per city tile
export const CITY_TILES = 64;        // city is 64 x 64 tiles
export const CITY_SIZE = TILE * CITY_TILES; // 3072 px square
export const VIEW_W = 1280;
export const VIEW_H = 800;

export const COLORS = {
  grass: '#7ec850', grass2: '#74bd48', park: '#5da83f', sand: '#f2d8a0',
  water: '#2e8fd6', waterDeep: '#1f6fb8', road: '#3a3f47', roadLine: '#e8d44d',
  sidewalk: '#b9bcc2', buildingRoof: '#c96f4a', buildingRoof2: '#4a7ec9',
  buildingRoof3: '#8a5fc9', buildingRoof4: '#e0a83c', wall: '#8d9099',
  hudBg: 'rgba(8,12,20,0.72)', hudText: '#ffffff', accent: '#ffd23f',
  danger: '#ff4d4d', good: '#57e389', policeBlue: '#3b82f6', policeRed: '#ef4444',
  stashGold: '#ffd23f', rampYellow: '#ffe066', nightTint: 'rgba(8,10,40,0.38)',
};

export const CAR_TYPES = {
  sedan:  { name: 'Solmar Sedan',  color: '#d94f4f', top: 340, accel: 260, grip: 3.4, len: 46, wid: 22 },
  taxi:   { name: 'Bay Taxi',      color: '#f5c518', top: 330, accel: 250, grip: 3.3, len: 46, wid: 22 },
  truck:  { name: 'Harbor Truck',  color: '#4f7ed9', top: 260, accel: 180, grip: 2.6, len: 58, wid: 26 },
  sports: { name: 'Comet GT',      color: '#e33fa1', top: 470, accel: 380, grip: 4.2, len: 48, wid: 22 },
  police: { name: 'SBPD Cruiser',  color: '#24344d', top: 420, accel: 340, grip: 3.9, len: 48, wid: 23 },
  van:    { name: 'Pier Van',      color: '#e8e8e8', top: 290, accel: 210, grip: 2.9, len: 52, wid: 24 },
  // Round 2: two new rides — a nimble street bike and a heavy V8 muscle car.
  bike:   { name: 'Street Bike',   color: '#f97316', top: 440, accel: 420, grip: 4.6, len: 36, wid: 14 },
  muscle: { name: 'V8 Muscle',     color: '#7c3aed', top: 400, accel: 340, grip: 3.6, len: 50, wid: 24 },
};
export const CAR_TYPE_KEYS = ['sedan', 'taxi', 'truck', 'sports', 'van', 'bike', 'muscle'];

export const PED_NAMES = ['Mara', 'Jules', 'Tomas', 'Priya', 'Leo', 'Ana', 'Kai', 'Rosa', 'Felix', 'Nina'];
export const PED_SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8'];
export const GANG_NAME = 'The Rust Vipers';
export const CONTACT_NAME = 'Vera Solano';
export const PLAYER_NAME = 'Rook Marlow';

// Hidden stash: Vera's cash drops scattered around Solmar Bay. Find them all.
export const STASH_TOTAL = 10;
export const STASH_REWARD = 100;
// Stunt jumps: hit a ramp faster than this and the jump pays out.
export const STUNT_MIN_SPEED = 200;
export const STUNT_REWARD = 75;
// Sprint stamina: drains while holding Shift, refills while walking.
export const STAMINA_MAX = 100;
export const STAMINA_DRAIN = 22;
export const STAMINA_REGEN = 14;

// Story mission chain (id, title, briefing, reward). Objectives are scripted in missions.js.
export const MISSION_DEFS = [
  { id: 1, title: 'First Wheels', reward: 150,
    briefing: 'Vera: "Rook, you need wheels. Borrow a car — any car — and bring it to the docks marker."',
    hint: 'Walk to a car and press E to get in. Drive to the yellow marker.' },
  { id: 2, title: 'Package Run', reward: 300,
    briefing: 'Vera: "Three packages, three drop-offs. The Vipers are watching the north side, so keep it quick."',
    hint: 'Follow the yellow markers and deliver all 3 packages.' },
  { id: 3, title: 'Taxi Rush', reward: 250,
    briefing: 'Vera: "A fare is waiting at the plaza. Pick them up in a taxi and get them to the hotel before the timer runs out."',
    hint: 'Find the taxi, pick up the fare, beat the clock.' },
  { id: 4, title: 'Gang Trouble', reward: 450,
    briefing: 'Vera: "The Rust Vipers jumped our courier at the old arcade. Go sort it out — all four of them."',
    hint: 'Click to shoot. Take down all 4 gang members.' },
  { id: 5, title: 'The Big Score', reward: 1000,
    briefing: 'Vera: "Last one, Rook. Grab the cash at the bank, then lose the cops and get to the safehouse. Make Solmar yours."',
    hint: 'Grab the cash, survive wanted level 3, reach the safehouse.' },
  { id: 6, title: 'The Last Delivery', reward: 600,
    briefing: 'Vera: "One last run, Rook. Three drops, one clock, and the whole SBPD already on your tail. Don\'t get cute — get it done."',
    hint: 'Deliver to 3 stops before the timer ends — the cops are already chasing you.' },
];

export const START_MONEY = 120;
export const START_HEALTH = 100;
export const START_AMMO = 60;
export const MAX_WANTED = 5;
