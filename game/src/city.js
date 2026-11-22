// Solmar Bay in 3D: grid streets, lit towers, beach + sea, palms, lamps,
// ramps, the garage, race pads and stash spots. Collision data lives here.

import * as THREE from 'three';
import { WORLD, PALETTE, TURFS, GARAGE, RACE_DEFS } from './config.js';
import { mulberry32, pick } from './random.js';
import { W, S } from './state.js';

export const CITY = {
  buildings: [],   // { x, z, hx, hz, h }
  ramps: [],       // { x, z, dir }
  pads: [],        // race start pads { x, z, race }
  palms: [],
  lamps: [],
};

let boxGeo, winTexes = [];

function windowTexture(rng, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd27a' : '#20283a';
      g.fillRect(x, y, 8, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildingMaterial(color, rng) {
  const tex = pick(rng, winTexes);
  const m = new THREE.MeshLambertMaterial({ color, map: tex, emissive: 0xffffff, emissiveMap: tex });
  return m;
}

export function buildCity() {
  const rng = mulberry32(S.seed);
  const scene = W.scene;
  const group = new THREE.Group();
  W.cityGroup = group;
  scene.add(group);

  winTexes = [windowTexture(rng, 0.55), windowTexture(rng, 0.4), windowTexture(rng, 0.65)];

  // Ground: grass/dirt base + road ribbons + sand + sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: 0x6a7a52 })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.1, 0);
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshLambertMaterial({ color: PALETTE.roadLine });
  for (let i = -5; i <= 5; i++) {
    const c = i * 100;
    for (const [w, h, x, z] of [[1120, 14, 0, c], [14, 1120, c, 0]]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, h), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, z);
      group.add(r);
    }
    // dashed centre line
    for (let d = -540; d < 540; d += 24) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.7), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.04, c);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 10), lineMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(c, 0.04, d);
      group.add(dash2);
    }
  }

  // Beach sand + sea.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1400, 70), new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.03, -545);
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 500), new THREE.MeshLambertMaterial({ color: PALETTE.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, -830);
  group.add(sea);

  // Buildings, one per block (skip plaza park, beach row, some docks).
  boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const plazaBlock = (bx, bz) => bx === 50 && bz === -50;
  const parkBlock = (bx, bz) => (bx === -150 && bz === 150) || (bx === 250 && bz === -250);
  for (let bx = -450; bx <= 450; bx += 100) {
    for (let bz = -450; bz <= 450; bz += 100) {
      if (plazaBlock(bx, bz) || parkBlock(bx, bz)) {
        addPark(group, bx, bz, rng);
        continue;
      }
      if (bz === -450 && rng() < 0.5) { addPark(group, bx, bz, rng); continue; } // beachfront open
      const w = 34 + rng() * 26, d = 34 + rng() * 26;
      const h = (bx * bx + bz * bz < 90000 ? 26 : 12) + rng() * (rng() < 0.12 ? 42 : 20);
      const color = pick(rng, PALETTE.building);
      const tex = pick(rng, winTexes);
      const mat = new THREE.MeshLambertMaterial({ color, map: tex, emissive: 0xffffff, emissiveMap: tex });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(bx, h / 2, bz);
      group.add(b);
      // roof cap
      const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x3a3230 }));
      roof.scale.set(w + 1, 0.8, d + 1); roof.position.set(bx, h + 0.4, bz);
      group.add(roof);
      CITY.buildings.push({ x: bx, z: bz, hx: w / 2, hz: d / 2, h });
    }
  }

  // Plaza: fountain + benches at (50,-50).
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 2, 20), new THREE.MeshLambertMaterial({ color: 0x9ab8c8 }));
  fountain.position.set(50, 1, -50); group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.4, 20), new THREE.MeshLambertMaterial({ color: 0x2f7f9a }));
  water.position.set(50, 2, -50); group.add(water);

  // Palms along the beach + scattered.
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 9, 6);
  const leafGeo = new THREE.ConeGeometry(3.2, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  for (let i = 0; i < 46; i++) {
    const x = -540 + rng() * 1080, z = -520 + rng() * 18;
    addPalm(group, x, z, trunkGeo, leafGeo, trunkMat, leafMat);
  }
  for (let i = 0; i < 26; i++) {
    const bx = -450 + Math.floor(rng() * 10) * 100, bz = -450 + Math.floor(rng() * 10) * 100;
    addPalm(group, bx + (rng() - 0.5) * 60, bz + (rng() - 0.5) * 60, trunkGeo, leafGeo, trunkMat, leafMat);
  }

  // Street lamps on every other intersection.
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  const bulbGeo = new THREE.SphereGeometry(0.55, 8, 6);
  for (let ix = -5; ix <= 5; ix += 2) {
    for (let iz = -5; iz <= 5; iz += 2) {
      const x = ix * 100 + 9, z = iz * 100 + 9;
      const pole = new THREE.Mesh(poleGeo, lampMat);
      pole.position.set(x, 3.5, z); group.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x, 7.1, z); group.add(bulb);
      CITY.lamps.push({ x, z });
    }
  }

  // Stunt ramps: 4, on open stretches.
  const rampDefs = [
    { x: -250, z: -350, dir: 0 }, { x: 150, z: 250, dir: Math.PI / 2 },
    { x: -150, z: 50, dir: Math.PI }, { x: 250, z: -150, dir: -Math.PI / 2 },
  ];
  const rampGeo = new THREE.BoxGeometry(10, 1, 14);
  const rampMat = new THREE.MeshLambertMaterial({ color: 0xd8a03a });
  for (const r of rampDefs) {
    const m = new THREE.Mesh(rampGeo, rampMat);
    m.position.set(r.x, 1.2, r.z);
    m.rotation.y = r.dir; m.rotation.x = 0; m.rotation.z = 0;
    m.rotation.order = 'YXZ';
    m.rotation.x = -0.42;
    group.add(m);
    CITY.ramps.push(r);
  }

  // Garage: big workshop box just off the road at (200,150), forecourt on
  // the street so a car can actually drive in for a repair.
  const gar = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x4a5a6a }));
  gar.scale.set(40, 12, 26); gar.position.set(GARAGE.bx, 6, GARAGE.bz);
  group.add(gar);
  const sign = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff5a3a }));
  sign.scale.set(30, 2, 0.6); sign.position.set(GARAGE.bx, 11, GARAGE.bz - 13.4);
  group.add(sign);
  CITY.buildings.push({ x: GARAGE.bx, z: GARAGE.bz, hx: 20, hz: 13, h: 12 });

  // Race start pads (chequered strips) + turf rings.
  const padMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const padMat2 = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const race of RACE_DEFS) {
    const [px, pz] = race.pads[0];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), i % 2 ? padMat : padMat2);
      s.rotation.x = -Math.PI / 2; s.position.set(px - 5 + i * 3.4, 0.06, pz);
      group.add(s);
    }
    CITY.pads.push({ x: px, z: pz, race: race.id });
  }
  const ringGeo = new THREE.RingGeometry(1, 1.12, 40);
  for (const t of TURFS) {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffb03a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
    ring.rotation.x = -Math.PI / 2; ring.scale.set(t.r, t.r, 1);
    ring.position.set(t.x, 0.08, t.z);
    group.add(ring);
  }

  // Stash spots + vendor + pickups are placed by their own modules; seed
  // spots here — always ON a street (one coordinate a multiple of 100),
  // so a player can actually reach them.
  const roadPoint = () => {
    const line = (Math.floor(rng() * 11) - 5) * 100;
    const along = (rng() * 2 - 1) * 480;
    return rng() < 0.5 ? { x: line, z: along } : { x: along, z: line };
  };
  S.stash = [];
  for (let i = 0; i < 10; i++) {
    const p = roadPoint();
    S.stash.push({ x: p.x, z: p.z, taken: false });
  }
  S.vendors = [{ x: -100, z: -240 }, { x: 240, z: 200 }, { x: 0, z: -50 }];
  S.pickups = [];
  const kinds = ['wrench', 'coffee', 'briefcase', 'wrench', 'coffee', 'briefcase', 'wrench', 'coffee'];
  for (const k of kinds) {
    const p = roadPoint();
    S.pickups.push({ kind: k, x: p.x, z: p.z, taken: false });
  }
}

function addPalm(group, x, z, trunkGeo, leafGeo, trunkMat, leafMat) {
  const t = new THREE.Mesh(trunkGeo, trunkMat);
  t.position.set(x, 4.5, z); t.rotation.z = (Math.random() - 0.5) * 0.2;
  group.add(t);
  const l = new THREE.Mesh(leafGeo, leafMat);
  l.position.set(x, 10.5, z); group.add(l);
  CITY.palms.push({ x, z });
}

function addPark(group, bx, bz, rng) {
  const treeGeo = new THREE.ConeGeometry(4, 9, 7);
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x3a6a34 });
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
  for (let i = 0; i < 4; i++) {
    const x = bx + (rng() - 0.5) * 55, z = bz + (rng() - 0.5) * 55;
    const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.set(x, 1.5, z); group.add(tr);
    const cr = new THREE.Mesh(treeGeo, treeMat); cr.position.set(x, 7, z); group.add(cr);
  }
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(72, 72), new THREE.MeshLambertMaterial({ color: 0x4a7a3e }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(bx, 0.05, bz);
  group.add(lawn);
}

// --- collision helpers ---
export function collideCircle(x, z, r) {
  // Push a circle out of building AABBs; returns corrected {x, z}.
  for (const b of CITY.buildings) {
    const cx = Math.max(b.x - b.hx, Math.min(x, b.x + b.hx));
    const cz = Math.max(b.z - b.hz, Math.min(z, b.z + b.hz));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r; z = cz + (dz / d) * r;
      } else {
        // inside: push out along the smallest penetration axis
        const px = b.hx + r - Math.abs(x - b.x);
        const pz = b.hz + r - Math.abs(z - b.z);
        if (px < pz) x = b.x + (x > b.x ? b.hx + r : -(b.hx + r));
        else z = b.z + (z > b.z ? b.hz + r : -(b.hz + r));
      }
    }
  }
  const H = WORLD.half + 20;
  x = Math.max(-H, Math.min(H, x));
  z = Math.max(-H - 40, Math.min(H, z));
  return { x, z };
}

export function onRoad(x, z) {
  const rx = Math.abs(((x + 50) % 100 + 100) % 100 - 50);
  const rz = Math.abs(((z + 50) % 100 + 100) % 100 - 50);
  return rx < WORLD.roadHalf + 4 || rz < WORLD.roadHalf + 4;
}

export function nearestRoadPoint(x, z) {
  // Snap to the nearest street centre line.
  const rx = Math.round(x / 100) * 100;
  const rz = Math.round(z / 100) * 100;
  return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
}
