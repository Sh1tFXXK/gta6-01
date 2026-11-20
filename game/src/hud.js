// hud.js — the on-screen HUD and the live minimap. One job: information display.
import { VIEW_W, VIEW_H, TILE, CITY_SIZE, COLORS } from './config.js';
import { MISSION_DEFS } from './config.js';
import { challengeHudLines } from './challenges.js';
import { courierHudLine } from './courier.js';

function fmtClock(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHUD(ctx, S) {
  const p = S.player;
  ctx.save();
  // Top-left status panel. Kept narrow (280px) so the world beside it stays
  // visible — a taxi parked at the panel's edge used to hide half under it.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 12, 12, 280, 132, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`$${S.money.toLocaleString()}`, 26, 40);
  ctx.font = '15px system-ui, sans-serif'; ctx.fillStyle = '#ffd23f';
  ctx.fillText('★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted), 26, 66);
  ctx.fillStyle = '#fff';
  // Rain shows as a cloud next to the clock; the day ticks over at midnight.
  const weatherIcon = S.weather.kind === 'rain' ? '🌧 ' : '';
  ctx.fillText(`${weatherIcon}🕐 ${fmtClock(S.clockMin)}   Day ${S.day}`, 150, 66);
  // Health bar.
  ctx.fillStyle = '#333'; roundRect(ctx, 26, 78, 150, 14, 7); ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#57e389' : '#ff4d4d';
  roundRect(ctx, 26, 78, 150 * Math.max(0, p.health) / 100, 14, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`HEALTH ${Math.ceil(p.health)}`, 182, 90);
  // Sprint stamina bar (only matters on foot, but always visible).
  ctx.fillStyle = '#333'; roundRect(ctx, 26, 98, 150, 8, 4); ctx.fill();
  ctx.fillStyle = p.stamina > 25 ? '#ffd23f' : '#ff9f1c';
  roundRect(ctx, 26, 98, 150 * Math.max(0, p.stamina) / 100, 8, 4); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('SPRINT', 182, 106);
  ctx.fillText(`AMMO ${p.ammo}`, 26, 124);
  ctx.fillText(`CAR ${p.inCar ? p.inCar.typeName + '  ♥' + Math.max(0, Math.ceil(p.inCar.hp)) : 'on foot'}`, 110, 124);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(`◆ STASH ${S.stashGot}/${S.stashTotal}`, 26, 140);
  // Round 3: turf standing and the active race, right under the stash line.
  if (S.turf) {
    const owned = S.turf.zones.filter((z) => z.owner === 'rook').length;
    ctx.fillStyle = '#57e389';
    ctx.fillText(`⬢ TURF ${owned}/5  +$${S.turf.earned}`, 150, 140);
  }
  if (S.race && S.race.active && S.race.def) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`🏁 ${S.race.def.name}  CP ${S.race.cp}/${S.race.def.checkpoints.length}  ${S.race.timer.toFixed(1)}s`, 26, 158);
    ctx.font = '12px system-ui, sans-serif';
  }
  if (S.escort && S.escort.car) {
    ctx.fillStyle = '#fff';
    ctx.fillText(`VERA ♥${Math.max(0, Math.ceil(S.escort.car.hp))}`, 26, 176);
  }
  // Round 3: today's challenge, one line under everything else.
  if (S.daily) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = '12px system-ui, sans-serif';
    for (const line of challengeHudLines(S)) {
      ctx.fillText(line, 26, 194);
      break; // one line fits; the rest wait for the pause screen
    }
  }
  // Round 3: the active courier gig, with its countdown.
  if (S.courier && S.courier.active) {
    ctx.fillStyle = '#e8c87a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(courierHudLine(S), 26, 212);
  }
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
  // Race countdown, big and centred — the light is red until it says GO.
  if (S.race && S.race.active && S.race.countdown > 0) {
    ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 44px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(S.race.countdown)), VIEW_W / 2, VIEW_H / 2 - 160);
    ctx.textAlign = 'left';
  }
  if (S.rampage.active) {
    ctx.fillStyle = '#ff9f1c'; ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`RAMPAGE ${Math.ceil(S.rampage.timer)}s — ${S.rampage.kills} down`, 24, VIEW_H - 24);
  }
  // Toast messages (start below the taller status panel — lower still when
  // the race / escort lines are showing, so nothing overlaps).
  ctx.font = '14px system-ui, sans-serif';
  let y = (S.race && S.race.active) || S.escort || (S.courier && S.courier.active) ? 224 : 164;
  for (const m of S.messages) {
    ctx.fillStyle = 'rgba(8,12,20,0.65)';
    const w = ctx.measureText(m.text).width + 20;
    roundRect(ctx, 12, y, w, 24, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(m.text, 22, y + 17);
    y += 30;
  }
  // Big centre banner (mission start / complete / fail / stunt).
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
  ctx.fillText('WASD move / drive · E enter car · Click shoot · F punch · Shift sprint · G horn · N mission · T taxi fare · R rampage · V race · C courier · P pause · M mute', VIEW_W / 2, VIEW_H - 8);
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
  // Roads, drawn as thin 2px centrelines — and only every other street, so
  // the minimap reads as a street map instead of a dense grey grid.
  ctx.fillStyle = '#3a3f47';
  for (let i = 0; i < 8; i += 2) {
    const p = (i * 8 + 1) * TILE * scale;
    ctx.fillRect(x0 + p - 1, y0, 2, size);
    ctx.fillRect(x0, y0 + p - 1, size, 2);
  }
  // Stash spots (gold dots) and ramps (yellow squares) on the minimap.
  ctx.fillStyle = '#ffd23f';
  for (const pk of S.pickups) {
    if (pk.kind !== 'stash') continue;
    ctx.fillRect(x0 + pk.x * scale - 2, y0 + pk.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#ffe066';
  for (const r of S.city.ramps) ctx.fillRect(x0 + r.x * scale - 2, y0 + r.y * scale - 2, 4, 4);
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
