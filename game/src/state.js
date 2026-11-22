// Shared mutable game state for Solmar Nights 3D.
// W holds live three.js objects; S holds everything the game logic touches.

export const W = {
  scene: null, camera: null, renderer: null,
  sun: null, hemi: null, moon: null,
  cityGroup: null, rainGroup: null, markerGroup: null,
  playerMesh: null, heli: null, heliLight: null, heliCone: null,
  waypointMesh: null, checkpointMeshes: [],
  tracers: [], particles: [], floaters: [],
  clock: 0,
};

export function freshState() {
  return {
    mode: 'title',            // title | play | pause | busted | wasted | complete
    seed: 1337,
    time: 0,
    day: 1,
    clockMin: 17 * 60 + 40,   // golden hour start
    money: 120,
    health: 100, armor: 0, ammo: { pistol: 60, smg: 0, shotgun: 0, rifle: 0, rpg: 0 },
    weapon: 0,                // index into WEAPONS
    wanted: 0, wantedHeat: 0,
    respect: 0, rp: 0,
    respectRank: 0,
    stamina: 100,
    player: { x: 0, z: 60, heading: 0, speed: 0, onFoot: true, car: null, vy: 0, air: false },
    camYaw: 0, camPitch: 0.42, camDist: 12,
    cars: [], peds: [], cops: [], gang: [], bullets: [],
    mission: null,            // { id, stage, t, data }
    missionsDone: [],
    race: null,               // { id, cp, t, best }
    raceBest: {},
    turfs: {},                // id -> { owner: 'player'|'vipers'|'none', progress }
    turfIncomeT: 0,
    courier: null,            // { stage, px, pz, dx, dz, t, express, streak }
    courierStreak: 0,
    challenges: [],           // { id, text, done }
    stash: [],                // { x, z, taken }
    pickups: [],              // { kind, x, z, taken }
    vendors: [],              // { x, z }
    weather: { rain: 0, rainT: 0, thunderT: 0 },
    radio: { station: 0, track: 0, trackT: 0 },
    crewCd: { plates: 0, fix: 0, eyes: 0 },
    eyesT: 0,
    garageNear: false,
    area: 'DOWNTOWN',
    dialogue: null,           // { name, line, t }
    banner: null,             // { text, sub, t }
    objective: 'Press Enter to start',
    stats: {
      kmDriven: 0, carsStolen: 0, jumps: 0, rainKm: 0, nightJobs: 0,
      vipersDown: 0, topSpeed: 0, courierDone: 0, racesWon: 0,
      turfsTaken: 0, escapes: 0, beachVisits: 0, sprintM: 0,
    },
    shot: null,               // { name, seed } when ?shot= is active
    autopilot: false,
    paused: false,
    saveSlot: 0,
  };
}

export let S = freshState();

export function resetState(seed = 1337) {
  S = freshState();
  S.seed = seed;
  return S;
}

// --- save / load (localStorage, same keys as the 2D rounds) ---
const SAVE_KEY = 'solmar-nights-3d-save';

export function saveGame() {
  try {
    const s = S;
    const data = {
      money: s.money, health: s.health, armor: s.armor, ammo: s.ammo,
      respect: s.respect, rp: s.rp, day: s.day, clockMin: s.clockMin,
      missionsDone: s.missionsDone, raceBest: s.raceBest,
      turfs: s.turfs, stats: s.stats,
      px: s.player.x, pz: s.player.z,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S.money = d.money; S.health = d.health; S.armor = d.armor; S.ammo = d.ammo;
    S.respect = d.respect; S.rp = d.rp; S.day = d.day; S.clockMin = d.clockMin;
    S.missionsDone = d.missionsDone || []; S.raceBest = d.raceBest || {};
    S.turfs = d.turfs || {}; S.stats = { ...S.stats, ...(d.stats || {}) };
    S.player.x = d.px || 0; S.player.z = d.pz || 60;
    return true;
  } catch { return false; }
}

export function addRespect(n) {
  S.rp += n;
  S.respect += n;
}
