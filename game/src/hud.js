// HUD for Solmar Nights 3D: money, stars, health, clock, objective,
// dispatch board, weapon slots, radio, respect, crew skills, garage,
// circular minimap, dialogue portraits, big speedometer, banners.

import { S } from './state.js';
import { WEAPONS, WEAPON_UNLOCKS, RADIO, RANKS, CREW, TURFS, GARAGE, AREAS } from './config.js';
import { fmtMoney, fmtClock, fmtTime, dist2d } from './random.js';
import { DISPATCH } from './police.js';
import { nightFactor } from './render.js';

const $ = id => document.getElementById(id);
let els = {};
let minimap = null, mctx = null, portrait = null, pctx = null;

export function initHud() {
  els = {
    money: $('hud-money'), health: $('hud-health'), healthBar: $('hud-health-bar'),
    armor: $('hud-armor'), armorBar: $('hud-armor-bar'), stars: $('hud-stars'),
    clock: $('hud-clock'), day: $('hud-day'), weather: $('hud-weather'),
    objective: $('hud-objective'), missionClock: $('hud-mission-clock'),
    dispatch: $('hud-dispatch'), dispatchList: $('hud-dispatch-list'),
    weapons: $('hud-weapons'), radio: $('hud-radio'), radioTrack: $('hud-radio-track'),
    speed: $('hud-speed'), carName: $('hud-car-name'), carCond: $('hud-car-cond'),
    nitro: $('hud-nitro'), area: $('hud-area'), respect: $('hud-respect'),
    respectBar: $('hud-respect-bar'), crew: $('hud-crew'), banner: $('hud-banner'),
    bannerText: $('hud-banner-text'), bannerSub: $('hud-banner-sub'),
    dialogue: $('hud-dialogue'), dlgName: $('hud-dlg-name'), dlgLine: $('hud-dlg-line'),
    raceCount: $('hud-race-count'), stamina: $('hud-stamina'), staminaBar: $('hud-stamina-bar'),
    title: $('screen-title'), pause: $('screen-pause'), busted: $('screen-busted'),
    wasted: $('screen-wasted'), complete: $('screen-complete'),
    stash: $('hud-stash'), turf: $('hud-turf'), jobs: $('hud-jobs'),
  };
  minimap = $('hud-minimap');
  if (minimap) mctx = minimap.getContext('2d');
  portrait = $('hud-portrait');
  if (portrait) pctx = portrait.getContext('2d');
  buildWeaponSlots();
  buildCrew();
}

function buildWeaponSlots() {
  if (!els.weapons) return;
  els.weapons.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'wslot';
    d.id = 'wslot-' + i;
    d.innerHTML = `<span class="wkey">${i + 1}</span><span class="wname">${w.name}</span><span class="wammo"></span>`;
    els.weapons.appendChild(d);
  });
}

function buildCrew() {
  if (!els.crew) return;
  els.crew.innerHTML = '';
  for (const c of CREW) {
    const d = document.createElement('div');
    d.className = 'crew';
    d.id = 'crew-' + c.id;
    d.innerHTML = `<span class="ckey">${c.key}</span><span class="cname">${c.name}</span><span class="ccd"></span>`;
    els.crew.appendChild(d);
  }
}

export function updateHud(dt) {
  if (!els.money) return;
  // Money / vitals.
  els.money.textContent = fmtMoney(S.money);
  els.healthBar.style.width = S.health + '%';
  els.health.textContent = Math.ceil(S.health);
  els.armorBar.style.width = S.armor + '%';
  els.armor.textContent = Math.ceil(S.armor);
  els.staminaBar.style.width = S.stamina + '%';
  els.stamina.textContent = Math.ceil(S.stamina);
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  els.stars.textContent = stars;
  els.stars.className = 'stars' + (S.wanted >= 3 ? ' hot' : '');
  els.clock.textContent = fmtClock(S.clockMin);
  els.day.textContent = 'DAY ' + S.day;
  els.weather.textContent = S.weather.rain > 0.4 ? '🌧 RAIN' : nightFactor() > 0.6 ? '🌙 NIGHT' : '☀️ DUSK';
  els.objective.textContent = S.objective;
  els.missionClock.textContent = S.missionClock > 0 ? fmtTime(S.missionClock) : '';
  // Jobs / stash / turf counters.
  const stashLeft = S.stash.filter(s => !s.taken).length;
  els.stash.textContent = `◆ STASH ${10 - stashLeft}/10`;
  const owned = Object.values(S.turfs).filter(t => t.owner === 'player').length;
  els.turf.textContent = `⬢ TURF ${owned}/5`;
  els.jobs.textContent = `JOBS ${S.missionsDone.length}/8`;
  // Area name from nearest named place.
  let best = null, bd = 1e9;
  for (const a of AREAS) {
    const d = dist2d(S.player.x, S.player.z, a.x, a.z);
    if (d < bd) { bd = d; best = a; }
  }
  S.area = best ? best.name : 'DOWNTOWN';
  els.area.textContent = S.area;
  // Dispatch board.
  if (S.wanted > 0 && DISPATCH.length) {
    els.dispatch.style.display = 'block';
    els.dispatchList.innerHTML = DISPATCH.map(u =>
      `<div class="unit"><span class="uname">${u.name}</span><span class="urole">${u.role}</span><span class="udist">${u.dist}m</span></div>`
    ).join('') + (S.wanted >= 3 ? '<div class="unit more">+ AIR ONE overhead</div>' : '');
  } else {
    els.dispatch.style.display = S.wanted > 0 ? 'block' : 'none';
    if (S.wanted > 0) els.dispatchList.innerHTML = '<div class="unit"><span class="urole">RESPONDING…</span></div>';
  }
  // Weapon slots.
  WEAPONS.forEach((w, i) => {
    const slot = $('wslot-' + i);
    if (!slot) return;
    const unlocked = w.id === 'fists' || w.id === 'pistol' || S.respectRank >= (WEAPON_UNLOCKS[w.id] ?? 99);
    const ammo = w.ammo === Infinity ? '∞' : (S.ammo[w.id] ?? 0);
    slot.classList.toggle('active', i === S.weapon);
    slot.classList.toggle('locked', !unlocked);
    slot.querySelector('.wammo').textContent = unlocked ? ammo : 'LOCKED';
  });
  // Radio.
  const st = RADIO[S.radio.station];
  els.radio.textContent = '♪ ' + st.name;
  els.radioTrack.textContent = st.tracks[S.radio.track];
  // Speedometer + car.
  const car = S.player.car;
  if (car) {
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    els.speed.textContent = kmh;
    els.carName.textContent = car.def.name.toUpperCase();
    const cond = Math.max(0, 100 - car.damage);
    els.carCond.textContent = 'COND ' + Math.round(cond) + '%';
    els.carCond.style.color = cond > 50 ? '#8ae68a' : cond > 25 ? '#ffd23a' : '#ff5a4a';
    els.nitro.style.width = Math.min(100, Math.abs(car.speed) / car.def.top * 100) + '%';
  } else {
    els.speed.textContent = Math.round(S.player.speed * 3.6);
    els.carName.textContent = 'ON FOOT';
    els.carCond.textContent = '';
    els.nitro.style.width = '0%';
  }
  // Respect / rank.
  const rank = RANKS[S.respectRank];
  const next = RANKS[S.respectRank + 1];
  els.respect.textContent = `RESPECT LV ${S.respectRank + 1} · ${rank.title} — ${S.rp} RP${next ? ' / ' + next.rp : ' MAX'}`;
  els.respectBar.style.width = next ? Math.min(100, (S.rp - rank.rp) / (next.rp - rank.rp) * 100) + '%' : '100%';
  // Crew cooldowns.
  for (const c of CREW) {
    const el = $('crew-' + c.id);
    if (!el) continue;
    const cd = S.crewCd[c.id] || 0;
    el.classList.toggle('ready', cd <= 0);
    el.querySelector('.ccd').textContent = cd > 0 ? Math.ceil(cd) + 's' : 'READY';
  }
  // Banner.
  if (S.banner) {
    S.banner.t -= dt;
    els.banner.style.display = 'block';
    els.bannerText.textContent = S.banner.text;
    els.bannerSub.textContent = S.banner.sub || '';
    if (S.banner.t <= 0) { S.banner = null; els.banner.style.display = 'none'; }
  } else {
    els.banner.style.display = 'none';
  }
  // Race countdown.
  els.raceCount.textContent = S.raceCount || '';
  els.raceCount.style.display = S.raceCount ? 'block' : 'none';
  // Dialogue.
  if (S.dialogue) {
    S.dialogue.t -= dt;
    els.dialogue.style.display = 'flex';
    els.dlgName.textContent = S.dialogue.name;
    els.dlgLine.textContent = S.dialogue.line;
    drawPortrait(S.dialogue.name);
    if (S.dialogue.t <= 0) { S.dialogue = null; els.dialogue.style.display = 'none'; }
  } else {
    els.dialogue.style.display = 'none';
  }
  // Screens.
  setScreen(els.title, S.mode === 'title');
  setScreen(els.pause, S.mode === 'pause');
  setScreen(els.busted, S.mode === 'busted');
  setScreen(els.wasted, S.mode === 'wasted');
  setScreen(els.complete, S.mode === 'complete');
  drawMinimap();
}

function setScreen(el, show) {
  if (el) el.style.display = show ? 'flex' : 'none';
}

const PORTRAIT_COLORS = {
  'VERA SOLANO': ['#7a2a4a', '#e8b88a', '#2a2a3a'],
  'SBPD DISPATCH': ['#1d2f4a', '#c9a86a', '#f2f2f2'],
  'MACK': ['#3a4a3a', '#c98a5e', '#5a3a22'],
  'RIVAL': ['#4a2a5a', '#d8b88a', '#1a1a22'],
  'ROOK MARLOW': ['#2a4a6a', '#c98a5e', '#d84a3a'],
};

function drawPortrait(name) {
  if (!pctx) return;
  const [bg, skin, hair] = PORTRAIT_COLORS[name] || ['#333', '#c98a5e', '#222'];
  pctx.fillStyle = bg; pctx.fillRect(0, 0, 96, 96);
  pctx.fillStyle = skin;
  pctx.beginPath(); pctx.arc(48, 44, 22, 0, Math.PI * 2); pctx.fill();
  pctx.fillStyle = hair;
  pctx.beginPath(); pctx.arc(48, 34, 22, Math.PI, 0); pctx.fill();
  pctx.fillStyle = '#222';
  pctx.fillRect(36, 40, 6, 4); pctx.fillRect(54, 40, 6, 4);
  pctx.fillStyle = '#8a3a2a'; pctx.fillRect(42, 56, 12, 3);
  pctx.fillStyle = '#2a4a6a'; pctx.fillRect(22, 72, 52, 24);
}

function drawMinimap() {
  if (!mctx) return;
  const size = 200, R = 96, cx = 100, cy = 100;
  const scale = R / 580;
  mctx.clearRect(0, 0, size, size);
  // Circular mask.
  mctx.save();
  mctx.beginPath(); mctx.arc(cx, cy, R, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#20242e'; mctx.fillRect(0, 0, size, size);
  const toMap = (x, z) => [cx + x * scale, cy + z * scale];
  // Sea + beach.
  mctx.fillStyle = '#1d6f7a';
  mctx.fillRect(0, cy - 580 * scale, size, 60 * scale);
  mctx.fillStyle = '#d9b380';
  mctx.fillRect(0, cy - 520 * scale, size, 12 * scale);
  // Roads.
  mctx.strokeStyle = '#4a4550'; mctx.lineWidth = 5;
  for (let i = -5; i <= 5; i++) {
    const [x1, y1] = toMap(i * 100, -560); const [x2, y2] = toMap(i * 100, 560);
    mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
    const [x3, y3] = toMap(-560, i * 100); const [x4, y4] = toMap(560, i * 100);
    mctx.beginPath(); mctx.moveTo(x3, y3); mctx.lineTo(x4, y4); mctx.stroke();
  }
  // Turfs.
  for (const t of TURFS) {
    const [x, y] = toMap(t.x, t.z);
    const own = S.turfs[t.id];
    mctx.strokeStyle = own && own.owner === 'player' ? '#3aff7a' : '#ffb03a';
    mctx.lineWidth = 1.5;
    mctx.beginPath(); mctx.arc(x, y, t.r * scale, 0, Math.PI * 2); mctx.stroke();
  }
  // Stash dots.
  mctx.fillStyle = '#ffd23a';
  for (const st of S.stash) {
    if (st.taken) continue;
    const [x, y] = toMap(st.x, st.z);
    mctx.fillRect(x - 2, y - 2, 4, 4);
  }
  // Waypoint.
  if (S.mission) {
    const tgt = window.__waypoint;
    if (tgt) {
      const [x, y] = toMap(tgt.x, tgt.z);
      mctx.fillStyle = '#ffd23a';
      mctx.beginPath(); mctx.arc(x, y, 5, 0, Math.PI * 2); mctx.fill();
    }
  }
  // Cops (red) and gang (purple).
  mctx.fillStyle = '#ff3a3a';
  for (const c of S.cops) {
    if (!c.inCar) continue;
    const [x, y] = toMap(c.x, c.z);
    mctx.beginPath(); mctx.arc(x, y, 3.5, 0, Math.PI * 2); mctx.fill();
  }
  mctx.fillStyle = '#c03aff';
  for (const g of S.gang) {
    if (g.dead) continue;
    const [x, y] = toMap(g.x, g.z);
    mctx.beginPath(); mctx.arc(x, y, 3, 0, Math.PI * 2); mctx.fill();
  }
  // Player arrow.
  const [px, py] = toMap(S.player.x, S.player.z);
  const heading = S.player.car ? S.player.car.heading : S.player.heading;
  mctx.save();
  mctx.translate(px, py);
  mctx.rotate(Math.PI - heading);
  mctx.fillStyle = '#fff';
  mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
  mctx.restore();
  // North tick + ring.
  mctx.restore();
  mctx.strokeStyle = '#e8e8e8'; mctx.lineWidth = 3;
  mctx.beginPath(); mctx.arc(cx, cy, R, 0, Math.PI * 2); mctx.stroke();
  mctx.fillStyle = '#fff'; mctx.font = 'bold 12px sans-serif'; mctx.textAlign = 'center';
  mctx.fillText('N', cx, cy - R + 14);
}
