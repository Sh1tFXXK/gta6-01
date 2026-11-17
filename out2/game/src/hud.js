// hud.js — the on-screen HUD and the live minimap. One job: information display.
import { VIEW_W, VIEW_H, TILE, CITY_SIZE, COLORS } from './config.js';
import { MISSION_DEFS } from './config.js';

function fmtClock(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHUD(ctx, S) {
  const p = S.player;
  ctx.save();
  // Top-left status panel.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 12, 12, 300, 108, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`$${S.money.toLocaleString()}`, 26, 40);
  ctx.font = '15px system-ui, sans-serif'; ctx.fillStyle = '#ffd23f';
  ctx.fillText(`★ `.repeat(0) + '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted), 26, 66);
  ctx.fillStyle = '#fff';
  ctx.fillText(`🕐 ${fmtClock(S.clockMin)}   Day 1`, 150, 66);
  // Health bar.
  ctx.fillStyle = '#333'; roundRect(ctx, 26, 78, 150, 14, 7); ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#57e389' : '#ff4d4d';
  roundRect(ctx, 26, 78, 150 * Math.max(0, p.health) / 100, 14, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`HEALTH ${Math.ceil(p.health)}`, 182, 90);
  ctx.fillText(`AMMO ${p.ammo}`, 26, 112);
  ctx.fillText(`CAR ${p.inCar ? p.inCar.typeName + '  ♥' + Math.max(0, Math.ceil(p.inCar.hp)) : 'on foot'}`, 110, 112);
  // Mission objective panel (top centre).
  if (S.mission.objective) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = Math.min(560, ctx.measureText(S.mission.objective).width + 36);
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, (VIEW_W - w) / 2, 12, w, 34, 9); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center';
    ctx.fillText('◆ ' + S.mission.objective, VIEW_W / 2, 35);
    ctx.textAlign = 'left';
  }
  // Mission timer / rampage timer.
  if (S.mission.active && S.mission.timer > 0) {
    ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`⏱ ${Math.ceil(S.mission.timer)}s`, VIEW_W / 2 - 40, 66);
  }
  if (S.rampage.active) {
    ctx.fillStyle = '#ff9f1c'; ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`RAMPAGE ${Math.ceil(S.rampage.timer)}s — ${S.rampage.kills} down`, 24, VIEW_H - 24);
  }
  // Toast messages.
  ctx.font = '14px system-ui, sans-serif';
  let y = 140;
  for (const m of S.messages) {
    ctx.fillStyle = 'rgba(8,12,20,0.65)';
    const w = ctx.measureText(m.text).width + 20;
    roundRect(ctx, 12, y, w, 24, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(m.text, 22, y + 17);
    y += 30;
  }
  // Big centre banner (mission start / complete / fail).
  if (S.mission.bannerT > 0 && S.mission.banner) {
    ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(S.mission.banner).width + 60;
    roundRect(ctx, (VIEW_W - w) / 2, VIEW_H / 2 - 110, w, 56, 10); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(S.mission.banner, VIEW_W / 2, VIEW_H / 2 - 72);
    ctx.textAlign = 'left';
  }
  // Controls reminder (bottom centre, small).
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WASD move / drive · E enter car · Click shoot · F punch · N mission · T taxi fare · R rampage · P pause · M mute', VIEW_W / 2, VIEW_H - 8);
  ctx.textAlign = 'left';
  ctx.restore();
}

export function drawMinimap(ctx, S) {
  const size = 190, x0 = VIEW_W - size - 14, y0 = 14;
  const scale = size / CITY_SIZE;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10); ctx.fill();
  // Sea + land.
  ctx.fillStyle = '#2e8fd6'; ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#7ec850'; ctx.fillRect(x0, y0, size * 0.92, size);
  ctx.fillStyle = '#f2d8a0'; ctx.fillRect(x0 + size * 0.90, y0, size * 0.02, size);
  // Roads.
  ctx.fillStyle = '#3a3f47';
  for (let i = 0; i < 8; i++) {
    const p = i * 8 * TILE * scale;
    ctx.fillRect(x0 + p, y0, 2 * TILE * scale, size);
    ctx.fillRect(x0, y0 + p, size, 2 * TILE * scale);
  }
  // Mission target.
  const t = S.mission.active ? S.mission.target : (S.taxi.active ? S.taxi.fare : null);
  if (t) {
    ctx.fillStyle = '#ffd23f';
    const mx = x0 + t.x * scale, my = y0 + t.y * scale;
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }
  // Cop cars (blue), traffic (white dots), player (green triangle).
  for (const c of S.cars) {
    if (c.dead) continue;
    ctx.fillStyle = c.driver === 'cop' ? '#3b82f6' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(x0 + c.x * scale - 2, y0 + c.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#57e389';
  const px = x0 + S.player.x * scale, py = y0 + S.player.y * scale;
  ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.lineTo(px + 5, py + 5); ctx.lineTo(px - 5, py + 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.strokeRect(x0 + S.cam.x * scale, y0 + S.cam.y * scale, VIEW_W * scale, VIEW_H * scale);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', x0 + 2, y0 + size + 24);
  ctx.fillText(`★${S.wanted}  $${S.money}`, x0 + 110, y0 + size + 24);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
