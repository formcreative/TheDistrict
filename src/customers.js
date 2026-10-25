import { LAYOUT } from './config.js';
import { rr, ell } from './draw.js';

const SHIRTS = ['#ff7a59', '#4fb3ff', '#ffc93c', '#9b6bff', '#3fcf8e', '#ff5d8f'];
const SKINS = ['#f6d1b1', '#e8b48a', '#c98a5e', '#8f5a3a', '#f3c39b'];
const HAIR = ['#3a2a20', '#6b4226', '#1f1b24', '#d39a3e', '#8c3b2a', '#e8e1d6'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const INSIDE_TIME = 1.8;

export class Customers {
  constructor() {
    this.list = [];
    this.timer = 0;
    this.active = false;
    this.served = 0;
  }

  start() { this.active = true; this.timer = 0.9; }

  spawn(view) {
    const fromLeft = Math.random() < 0.5;
    const y = LAYOUT.walkY + (Math.random() - 0.5) * 8;
    const leftX = Math.min(-30, view.x0 - 30), rightX = Math.max(430, view.x1 + 30);
    this.list.push({
      x: fromLeft ? leftX : rightX, y, sy: y,
      route: [{ x: LAYOUT.doorX, y }, { x: LAYOUT.doorX, y: LAYOUT.doorY }],
      exitX: Math.random() < 0.5 ? leftX : rightX,
      phase: 'arrive', speed: 64 + Math.random() * 18, walk: Math.random() * 6, dir: fromLeft ? 1 : -1,
      alpha: 1, wait: 0, cup: false, heart: 0, bubble: 0,
      shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIR), size: 0.92 + Math.random() * 0.16,
    });
  }

  update(dt, view, onServed) {
    if (!this.active) return;
    this.timer -= dt;
    if (this.timer <= 0 && this.list.length < 5) {
      this.spawn(view);
      this.timer = 2.2 + Math.random() * 1.6;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      if (c.phase === 'arrive' || c.phase === 'leave') {
        const tgt = c.route[0];
        const dx = tgt.x - c.x, dy = tgt.y - c.y, d = Math.hypot(dx, dy);
        const step = c.speed * dt;
        if (Math.abs(dx) > 1) c.dir = Math.sign(dx);
        if (d <= step) {
          c.x = tgt.x; c.y = tgt.y; c.route.shift();
        } else {
          c.x += (dx / d) * step; c.y += (dy / d) * step;
        }
        c.walk += dt * 11;
        if (c.phase === 'arrive') c.bubble = Math.min(1, c.bubble + dt * 3);
        if (!c.route.length) {
          if (c.phase === 'arrive') { c.phase = 'enter'; c.wait = 0; }
          else { this.list.splice(i, 1); continue; }
        }
      } else if (c.phase === 'enter') {
        c.alpha = Math.max(0, c.alpha - dt * 4);
        c.bubble = Math.max(0, c.bubble - dt * 5);
        if (c.alpha <= 0) { c.phase = 'inside'; c.wait = 0; }
      } else if (c.phase === 'inside') {
        c.wait += dt;
        if (c.wait > INSIDE_TIME) {
          c.phase = 'exit';
          c.cup = true;
        }
      } else if (c.phase === 'exit') {
        c.alpha = Math.min(1, c.alpha + dt * 4);
        if (c.alpha >= 1) {
          c.phase = 'leave';
          c.heart = 0.001;
          c.route = [{ x: LAYOUT.doorX, y: c.sy }, { x: c.exitX, y: c.sy }];
          this.served++;
          onServed(c);
        }
      }
      if (c.heart > 0) c.heart += dt;
    }
  }

  draw(ctx, time) {
    const sorted = [...this.list].sort((a, b) => a.y - b.y);
    for (const c of sorted) drawPerson(ctx, c, time);
  }
}

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + 3 * s);
  ctx.bezierCurveTo(x - 7 * s, y - 2 * s, x - 3 * s, y - 8 * s, x, y - 4 * s);
  ctx.bezierCurveTo(x + 3 * s, y - 8 * s, x + 7 * s, y - 2 * s, x, y + 3 * s);
  ctx.fill();
}

function drawPerson(ctx, c, time) {
  if (c.alpha <= 0) return;
  const moving = c.phase === 'arrive' || c.phase === 'leave';
  const bob = moving ? Math.abs(Math.sin(c.walk)) * 2.5 : 0;
  const sw = moving ? Math.sin(c.walk) * 2.6 : 0;
  ctx.save();
  ctx.globalAlpha = c.alpha;
  ctx.translate(c.x, c.y);
  ctx.scale(c.size, c.size);

  ctx.fillStyle = 'rgba(30,30,50,0.22)';
  ell(ctx, 0, 0, 10, 3.5); ctx.fill();

  ctx.fillStyle = '#3b3f5c';
  rr(ctx, -5 + sw * 0.5, -10, 4.5, 10, 2); ctx.fill();
  rr(ctx, 0.5 - sw * 0.5, -10, 4.5, 10, 2); ctx.fill();

  const by = -8 - bob;
  ctx.fillStyle = c.shirt;
  rr(ctx, -8.5, by - 17, 17, 18, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  rr(ctx, 1, by - 17, 7.5, 18, [0, 7, 7, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  rr(ctx, -6.5, by - 15, 5, 8, 3); ctx.fill();

  const hy = by - 25;
  ctx.fillStyle = c.skin;
  ell(ctx, 0, hy, 8.5, 8.5); ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.arc(0, hy - 0.5, 8.9, Math.PI * 1.02, Math.PI * 1.98);
  ctx.quadraticCurveTo(c.dir * 2, hy - 4, -8.8 * c.dir, hy + 1);
  ctx.fill();
  ctx.fillStyle = '#2b2f45';
  ell(ctx, -2.8 + c.dir * 1.5, hy + 1, 1.3, 1.6); ctx.fill();
  ell(ctx, 2.8 + c.dir * 1.5, hy + 1, 1.3, 1.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.45)';
  ell(ctx, -5 + c.dir * 1.5, hy + 4, 1.8, 1.2); ctx.fill();
  ell(ctx, 5 + c.dir * 1.5, hy + 4, 1.8, 1.2); ctx.fill();

  if (c.cup) {
    const cx = c.dir * 10, cy = by - 7;
    ctx.fillStyle = '#ffffff';
    rr(ctx, cx - 3.5, cy - 4, 7, 8, 2); ctx.fill();
    ctx.fillStyle = '#ff6b4a';
    ctx.fillRect(cx - 3.5, cy - 1, 7, 2.4);
    ctx.fillStyle = '#e9ddd0';
    rr(ctx, cx - 4, cy - 6, 8, 2.6, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.2;
    const k = Math.sin(time * 4 + c.x) * 1.4;
    ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.quadraticCurveTo(cx + k, cy - 10, cx, cy - 13); ctx.stroke();
  }

  if (c.bubble > 0) {
    const s = c.bubble;
    const bx = 0, byb = hy - 22;
    ctx.save();
    ctx.translate(bx, byb);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(20,30,60,0.2)';
    rr(ctx, -12, -10, 24, 21, 8); ctx.fill();
    ctx.fillStyle = '#ffffff';
    rr(ctx, -12, -12, 24, 21, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(3, 8); ctx.lineTo(0, 13); ctx.fill();
    ctx.fillStyle = '#7a4a2a';
    rr(ctx, -5, -6, 9, 9, 2.5); ctx.fill();
    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(5, -1.5, 2.4, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.restore();
  }

  if (c.heart > 0 && c.heart < 1.4) {
    const k = c.heart / 1.4;
    ctx.globalAlpha = c.alpha * (1 - k);
    ctx.fillStyle = '#ff4f7b';
    heart(ctx, 0, hy - 16 - k * 22, 1.3 + Math.sin(Math.min(1, k * 4) * Math.PI) * 0.4);
  }
  ctx.restore();
}
