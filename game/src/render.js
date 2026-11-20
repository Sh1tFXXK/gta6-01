// render.js — draws the world: city, roads, buildings, cars, people, effects,
// and the title / pause / game-over screens. One job: drawing.
import { TILE, CITY_TILES, CITY_SIZE, VIEW_W, VIEW_H, COLORS, GAME_NAME, CITY_NAME, MISSION_DEFS, PLAYER_NAME, CONTACT_NAME, GANG_NAME } from './config.js';
import { isRoadTile, isWaterTile, isSandTile } from './city.js';
import { clamp, lerp } from './random.js';

// How dark the night overlay is at a given in-game clock (minutes).
// Day is clear, dusk and dawn fade in, deep night is a blue 0.38 veil.
export function nightAlpha(clockMin) {
  const h = (clockMin / 60) % 24;
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 20) return lerp(0, 0.30, (h - 18) / 2);
  if (h >= 20 || h < 5) return 0.38;
  if (h >= 5 && h < 7) return lerp(0.38, 0, (h - 5) / 2);
  return 0;
}

export function drawWorld(ctx, S) {
  const cam = S.cam;
  const shakeX = (Math.random() - 0.5) * cam.shake, shakeY = (Math.random() - 0.5) * cam.shake;
  ctx.save();
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
  drawGround(ctx, S, cam);
  drawParks(ctx, S);
  drawBuildings(ctx, S);
  drawRamps(ctx, S);
  drawPickups(ctx, S);
  drawMissionMarker(ctx, S);
  drawCars(ctx, S);
  drawPeds(ctx, S);
  drawCops(ctx, S);
  drawEnemies(ctx, S);
  drawBullets(ctx, S);
  drawPlayer(ctx, S);
  drawParticles(ctx, S);
  ctx.restore();
  // Day / night: a blue veil over the whole screen after dark, plus a warm
  // glow dot at each road intersection, like streetlights switching on.
  const dark = nightAlpha(S.clockMin);
  if (dark > 0) {
    ctx.fillStyle = `rgba(8,10,40,${dark})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(255,210,110,0.5)';
    const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + VIEW_W) / TILE);
    const y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + VIEW_H) / TILE);
    for (let ty = y0; ty <= y1; ty += 8) {
      for (let tx = x0; tx <= x1; tx += 8) {
        ctx.beginPath();
        ctx.arc(tx * TILE + TILE - cam.x, ty * TILE + TILE - cam.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Rain: diagonal streaks drifting with the wind, denser in heavy rain.
  if (S.weather.kind === 'rain' && S.weather.intensity > 0) {
    ctx.strokeStyle = `rgba(180,200,255,${0.25 * S.weather.intensity})`;
    ctx.lineWidth = 1;
    const n = Math.floor(46 * S.weather.intensity);
    for (let i = 0; i < n; i++) {
      const rx = (i * 173 + S.time * 620) % (VIEW_W + 40) - 20;
      const ry = (i * 97 + S.time * 900) % (VIEW_H + 40) - 20;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 8, ry + 22); ctx.stroke();
    }
  }
  if (S.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${S.flash * 2})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}

function visibleTiles(cam) {
  return {
    x0: Math.max(0, Math.floor(cam.x / TILE) - 1), x1: Math.min(CITY_TILES - 1, Math.ceil((cam.x + VIEW_W) / TILE) + 1),
    y0: Math.max(0, Math.floor(cam.y / TILE) - 1), y1: Math.min(CITY_TILES - 1, Math.ceil((cam.y + VIEW_H) / TILE) + 1),
  };
}

function drawGround(ctx, S, cam) {
  const { x0, x1, y0, y1 } = visibleTiles(cam);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const x = tx * TILE, y = ty * TILE;
      if (isWaterTile(tx, ty)) {
        ctx.fillStyle = (tx + ty) % 2 ? COLORS.water : COLORS.waterDeep;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x + ((tx * 7 + ty * 3) % 24), y + ((ty * 11) % 30), 18, 2);
      } else if (isSandTile(tx, ty)) {
        ctx.fillStyle = COLORS.sand; ctx.fillRect(x, y, TILE, TILE);
      } else if (isRoadTile(tx, ty)) {
        // Wet roads go darker while it rains.
        ctx.fillStyle = S.weather.kind === 'rain' ? '#2c313a' : COLORS.road;
        ctx.fillRect(x, y, TILE, TILE);
        // Centre dashes on road centrelines.
        if (tx % 8 === 1 && ty % 8 !== 1 && ty % 2 === 0) { ctx.fillStyle = COLORS.roadLine; ctx.fillRect(x + TILE / 2 - 2, y + 8, 4, 20); }
        if (ty % 8 === 1 && tx % 8 !== 1 && tx % 2 === 0) { ctx.fillStyle = COLORS.roadLine; ctx.fillRect(x + 8, y + TILE / 2 - 2, 20, 4); }
      } else {
        ctx.fillStyle = (tx + ty) % 2 ? COLORS.grass : COLORS.grass2;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
}

function drawParks(ctx, S) {
  for (const p of S.city.parks) {
    if (p.x > S.cam.x + VIEW_W || p.y > S.cam.y + VIEW_H || p.x + p.w < S.cam.x || p.y + p.h < S.cam.y) continue;
    ctx.fillStyle = COLORS.park; ctx.fillRect(p.x, p.y, p.w, p.h);
    for (const t of p.trees) {
      ctx.fillStyle = '#2f7d32'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawBuildings(ctx, S) {
  for (const b of S.city.buildings) {
    if (b.x > S.cam.x + VIEW_W || b.y > S.cam.y + VIEW_H || b.x + b.w < S.cam.x || b.y + b.h < S.cam.y) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = COLORS.wall; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let wy = b.y + 16; wy < b.y + b.h - 10; wy += 26)
      for (let wx = b.x + 14; wx < b.x + b.w - 10; wx += 26)
        ctx.fillRect(wx, wy, 12, 14);
    // At night some windows glow warm — the city stays awake.
    if (nightAlpha(S.clockMin) > 0.1) {
      ctx.fillStyle = 'rgba(255,210,110,0.85)';
      for (let wy = b.y + 16; wy < b.y + b.h - 10; wy += 26)
        for (let wx = b.x + 14; wx < b.x + b.w - 10; wx += 26)
          if ((wx * 7 + wy * 13) % 5 === 0) ctx.fillRect(wx, wy, 12, 14);
    }
    ctx.fillStyle = '#333'; ctx.font = 'bold 11px system-ui, sans-serif';
    if (b.hgt >= 4) ctx.fillText('▲'.repeat(b.hgt), b.x + 8, b.y + 12);
  }
  // Named place labels.
  ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const k of Object.keys(S.city.places)) {
    const p = S.city.places[k];
    if (p.x < S.cam.x - 100 || p.x > S.cam.x + VIEW_W + 100 || p.y < S.cam.y - 100 || p.y > S.cam.y + VIEW_H + 100) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const w = ctx.measureText(p.label).width + 16;
    ctx.fillRect(p.x - w / 2, p.y - 12, w, 18);
    ctx.fillStyle = '#fff'; ctx.fillText(p.label, p.x, p.y + 2);
  }
  ctx.textAlign = 'left';
}

// Stunt ramps: yellow chevron pads on the road, pulsing so drivers spot them.
function drawRamps(ctx, S) {
  for (const r of S.city.ramps) {
    if (r.x < S.cam.x - 80 || r.x > S.cam.x + VIEW_W + 80 || r.y < S.cam.y - 80 || r.y > S.cam.y + VIEW_H + 80) continue;
    const pulse = 0.65 + Math.sin(S.time * 4) * 0.2;
    ctx.save(); ctx.translate(r.x, r.y);
    ctx.fillStyle = `rgba(255,224,102,${pulse})`;
    ctx.beginPath(); ctx.moveTo(-26, 14); ctx.lineTo(0, -20); ctx.lineTo(26, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('JUMP', 0, 30);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawPickups(ctx, S) {
  for (const pk of S.pickups) {
    const bob = Math.sin((pk.bob || 0) * 3) * 3;
    ctx.save(); ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') { ctx.fillStyle = '#2ecc71'; ctx.fillRect(-11, -7, 22, 14); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 4); }
    else if (pk.kind === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-10, -10, 20, 20); ctx.fillStyle = '#e74c3c'; ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6); }
    else if (pk.kind === 'stash') {
      // Hidden stash: a spinning gold diamond that glints.
      const glint = 0.7 + Math.sin((pk.bob || 0) * 5) * 0.3;
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `rgba(255,210,63,${glint})`;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#fff'; ctx.fillRect(-4, -4, 8, 8);
      ctx.rotate(-Math.PI / 4);
    }
    else { ctx.fillStyle = '#f39c12'; ctx.fillRect(-10, -10, 20, 20); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('A', 0, 4); }
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawMissionMarker(ctx, S) {
  const t = S.mission.active ? S.mission.target : (S.taxi.active ? S.taxi.fare : null);
  if (!t) return;
  const pulse = 1 + Math.sin(S.time * 4) * 0.15;
  ctx.save(); ctx.translate(t.x, t.y);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,63,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(12, -30); ctx.lineTo(-12, -30); ctx.closePath(); ctx.fill();
  ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.strokeText(t.label, 0, -58); ctx.fillText(t.label, 0, -58);
  ctx.restore();
  // Off-screen direction arrow at the screen edge.
  const sx = t.x - S.cam.x, sy = t.y - S.cam.y;
  if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) {
    const cx = clamp(sx, 60, VIEW_W - 60), cy = clamp(sy, 60, VIEW_H - 60);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2));
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${t.label}  ${Math.round(Math.hypot(t.x - S.player.x, t.y - S.player.y))}m`, cx, cy + 28);
    ctx.textAlign = 'left';
  }
}

function drawCarShape(ctx, c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  if (c.type === 'bike') {
    // Street bike: slim body, two wheels, rider hunched over it.
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-c.len / 2 + 2, -c.wid / 2 + 2, c.len, c.wid);
    ctx.fillStyle = '#111'; ctx.fillRect(-c.len / 2, -3, c.len, 6);
    ctx.fillStyle = c.color; ctx.fillRect(-6, -c.wid / 2, 16, c.wid);
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(-2, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-2, -1, 5, Math.PI, 0); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-c.len / 2 + 3, -c.wid / 2 + 3, c.len, c.wid);
  ctx.fillStyle = c.color; ctx.fillRect(-c.len / 2, -c.wid / 2, c.len, c.wid);
  ctx.fillStyle = '#222'; ctx.fillRect(-c.len / 2 + 8, -c.wid / 2 + 2, 8, c.wid - 4);
  ctx.fillStyle = '#9fd8ff'; ctx.fillRect(-4, -c.wid / 2 + 3, 12, c.wid - 6);
  ctx.fillStyle = '#ffe066'; ctx.fillRect(c.len / 2 - 3, -c.wid / 2 + 2, 3, 5); ctx.fillRect(c.len / 2 - 3, c.wid / 2 - 7, 3, 5);
  // Brake lights flare red at the rear while the car is braking.
  if (c.braking) {
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(-c.len / 2 - 1, -c.wid / 2 + 2, 4, 5); ctx.fillRect(-c.len / 2 - 1, c.wid / 2 - 7, 4, 5);
  }
  if (c.type === 'taxi') {
    ctx.fillStyle = '#111'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3);
  }
  if (c.type === 'police') {
    ctx.fillStyle = '#fff'; ctx.fillRect(-c.len / 2 + 12, -c.wid / 2, c.len - 24, 5);
    ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#3b82f6' : '#ef4444';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  }
  if (c.hp < 45) { // smoke
    ctx.fillStyle = 'rgba(120,120,120,0.7)';
    ctx.beginPath(); ctx.arc(-c.len / 2, 0, 6 + Math.random() * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCars(ctx, S) {
  for (const c of S.cars) {
    if (c.dead) continue;
    if (c.x < S.cam.x - 80 || c.x > S.cam.x + VIEW_W + 80 || c.y < S.cam.y - 80 || c.y > S.cam.y + VIEW_H + 80) continue;
    drawCarShape(ctx, c);
    if (c.driver === 'player') {
      ctx.strokeStyle = '#57e389'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawPeds(ctx, S) {
  for (const ped of S.peds) {
    if (ped.x < S.cam.x - 40 || ped.x > S.cam.x + VIEW_W + 40 || ped.y < S.cam.y - 40 || ped.y > S.cam.y + VIEW_H + 40) continue;
    ctx.save(); ctx.translate(ped.x, ped.y);
    if (ped.hp <= 0) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#888'; }
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(0, -2 + bob * 0.3, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, -4 + bob * 0.3, 5.5, Math.PI, 0); ctx.fill();
    ctx.restore();
  }
}

function drawCops(ctx, S) {
  for (const cop of S.cops) {
    ctx.save(); ctx.translate(cop.x, cop.y);
    ctx.fillStyle = '#1e3a8a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(-7, -9, 14, 5);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('SBPD', 0, 3);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawEnemies(ctx, S) {
  for (const e of S.enemies) {
    if (e.dead) continue;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = '#7b2d26'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(-6, -8, 12, 4);
    // Gun pointing at the player.
    ctx.rotate(e.angle);
    ctx.fillStyle = '#333'; ctx.fillRect(8, -2, 16, 4);
    ctx.restore();
    ctx.fillStyle = '#333'; ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp) / 100, 5);
  }
}

function drawBullets(ctx, S) {
  for (const b of S.bullets) {
    // Tracer: a short bright line behind the bullet head.
    ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 16, b.y - Math.sin(b.angle) * 16);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
}

function drawPlayer(ctx, S) {
  const p = S.player;
  if (p.inCar || p.dead) return;
  ctx.save(); ctx.translate(p.x, p.y);
  const bob = Math.sin(S.time * 10) * 1.5;
  ctx.rotate(p.aimAngle ?? p.angle);
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(2, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#333'; ctx.fillRect(10, -2, 16, 4); // gun
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(-6, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#57e389'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 16 + Math.sin(S.time * 3) * 2, 0, Math.PI * 2); ctx.stroke();
}

function drawParticles(ctx, S) {
  for (const pt of S.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

// --- Screens ----------------------------------------------------------------
export function drawTitle(ctx, S) {
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sun-soaked skyline backdrop.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#ff9a3c'); g.addColorStop(0.5, '#ff6b6b'); g.addColorStop(1, '#2b1055');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(1020, 150, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,16,40,0.85)';
  let x = 0;
  for (let i = 0; i < 22; i++) { const h = 120 + ((i * 53) % 220); ctx.fillRect(x, VIEW_H - 260 - h + 120, 58, h + 140); x += 60; }
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0, VIEW_H - 140, VIEW_W, 140);
  ctx.fillStyle = '#3a3f47'; ctx.fillRect(0, VIEW_H - 120, VIEW_W, 60);
  ctx.fillStyle = '#e8d44d';
  for (let i = 0; i < 16; i++) ctx.fillRect(i * 84 + 20, VIEW_H - 92, 40, 5);
  ctx.fillStyle = '#e33fa1'; ctx.fillRect(180, VIEW_H - 168, 46, 22);
  ctx.fillStyle = '#f5c518'; ctx.fillRect(700, VIEW_H - 168, 46, 22);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 18;
  ctx.fillText(GAME_NAME, VIEW_W / 2, 200);
  ctx.shadowBlur = 0;
  ctx.font = '28px system-ui, sans-serif'; ctx.fillStyle = '#ffd23f';
  ctx.fillText(`An open-world crime story in ${CITY_NAME}`, VIEW_W / 2, 250);
  ctx.font = '17px system-ui, sans-serif'; ctx.fillStyle = '#fff';
  const lines = [
    `${PLAYER_NAME} is back in ${CITY_NAME} with empty pockets and a long memory.`,
    `${CONTACT_NAME} has work — six jobs, from a stolen sedan to the last delivery.`,
    `Steal cars, dodge the SBPD, run the missions, and make the city yours.`,
    `Day turns to night, rain rolls in, and 10 hidden stash drops pay $100 each.`,
    ``,
    `WASD move / drive · E enter & exit cars · Mouse aim, Click shoot · F punch`,
    `Shift sprint · G horn · N start mission · T taxi fare · R rampage · P pause · M mute`,
    ``,
    `▶  CLICK or press ENTER to start  ·  L load save`,
  ];
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 310 + i * 28));
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('An original game — its city, characters and story are invented, not copied from any other game.', VIEW_W / 2, VIEW_H - 24);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, S) {
  ctx.fillStyle = 'rgba(5,8,16,0.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px system-ui, sans-serif'; ctx.fillText('PAUSED', VIEW_W / 2, 300);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(`Money $${S.money} · Missions done ${S.stats.missionsDone} of ${MISSION_DEFS.length} · Cars stolen ${S.stats.carsStolen} · Stash ${S.stashGot}/${S.stashTotal} · Stunts ${S.stats.stunts}`, VIEW_W / 2, 350);
  ctx.fillText('P resume · H save · L load · Enter restart · M mute', VIEW_W / 2, 390);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, S, kind) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,60,0.85)' : 'rgba(60,5,5,0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#7db4ff' : '#ff6b6b';
  ctx.font = 'bold 90px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', VIEW_W / 2, 330);
  ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(kind === 'busted'
    ? 'The SBPD caught up with you. Bail is $200 — or start over fresh.'
    : 'Solmar Bay got the better of you this time.', VIEW_W / 2, 390);
  ctx.fillText(`Money $${S.money} · Missions done ${S.stats.missionsDone} of ${MISSION_DEFS.length}`, VIEW_W / 2, 430);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('Press ENTER to get back out there', VIEW_W / 2, 480);
  ctx.textAlign = 'left';
}

export function drawMissionDone(ctx, S) {
  ctx.fillStyle = 'rgba(5,20,10,0.7)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#57e389';
  ctx.font = 'bold 56px system-ui, sans-serif'; ctx.fillText('STORY COMPLETE', VIEW_W / 2, 320);
  ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`${PLAYER_NAME} owns ${CITY_NAME} now. Free roam, or press ENTER to keep playing.`, VIEW_W / 2, 380);
  ctx.textAlign = 'left';
}
