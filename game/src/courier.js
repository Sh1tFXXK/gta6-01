// courier.js — repeatable courier gigs for Solmar Bay. One job: a small,
// always-available job for free-roam play.
// Vera's story missions run out; the courier gig never does. Press C and a
// client somewhere in the city wants a package moved: pick it up, drop it
// off, get paid. The faster the drop, the bigger the tip — and the gig
// pays more the further apart the two ends are, so cross-town runs are
// worth the drive. It is the game's pocket money between races and turf.
import { dist } from './random.js';
import { addMessage, addMoney } from './state.js';

// Gig tuning: how long each leg lasts, and what a leg pays.
export const COURIER_LEG_TIME = 100;
export const COURIER_BASE_PAY = 40;
export const COURIER_TIP_PER_SECOND = 1;

// The named places a gig can use. The bank and the safehouse are Vera's,
// not the clients' — a courier gig never sends the player to either.
const COURIER_PLACES = ['docks', 'plaza', 'hotel', 'arcade', 'gas', 'pier', 'hospital'];

export function initCourier(S) {
  S.courier = {
    active: false, stage: 0, timer: 0,
    pickup: null, drop: null, pay: 0,
    done: 0, earned: 0,
  };
}

function pickPlace(S, rng, notKey) {
  const names = COURIER_PLACES.filter((n) => n !== notKey);
  const name = names[Math.floor(rng.range(0, names.length))];
  const place = S.city.places[name];
  return { key: name, x: place.x, y: place.y, label: place.label };
}

// Press C to take a gig. One at a time — the clients share a dispatcher,
// and the dispatcher does not double-book.
export function startCourier(S, rng, audio) {
  if (!S.courier) initCourier(S);
  const gig = S.courier;
  if (gig.active) { addMessage(S, 'You already have a package to move — finish this gig first.'); return; }
  gig.pickup = pickPlace(S, rng, null);
  gig.drop = pickPlace(S, rng, gig.pickup.key);
  // Pay scales with the distance between the two ends: a cross-town run
  // pays for the petrol, a hop across the Plaza barely covers the trouble.
  const d = dist(gig.pickup.x, gig.pickup.y, gig.drop.x, gig.drop.y);
  gig.pay = COURIER_BASE_PAY + Math.round(d / 40);
  gig.active = true;
  gig.stage = 0;
  gig.timer = COURIER_LEG_TIME;
  S.mission.banner = `COURIER GIG — pick up at ${gig.pickup.label}`;
  S.mission.bannerT = 3;
  addMessage(S, `Courier gig: pick up the package at ${gig.pickup.label}, drop it at ${gig.drop.label} — $${gig.pay} plus a speed tip.`);
  if (audio) audio.pickup();
}

// A gig that ends badly: the client cancels, the package stays where it is,
// and there is no fee — the dispatcher just stops calling for a while.
function cancelCourier(S, why, audio) {
  const gig = S.courier;
  gig.active = false;
  gig.pickup = null;
  gig.drop = null;
  addMessage(S, `Gig cancelled — ${why}`);
  if (audio) audio.missionFail();
}

export function updateCourier(S, dt, audio) {
  if (!S.courier || !S.courier.active) return;
  const gig = S.courier;
  gig.timer -= dt;
  if (gig.timer <= 0) {
    return cancelCourier(S, 'you took too long.', audio);
  }
  // Getting busted or wasted mid-gig ends it the same way a late drop does.
  if (S.screen !== 'play') return cancelCourier(S, 'the run went sideways.', audio);
  if (gig.stage === 0) {
    if (dist(S.player.x, S.player.y, gig.pickup.x, gig.pickup.y) < 90) {
      gig.stage = 1;
      gig.timer = COURIER_LEG_TIME;
      addMessage(S, 'Package collected — now get it to the drop-off, quick!');
      if (audio) audio.pickup();
    }
    return;
  }
  if (gig.stage === 1) {
    if (dist(S.player.x, S.player.y, gig.drop.x, gig.drop.y) < 90) {
      // The tip is the time left on the clock, a dollar a second: a fast
      // driver earns nearly double, a dawdler earns the base pay.
      const tip = Math.round(gig.timer * COURIER_TIP_PER_SECOND);
      const total = gig.pay + tip;
      gig.done++;
      gig.earned += total;
      addMoney(S, total, `courier gig done ($${gig.pay} + $${tip} speed tip)`);
      S.mission.banner = `GIG DONE  +$${total}`;
      S.mission.bannerT = 3;
      gig.active = false;
      gig.pickup = null;
      gig.drop = null;
      if (audio) audio.cash();
    }
    return;
  }
}

// The gig's current end, for the HUD and the world marker: the pickup
// while fetching, the drop while delivering, nothing when idle.
export function courierTarget(S) {
  if (!S.courier || !S.courier.active) return null;
  return S.courier.stage === 0 ? S.courier.pickup : S.courier.drop;
}

// One line for the HUD: what the gig is, and how long is left on the leg.
export function courierHudLine(S) {
  if (!S.courier || !S.courier.active) return '';
  const gig = S.courier;
  const where = gig.stage === 0 ? `Pick up at ${gig.pickup.label}` : `Drop at ${gig.drop.label}`;
  return `📦 ${where} — ${Math.ceil(gig.timer)}s — $${gig.pay}+tip`;
}

// World-space drawing: a brown parcel marker over the current end, with a
// pulsing ring so a driver can spot it from down the street. Called from
// drawWorld, inside the camera transform.
export function drawCourier(ctx, S) {
  const target = courierTarget(S);
  if (!target) return;
  const pulse = 1 + Math.sin(S.time * 4) * 0.15;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = '#b7791f';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(183,121,31,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2); ctx.fill();
  // The parcel itself: a brown box with tape across it.
  ctx.fillStyle = '#b7791f';
  ctx.fillRect(-12, -10, 24, 20);
  ctx.fillStyle = '#e8c87a';
  ctx.fillRect(-2, -10, 4, 20);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(S.courier.stage === 0 ? 'PICK UP' : 'DROP OFF', 0, -38);
  ctx.restore();
  ctx.textAlign = 'left';
}
