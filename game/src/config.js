// Solmar Nights — 3D rebuild (round 4). Central tuning + content tables.
// Everything here is original: the city of Solmar Bay, Rook Marlow, Vera
// Solano, the Rust Vipers and the SBPD are invented for this game.

export const WORLD = {
  half: 560,            // playable half-extent in metres (city core)
  roadStep: 100,        // distance between parallel streets
  roadHalf: 7,          // half width of a street
  blockHalf: 36,        // half size of a city block's buildable area
  seaAt: -560,          // beach / sea line on the south edge (z < seaAt is water)
  gravity: 30,
};

// Sunset palette: warm dusk gold, teal sea, coral neon.
export const PALETTE = {
  skyTop: 0x2b3a6e, skyMid: 0xff9a52, skyLow: 0xffc46b,
  sun: 0xffd27a, fog: 0xe08a4e,
  road: 0x2e2a33, roadLine: 0xd8c25a, sidewalk: 0x8a7f74,
  sea: 0x1d6f7a, sand: 0xd9b380,
  building: [0xb5654a, 0xc98a5a, 0x9a5f6e, 0x7a6a8a, 0xa8763e, 0x5f7a8a],
  windowLit: 0xffd27a, windowDark: 0x2a3242,
  palmTrunk: 0x6e4a2f, palmLeaf: 0x3f7a3a,
};

export const VEHICLES = {
  sedan:    { name: 'Solmar Sedan',  top: 34, accel: 16, brake: 30, grip: 2.6, color: 0x4a7ab5, len: 4.6, wid: 2.0 },
  taxi:     { name: 'Bay Taxi',      top: 32, accel: 15, brake: 30, grip: 2.6, color: 0xe8b93a, len: 4.6, wid: 2.0 },
  comet:    { name: 'Comet GT',      top: 52, accel: 26, brake: 34, grip: 3.4, color: 0xd84a6e, len: 4.4, wid: 2.0 },
  truck:    { name: 'Hauler Truck',  top: 28, accel: 11, brake: 24, grip: 2.0, color: 0x7a7f85, len: 6.4, wid: 2.4 },
  sports:   { name: 'Vireo GT',      top: 55, accel: 28, brake: 36, grip: 3.6, color: 0x2fae7a, len: 4.3, wid: 1.9 },
  van:      { name: 'Panel Van',     top: 30, accel: 13, brake: 26, grip: 2.2, color: 0x8a8f96, len: 5.4, wid: 2.2 },
  police:   { name: 'SBPD Cruiser',  top: 46, accel: 24, brake: 36, grip: 3.4, color: 0x1d2f4a, len: 4.8, wid: 2.0 },
  bike:     { name: 'Street Bike',   top: 48, accel: 30, brake: 38, grip: 4.0, color: 0xc23a2e, len: 2.4, wid: 0.9 },
  muscle:   { name: 'V8 Muscle',     top: 50, accel: 24, brake: 32, grip: 3.0, color: 0x3a2a5e, len: 4.8, wid: 2.1 },
  limo:     { name: 'Solmar Limo',   top: 36, accel: 14, brake: 28, grip: 2.4, color: 0x1a1a22, len: 7.2, wid: 2.1 },
  pickup:   { name: 'Dune Pickup',   top: 38, accel: 17, brake: 30, grip: 2.8, color: 0xb56a2a, len: 5.0, wid: 2.1 },
};

export const WEAPONS = [
  { id: 'fists', name: 'FISTS',  ammo: Infinity, dmg: 12, rate: 0.45, range: 2.2, auto: false },
  { id: 'pistol', name: '.38',   ammo: 60,  dmg: 34, rate: 0.28, range: 60, auto: false },
  { id: 'smg',   name: 'SMG',    ammo: 120, dmg: 18, rate: 0.09, range: 55, auto: true },
  { id: 'shotgun', name: '12G',  ammo: 24,  dmg: 22, rate: 0.8,  range: 26, auto: false, pellets: 6 },
  { id: 'rifle', name: 'AR-9',   ammo: 90,  dmg: 40, rate: 0.16, range: 90, auto: true },
  { id: 'bat',   name: 'BAT',    ammo: Infinity, dmg: 20, rate: 0.5, range: 2.6, auto: false },
  { id: 'rpg',   name: 'RPG',    ammo: 4,   dmg: 220, rate: 1.4, range: 120, auto: false, locked: true },
];
// Slots the player starts with; the rest are LOCKED until respect unlocks them.
export const WEAPON_UNLOCKS = { smg: 1, shotgun: 2, rifle: 3, bat: 1, rpg: 4 };

export const RANKS = [
  { rp: 0,    title: 'NOBODY' },
  { rp: 800,  title: 'RUNNER' },
  { rp: 2200, title: 'FIXER' },
  { rp: 4500, title: 'HUSTLER' },
  { rp: 7500, title: 'KINGPIN' },
];

export const CREW = [
  { key: 'Z', id: 'plates',  name: 'SWAP PLATES', desc: 'Lose 1 wanted star', cd: 45 },
  { key: 'X', id: 'fix',     name: 'QUICK FIX',   desc: 'Repair your car 40%', cd: 60 },
  { key: 'F', id: 'eyes',    name: 'EYES OUT',    desc: 'Reveal all markers 20s', cd: 50 },
];

export const RADIO = [
  { name: 'SOLMAR FM 98.6', tracks: ['Neon Tideline', 'Guava Sunrise', 'Palms at Dusk', 'Salt Air Drive'] },
  { name: 'VIPER ROCK 101.1', tracks: ['Rust & Gasoline', 'Midnight Piston', 'Snakebite', 'Redline Sermon'] },
  { name: 'BAY TALK 88.4', tracks: ['The Vera Hour', 'SBPD Scanner Chat', 'Tide Report', 'Dockside Stories'] },
];

export const TURFS = [
  { id: 'docks',   name: 'THE DOCKS',   x: -350, z: 350,  r: 55 },
  { id: 'plaza',   name: 'SOLMAR PLAZA',x: 50,   z: -50,  r: 60 },
  { id: 'marina',  name: 'MARINA ROW',  x: 350,  z: -350, r: 55 },
  { id: 'market',  name: 'OLD MARKET',  x: -150, z: -250, r: 55 },
  { id: 'strand',  name: 'KUMALA STRAND', x: 250, z: 250, r: 60 },
];

export const GARAGE = { x: 200, z: 150, r: 30, bx: 235, bz: 150, name: "MACK'S GARAGE", price: 120 };

export const STASH_SPOTS = 10; // hidden cash drops, $100 each

export const CHALLENGE_POOL = [
  { id: 'drive5',  text: 'Drive 5 km',            check: s => s.stats.kmDriven >= 5 },
  { id: 'steal3',  text: 'Steal 3 cars',          check: s => s.stats.carsStolen >= 3 },
  { id: 'airtime', text: 'Catch air off a ramp',  check: s => s.stats.jumps >= 1 },
  { id: 'rain',    text: 'Drive in the rain',     check: s => s.stats.rainKm >= 0.5 },
  { id: 'night',   text: 'Finish a job at night', check: s => s.stats.nightJobs >= 1 },
  { id: 'ko4',     text: 'Drop 4 Vipers',         check: s => s.stats.vipersDown >= 4 },
  { id: 'stunt',   text: 'Hit 200 km/h',          check: s => s.stats.topSpeed >= 200 },
  { id: 'courier', text: 'Finish a courier run',  check: s => s.stats.courierDone >= 1 },
  { id: 'race',    text: 'Win a street race',     check: s => s.stats.racesWon >= 1 },
  { id: 'turf',    text: 'Capture a turf',        check: s => s.stats.turfsTaken >= 1 },
  { id: 'cash',    text: 'Hold $2,000 at once',   check: s => s.money >= 2000 },
  { id: 'escape',  text: 'Escape a 3-star chase', check: s => s.stats.escapes >= 1 },
  { id: 'photo',   text: 'Visit the beach',       check: s => s.stats.beachVisits >= 1 },
  { id: 'stamina', text: 'Sprint 400 m',          check: s => s.stats.sprintM >= 400 },
];

export const MISSION_DEFS = [
  { id: 1, name: 'First Wheels',   giver: 'VERA SOLANO', brief: 'Steal a car and bring it to the Docks. Any car. Don\'t get cute.' },
  { id: 2, name: 'Package Run',    giver: 'VERA SOLANO', brief: 'Pick up the package at the Plaza and drop it at the Marina. Fast.' },
  { id: 3, name: 'Taxi Rush',      giver: 'VERA SOLANO', brief: 'Borrow a taxi, grab the fare on Strand, get them to the hotel.' },
  { id: 4, name: 'Gang Trouble',   giver: 'VERA SOLANO', brief: 'Vipers are pushing on the Docks. Drop four of them.' },
  { id: 5, name: 'The Big Score',  giver: 'VERA SOLANO', brief: 'Crack the bank vault, then lose the heat and reach the Safehouse.' },
  { id: 6, name: 'The Last Delivery', giver: 'VERA SOLANO', brief: 'Three drops, 150 seconds, cops already on you. Go.' },
  { id: 7, name: "Vera's Escort",  giver: 'VERA SOLANO', brief: 'Ride with me: hotel, pier, safehouse. Keep the Vipers off my car.' },
  { id: 8, name: 'The Vault Job',  giver: 'VERA SOLANO', brief: 'Eighteen seconds on the vault. One-fifty on the clock. Then vanish.' },
];

export const RACE_DEFS = [
  { id: 1, name: 'SUNSET SPRINT',  pads: [[-400, -400], [-200, -400], [0, -400], [200, -400], [400, -400]] },
  { id: 2, name: 'STRAND DASH',    pads: [[400, 400], [200, 400], [0, 400], [-200, 400], [-400, 400]] },
  { id: 3, name: 'DOCK RUN',       pads: [[-400, 400], [-400, 200], [-400, 0], [-200, 0], [0, 0]] },
  { id: 4, name: 'MARINA LOOP',    pads: [[400, -400], [400, -200], [200, -200], [200, -400], [400, -400]] },
  { id: 5, name: 'PLAZA CIRCUIT',  pads: [[0, 0], [200, 0], [200, 200], [0, 200], [-200, 200]] },
  { id: 6, name: 'MARKET MILE',    pads: [[-200, -200], [-200, 0], [0, 0], [0, -200], [-200, -200]] },
  { id: 7, name: 'BAY GRAND TOUR', pads: [[-400, -400], [400, -400], [400, 400], [-400, 400], [-400, -200]] },
];

export const DIALOGUE = {
  intro: ['VERA SOLANO', 'Rook. You\'re back in Solmar Bay. The Vipers think the docks are theirs. Prove them wrong.'],
  chase: ['SBPD DISPATCH', 'All units, suspect in a Comet GT heading down Strand. Air One has you in the light.'],
  veraEscort: ['VERA SOLANO', 'Stay close, Rook. If my car takes a bullet, this whole night is wasted.'],
  garage: ['MACK', 'You break it, I bill it. Hundred and twenty, and she\'ll run like new.'],
  bust: ['SBPD', 'Hands where I can see them, Marlow. You\'re done.'],
  wasted: ['ROOK MARLOW', 'Not like this. Not in my own city...'],
};

export const AREAS = [
  { name: 'THE DOCKS', x: -350, z: 350 }, { name: 'SOLMAR PLAZA', x: 50, z: -50 },
  { name: 'MARINA ROW', x: 350, z: -350 }, { name: 'OLD MARKET', x: -150, z: -250 },
  { name: 'KUMALA STRAND', x: 250, z: 250 }, { name: 'THE BEACH', x: 0, z: -520 },
  { name: 'DOWNTOWN', x: 0, z: 0 }, { name: 'NORTH HILLS', x: 0, z: 450 },
];
