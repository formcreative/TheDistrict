import { W, H, CAFE_PRICE, GRASS, LAWNS } from './config.js';
import { audio } from './audio.js';
import { createGrass, updateGrass, cutAlong, drawLawnPatches, drawTufts, TALL, LUSH } from './grass.js';
import { Coins } from './coins.js';
import { Cafe } from './cafe.js';
import { Customers } from './customers.js';
import { FX } from './fx.js';
import { Hud, drawHand } from './hud.js';
import { drawBackdrop } from './world.js';
import { FONT } from './draw.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const view = { scale: 1, ox: 0, oy: 0, dpr: 1, x0: 0, x1: W, y0: 0, y1: H };
const state = { cash: 0, time: 0, cuts: 0, streak: 0, lastCollect: -1, shake: 0, everAfforded: false };

const tufts = createGrass(LAWNS);
const coins = new Coins();
const cafe = new Cafe();
const customers = new Customers();
const fx = new FX();
const hud = new Hud();

let stroke = null;

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const scale = Math.min(r.width / W, r.height / H);
  view.dpr = dpr;
  view.scale = scale;
  view.ox = (r.width - W * scale) / 2;
  view.oy = (r.height - H * scale) / 2;
  view.x0 = -view.ox / scale;
  view.x1 = (r.width - view.ox) / scale;
  view.y0 = -view.oy / scale;
  view.y1 = (r.height - view.oy) / scale;
  hud.layout(view);
}

function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.ox) / view.scale, y: (e.clientY - r.top - view.oy) / view.scale };
}

function vibrate(ms) {
  try { navigator.vibrate?.(ms); } catch { /* not available */ }
}

function onCut(t, wasWeed) {
  state.cuts++;
  fx.clippings(t.x, t.y - 8, t.lush ? LUSH : TALL);
  const n = wasWeed ? GRASS.weedCoins : 1;
  for (let i = 0; i < n; i++) coins.pop(t.x, t.y - 4, GRASS.coinValue, i * 0.05);
  if (wasWeed) fx.sparkles(t.x, t.y - 16, 4, 14);
  audio.snip();
  if (stroke) {
    stroke.count++;
    const praise = { 12: 'Nice!', 24: 'Great!', 40: 'Amazing!' }[stroke.count];
    if (praise) {
      fx.floater(praise, stroke.last.x, stroke.last.y - 30, '#fff6a0', 26);
      audio.praise();
    }
  }
  if (state.cuts % 3 === 0) vibrate(6);
}

function onCollect(value) {
  state.cash += value;
  if (state.time - state.lastCollect < 0.35) state.streak++;
  else state.streak = 0;
  state.lastCollect = state.time;
  hud.bump();
  audio.coin(state.streak);
}

function tryBuy() {
  if (cafe.state !== 'derelict') return;
  if (state.cash < CAFE_PRICE) {
    hud.badgeShake = 0.4;
    audio.deny();
    fx.floater(`Need $${CAFE_PRICE - state.cash} more`, 200, 236, '#ffffff', 18);
    return;
  }
  state.cash -= CAFE_PRICE;
  hud.press = 1;
  audio.tap();
  fx.payout(hud.coinTarget(), { x: 200, y: 320 }, 14);
  cafe.buy();
  vibrate(20);
}

function onCafeOpened() {
  fx.dust(200, 330, 26, 110);
  fx.dust(200, 425, 14, 100);
  fx.confetti(200, 300, 90);
  fx.sparkles(200, 300, 16, 180);
  fx.flash = 1;
  state.shake = reduced ? 0 : 0.35;
  audio.poof();
  audio.fanfare();
  vibrate([30, 40, 30]);
  setTimeout(() => fx.showToast('CAFÉ OPEN!', 'Your first customers are on the way'), 250);
  customers.start();
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = toWorld(e);
  if (hud.hitMute(p)) { audio.setMuted(!audio.muted); return; }
  if (cafe.state === 'derelict' && hud.hitBadge(p)) { tryBuy(); return; }
  stroke = { last: p, count: 0, id: e.pointerId };
  fx.addTrail(p.x, p.y, state.time);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
});

canvas.addEventListener('pointermove', (e) => {
  if (!stroke || e.pointerId !== stroke.id) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events.length ? events : [e]) {
    const p = toWorld(ev);
    cutAlong(tufts, stroke.last.x, stroke.last.y, p.x, p.y, state.time, onCut);
    stroke.last = p;
    fx.addTrail(p.x, p.y, state.time);
  }
});

const endStroke = (e) => { if (stroke && e.pointerId === stroke.id) stroke = null; };
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
window.addEventListener('resize', resize);

function update(dt) {
  state.time += dt;
  updateGrass(tufts, state.time, dt);
  coins.update(dt, hud.coinTarget(), onCollect);
  cafe.update(dt, onCafeOpened);
  customers.update(dt, view, (c) => fx.sparkles(c.x, c.y - 50, 3, 10));
  fx.update(dt, state.time);
  hud.update(dt);
  state.shake = Math.max(0, state.shake - dt);
  if (state.cash >= CAFE_PRICE && !state.everAfforded && cafe.state === 'derelict') {
    state.everAfforded = true;
    audio.chime();
    fx.sparkles(200, 166, 10, 140);
  }
}

function drawTutorial(time) {
  if (cafe.state !== 'derelict') return;
  if (state.cash >= CAFE_PRICE) {
    const tap = (time * 1.4) % 1;
    const press = tap < 0.25 ? Math.sin((tap / 0.25) * Math.PI) : 0;
    const b = hud.buyButtonCenter();
    drawHand(ctx, b.x + 46, b.y + 22 + press * 4, 0.85, press);
    return;
  }
  if (state.cuts >= 6 || time < 0.8) return;
  const k = ((time - 0.8) % 1.8) / 1.8;
  if (k > 0.8) return;
  const e = k / 0.8;
  const x = 30 + e * 130, y = 520 - Math.sin(e * Math.PI) * 26 + e * 20;
  ctx.globalAlpha = Math.min(1, Math.min(e, 1 - e) * 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const q = Math.max(0, e - 0.25) + (i / 12) * Math.min(0.25, e);
    const px = 30 + q * 130, py = 520 - Math.sin(q * Math.PI) * 26 + q * 20;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  drawHand(ctx, x, y, 0.9, 0);
  ctx.globalAlpha = 1;
}

function render() {
  const { dpr, scale, ox, oy } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#a6dcff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sk = state.shake > 0 ? state.shake * 14 : 0;
  const sx = sk ? (Math.random() - 0.5) * sk : 0, sy = sk ? (Math.random() - 0.5) * sk : 0;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx), dpr * (oy + sy));

  const time = state.time;
  drawBackdrop(ctx, view, time);
  drawLawnPatches(ctx, tufts, LAWNS);
  cafe.draw(ctx, time, reduced);
  drawTufts(ctx, tufts, time);
  customers.draw(ctx, time);
  fx.drawWorld(ctx);
  coins.drawGround(ctx, time);

  if (cafe.state === 'derelict') hud.drawBadge(ctx, state.cash, CAFE_PRICE, time, reduced);
  hud.drawCash(ctx, state.cash);
  hud.drawMute(ctx, audio.muted);
  fx.drawOverlay(ctx, view, time);
  coins.drawFlying(ctx);
  drawTutorial(time);
  fx.drawTrail(ctx);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// Keep progress when the page is hot-reloaded inside the artifact viewer.
const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ cash: state.cash, cafeOpen: cafe.isOpen }));

function start(data = {}) {
  if (typeof data.cash === 'number') state.cash = data.cash;
  if (data.cafeOpen) { cafe.setOpen(); customers.start(); }
  resize();
  requestAnimationFrame((t) => { last = t; loop(t); });
}

const fontReady = document.fonts?.load ? document.fonts.load(`32px ${FONT}`).catch(() => {}) : Promise.resolve();
Promise.race([fontReady, new Promise((r) => setTimeout(r, 1200))]).then(() => {
  if (hot?.ready) hot.ready(start);
  else start(hot?.data ?? {});
});

// Test hook for automated play-throughs.
window.__district = { state, tufts, cafe, customers, view };
