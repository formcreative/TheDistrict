import { rr, ell, gameText, drawCoin, easeOutBack, FONT } from './draw.js';

const CONFETTI = ['#ff6a4d', '#ffd23f', '#4fc3f7', '#7be35a', '#ff8fd0', '#ffffff'];

export class FX {
  constructor() {
    this.p = [];
    this.floaters = [];
    this.trail = [];
    this.pay = [];
    this.toast = null;
    this.flash = 0;
  }

  clippings(x, y, pal) {
    for (let i = 0; i < 6; i++) {
      this.p.push({
        type: 'clip', x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 240, vy: -110 - Math.random() * 190,
        g: 760, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 22, life: 0, max: 0.45 + Math.random() * 0.3,
        color: pal[Math.floor(Math.random() * pal.length)], size: 3 + Math.random() * 3.5,
      });
    }
    this.p.push({ type: 'ring', x, y: y + 6, life: 0, max: 0.28, size: 8 });
  }

  dust(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.p.push({
        type: 'dust', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.6,
        vx: Math.cos(a) * (40 + Math.random() * 80), vy: Math.sin(a) * 40 - 30, g: -20,
        life: 0, max: 0.6 + Math.random() * 0.4, size: 14 + Math.random() * 18,
      });
    }
  }

  confetti(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 260 + Math.random() * 340;
      this.p.push({
        type: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 520, drag: 1.6,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, life: 0, max: 1.6 + Math.random() * 0.9,
        color: CONFETTI[i % CONFETTI.length], size: 4 + Math.random() * 4,
      });
    }
  }

  sparkles(x, y, n, spread = 20) {
    for (let i = 0; i < n; i++) {
      this.p.push({
        type: 'spark', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 50, g: 0, life: 0, max: 0.5 + Math.random() * 0.4,
        size: 3 + Math.random() * 3,
      });
    }
  }

  floater(text, x, y, color = '#ffffff', size = 22) {
    this.floaters.push({ text, x, y, t: 0, color, size });
  }

  showToast(title, sub) { this.toast = { title, sub, t: 0 }; }

  payout(from, to, n) {
    for (let i = 0; i < n; i++) {
      this.pay.push({ sx: from.x, sy: from.y, tx: to.x + (Math.random() - 0.5) * 80, ty: to.y + (Math.random() - 0.5) * 40, t: -i * 0.035, d: 0.42, side: (Math.random() - 0.5) * 120 });
    }
  }

  addTrail(x, y, t) {
    this.trail.push({ x, y, t });
    if (this.trail.length > 40) this.trail.shift();
  }

  update(dt, time) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life += dt;
      if (q.life >= q.max) { this.p.splice(i, 1); continue; }
      if (q.vx !== undefined) {
        if (q.drag) { q.vx -= q.vx * q.drag * dt; q.vy -= q.vy * q.drag * dt; }
        q.vy += (q.g || 0) * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
      if (q.vr) q.rot += q.vr * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.1) this.floaters.splice(i, 1);
    }
    for (let i = this.pay.length - 1; i >= 0; i--) {
      this.pay[i].t += dt;
      if (this.pay[i].t > this.pay[i].d) this.pay.splice(i, 1);
    }
    while (this.trail.length && time - this.trail[0].t > 0.16) this.trail.shift();
    if (this.toast) { this.toast.t += dt; if (this.toast.t > 3.2) this.toast = null; }
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  drawWorld(ctx) {
    for (const q of this.p) {
      const k = q.life / q.max;
      if (q.type === 'clip') {
        ctx.save();
        ctx.globalAlpha = 1 - k * k;
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -1.2, q.size, 2.4);
        ctx.restore();
      } else if (q.type === 'ring') {
        ctx.globalAlpha = 0.6 * (1 - k);
        ctx.strokeStyle = '#fffbe0';
        ctx.lineWidth = 2.5 * (1 - k) + 0.5;
        ell(ctx, q.x, q.y, q.size + k * 18, (q.size + k * 18) * 0.45);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (q.type === 'dust') {
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.fillStyle = '#fffaf0';
        ell(ctx, q.x, q.y, q.size * (0.6 + k * 0.8), q.size * (0.6 + k * 0.8)); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawOverlay(ctx, view, time) {
    for (const q of this.p) {
      const k = q.life / q.max;
      if (q.type === 'confetti') {
        ctx.save();
        ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.scale(1, Math.cos(q.rot * 1.7));
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66);
        ctx.restore();
      } else if (q.type === 'spark') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#fff6b0';
        const s = q.size * (1 - k * 0.5);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - s); ctx.lineTo(q.x + s * 0.3, q.y - s * 0.3); ctx.lineTo(q.x + s, q.y);
        ctx.lineTo(q.x + s * 0.3, q.y + s * 0.3); ctx.lineTo(q.x, q.y + s); ctx.lineTo(q.x - s * 0.3, q.y + s * 0.3);
        ctx.lineTo(q.x - s, q.y); ctx.lineTo(q.x - s * 0.3, q.y - s * 0.3); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    for (const c of this.pay) {
      if (c.t < 0) continue;
      const k = c.t / c.d, u = 1 - k;
      const qx = (c.sx + c.tx) / 2 + c.side, qy = Math.min(c.sy, c.ty) - 30;
      const x = u * u * c.sx + 2 * u * k * qx + k * k * c.tx;
      const y = u * u * c.sy + 2 * u * k * qy + k * k * c.ty;
      drawCoin(ctx, x, y, 8 * (1 - k * 0.4), Math.cos(c.t * 14));
    }

    for (const f of this.floaters) {
      const k = f.t / 1.1;
      const s = f.t < 0.25 ? easeOutBack(f.t / 0.25) : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.save();
      ctx.translate(f.x, f.y - k * 34);
      ctx.scale(s, s);
      gameText(ctx, f.text, 0, 0, f.size, { fill: f.color });
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
      ctx.globalAlpha = 1;
    }

    if (this.toast) this.drawToast(ctx, view);
  }

  drawToast(ctx, view) {
    const t = this.toast.t;
    let s, a = 1;
    if (t < 0.45) s = easeOutBack(t / 0.45);
    else if (t > 2.8) { s = 1; a = 1 - (t - 2.8) / 0.4; }
    else s = 1;
    const cy = view.y0 + 128;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(200, cy);
    ctx.scale(s, s);
    // ribbon tails
    ctx.fillStyle = '#c23b2a';
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(d * 112, -14); ctx.lineTo(d * 150, -14); ctx.lineTo(d * 136, 6); ctx.lineTo(d * 150, 26); ctx.lineTo(d * 112, 26);
      ctx.fill();
    }
    ctx.fillStyle = '#8e2618';
    for (const d of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(d * 112, 26); ctx.lineTo(d * 122, 34); ctx.lineTo(d * 122, 18); ctx.fill();
    }
    ctx.fillStyle = 'rgba(80,20,10,0.3)';
    rr(ctx, -124, -18, 248, 50, 10); ctx.fill();
    const g = ctx.createLinearGradient(0, -24, 0, 26);
    g.addColorStop(0, '#ff7d5c');
    g.addColorStop(1, '#e8462e');
    ctx.fillStyle = g;
    rr(ctx, -124, -24, 248, 50, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rr(ctx, -118, -20, 236, 16, 7); ctx.fill();
    gameText(ctx, this.toast.title, 0, 1, 30, { stroke: '#8e2618', lw: 6 });
    if (this.toast.sub) {
      ctx.font = `14px ${FONT}`;
      const w = ctx.measureText(this.toast.sub).width + 28;
      ctx.fillStyle = 'rgba(22,30,70,0.8)';
      rr(ctx, -w / 2, 34, w, 26, 13); ctx.fill();
      gameText(ctx, this.toast.sub, 0, 47.5, 14, { stroke: '#161e46', lw: 3, drop: false });
    }
    ctx.restore();
  }

  drawTrail(ctx) {
    const T = this.trail;
    if (T.length < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < T.length; i++) {
        const k = i / (T.length - 1);
        ctx.strokeStyle = pass === 0 ? `rgba(190,255,150,${0.35 * k})` : `rgba(255,255,255,${0.9 * k})`;
        ctx.lineWidth = (pass === 0 ? 16 : 7) * k + 1;
        ctx.beginPath();
        ctx.moveTo(T[i - 1].x, T[i - 1].y);
        ctx.lineTo(T[i].x, T[i].y);
        ctx.stroke();
      }
    }
  }
}
