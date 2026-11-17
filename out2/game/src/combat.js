// combat.js — shooting, drive-bys, gang enemies and pickups.
// One job: violence and its rewards.
import { dist, angleTo } from './random.js';
import { circleHitsBuilding } from './city.js';
import { addMessage, addMoney } from './state.js';
import { hurtEnemy, raiseWanted, spawnBlood } from './player.js';
import { damageCar } from './vehicles.js';

export function spawnGang(S, rng, x, y, n) {
  for (let i = 0; i < n; i++) {
    S.enemies.push({
      x: x + rng.range(-90, 90), y: y + rng.range(-90, 90),
      angle: 0, hp: 100, dead: false, shootCd: rng.range(0.5, 1.5),
      speed: 95, name: 'Rust Viper',
    });
  }
}

export function fireBullet(S, fromX, fromY, angle, fromPlayer, audio) {
  if (fromPlayer) {
    if (S.player.ammo <= 0) { addMessage(S, 'Out of ammo — find an ammo pickup (green box).'); return; }
    S.player.ammo--; S.stats.shotsFired++;
  }
  S.bullets.push({ x: fromX, y: fromY, angle, speed: 900, life: 0.9, fromPlayer });
  if (audio) audio.shoot();
  // Muzzle flash particle.
  S.particles.push({
    x: fromX + Math.cos(angle) * 26, y: fromY + Math.sin(angle) * 26,
    vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#ffe066', size: 7,
  });
}

export function updateBullets(S, dt, audio) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let hit = b.life <= 0 || circleHitsBuilding(S.city, b.x, b.y, 2);
    if (b.fromPlayer) {
      for (const e of S.enemies) {
        if (!e.dead && dist(b.x, b.y, e.x, e.y) < 18) { hurtEnemy(S, e, 34, audio); hit = true; break; }
      }
      if (!hit) for (const cop of S.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 16) {
          cop.hp -= 34; spawnBlood(S, cop.x, cop.y); hit = true;
          raiseWanted(S, 1, 'Shot at a cop!');
          if (cop.hp <= 0) { cop.hp = 0; S.cops.splice(S.cops.indexOf(cop), 1); }
          break;
        }
      }
      if (!hit) for (const ped of S.peds) {
        if (ped.hp > 0 && dist(b.x, b.y, ped.x, ped.y) < 14) {
          ped.hp = 0; S.stats.pedsHit++; spawnBlood(S, ped.x, ped.y);
          raiseWanted(S, 1, 'Pedestrian shot!'); hit = true; break;
        }
      }
      if (!hit) for (const c of S.cars) {
        if (c.driver !== 'player' && !c.dead && dist(b.x, b.y, c.x, c.y) < 26) {
          damageCar(S, c, 10, audio); hit = true; break;
        }
      }
    } else if (dist(b.x, b.y, S.player.x, S.player.y) < 14 && !S.player.inCar) {
      S.player.health -= 7; spawnBlood(S, S.player.x, S.player.y); hit = true;
      S.cam.shake = Math.max(S.cam.shake, 4);
    }
    if (hit) S.bullets.splice(i, 1);
  }
}

export function updateEnemies(S, dt, audio) {
  const px = S.player.x, py = S.player.y;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, px, py);
    e.angle = angleTo(e.x, e.y, px, py);
    if (d > 240) {
      const nx = e.x + Math.cos(e.angle) * e.speed * dt;
      const ny = e.y + Math.sin(e.angle) * e.speed * dt;
      if (!circleHitsBuilding(S.city, nx, ny, 12)) { e.x = nx; e.y = ny; }
    } else {
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.1 + Math.random() * 0.8;
        fireBullet(S, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.25, false, audio);
      }
    }
  }
  S.enemies = S.enemies.filter((e) => !e.dead || (e.deadT = (e.deadT || 0) + dt) < 4);
}

export function updatePickups(S, dt) {
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const pk = S.pickups[i];
    pk.bob = (pk.bob || 0) + dt;
    if (dist(pk.x, pk.y, S.player.x, S.player.y) < 30) {
      if (pk.kind === 'cash') { addMoney(S, pk.value, 'package cash'); }
      else if (pk.kind === 'health') { S.player.health = Math.min(100, S.player.health + 40); addMessage(S, 'Health +40'); }
      else if (pk.kind === 'ammo') { S.player.ammo += 30; addMessage(S, 'Ammo +30'); }
      S.pickups.splice(i, 1);
    }
  }
}

export function spawnPickups(S, rng, n) {
  const kinds = ['cash', 'health', 'ammo'];
  for (let i = 0; i < n; i++) {
    const tx = rng.int(3, 56), ty = rng.int(3, 62);
    const kind = kinds[i % kinds.length];
    S.pickups.push({ x: tx * 48 + 24, y: ty * 48 + 24, kind, value: kind === 'cash' ? 50 : 0, bob: 0 });
  }
  S.collect.total = S.pickups.filter((p) => p.kind === 'cash').length;
}
