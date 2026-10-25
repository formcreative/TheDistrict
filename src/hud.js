import { rr, ell, gameText, drawCoin, clamp } from './draw.js';

const BADGE = { x: 200, y: 166, w: 170, h: 60 };

export class Hud {
  constructor() {
    this.bumpT = 0;
    this.badgeShake = 0;
    this.press = 0;
    this.cash = { x: 200, y: 46 };
    this.mute = { x: 366, y: 46, r: 21 };
  }

  layout(view) {
    this.cash = { x: 200, y: view.y0 + 46 };
    this.mute = { x: Math.min(view.x1, 420) - 34, y: view.y0 + 46, r: 21 };
  }

  coinTarget() { return { x: this.cash.x - 60, y: this.cash.y }; }
  bump() { this.bumpT = 1; }

  update(dt) {
    this.bumpT = Math.max(0, this.bumpT - dt * 5);
    this.badgeShake = Math.max(0, this.badgeShake - dt);
    this.press = Math.max(0, this.press - dt * 6);
  }

  hitBadge(p) {
    return Math.abs(p.x - BADGE.x) < BADGE.w / 2 + 8 && Math.abs(p.y - BADGE.y) < BADGE.h / 2 + 12;
  }

  hitMute(p) { return Math.hypot(p.x - this.mute.x, p.y - this.mute.y) < this.mute.r + 8; }

  buyButtonCenter() { return { x: BADGE.x, y: BADGE.y }; }

  drawCash(ctx, cash) {
    const { x, y } = this.cash;
    const w = 156, h = 46;
    const b = this.bumpT;
    ctx.fillStyle = 'rgba(12,18,48,0.35)';
    rr(ctx, x - w / 2, y - h / 2 + 4, w, h, h / 2); ctx.fill();
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, '#3b52a0');
    g.addColorStop(1, '#222f6c');
    ctx.fillStyle = g;
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(ctx, x - w / 2 + 8, y - h / 2 + 4, w - 16, h * 0.38, h * 0.2); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.stroke();

    const cs = 1 + 0.25 * b;
    drawCoin(ctx, x - 60, y, 20 * cs, 1);
    ctx.save();
    ctx.translate(x + 14, y + 1);
    ctx.scale(1 + 0.16 * b, 1 + 0.16 * b);
    gameText(ctx, `$${cash}`, 0, 0, 28, { stroke: '#121a3f', lw: 6 });
    ctx.restore();
  }

  drawBadge(ctx, cash, price, time, reduced) {
    const afford = cash >= price;
    const shake = this.badgeShake > 0 ? Math.sin(this.badgeShake * 60) * 6 * this.badgeShake : 0;
    const bob = afford && !reduced ? Math.sin(time * 4) * 3 : 0;
    const x = BADGE.x + shake, y = BADGE.y + bob;
    const { w, h } = BADGE;

    if (afford) {
      // rotating sunburst behind the button
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(reduced ? 0 : time * 0.6);
      ctx.fillStyle = 'rgba(255,244,170,0.45)';
      for (let i = 0; i < 12; i++) {
        ctx.rotate((Math.PI * 2) / 12);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -110); ctx.lineTo(12, -110); ctx.fill();
      }
      ctx.restore();
      const glow = ctx.createRadialGradient(x, y, 10, x, y, 110);
      glow.addColorStop(0, 'rgba(255,250,200,0.8)');
      glow.addColorStop(1, 'rgba(255,250,200,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 110, y - 110, 220, 220);

      const pulse = reduced ? 1 : 1 + Math.sin(time * 6) * 0.03;
      const pr = this.press;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse * (1 + pr * 0.05), pulse * (1 - pr * 0.08));
      const lip = 7 - pr * 4;
      ctx.fillStyle = 'rgba(10,40,10,0.3)';
      rr(ctx, -w / 2, -h / 2 + lip + 4, w, h, 18); ctx.fill();
      ctx.fillStyle = '#2a8a22';
      rr(ctx, -w / 2, -h / 2 + lip, w, h, 18); ctx.fill();
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, '#9af36d');
      g.addColorStop(1, '#45b934');
      ctx.fillStyle = g;
      rr(ctx, -w / 2, -h / 2, w, h, 18); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      rr(ctx, -w / 2 + 8, -h / 2 + 5, w - 16, h * 0.36, 12); ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1f6b19';
      rr(ctx, -w / 2, -h / 2, w, h, 18); ctx.stroke();
      gameText(ctx, 'BUY', -26, 1, 28, { stroke: '#1f6b19', lw: 6 });
      drawCoin(ctx, 22, 1, 12, 1);
      gameText(ctx, `${price}`, 54, 1, 22, { stroke: '#1f6b19', lw: 5 });
      ctx.restore();
      return;
    }

    // Locked: shows what you're saving toward.
    ctx.fillStyle = 'rgba(12,18,48,0.3)';
    rr(ctx, x - w / 2, y - h / 2 + 4, w, h, 18); ctx.fill();
    ctx.fillStyle = 'rgba(28,38,86,0.92)';
    rr(ctx, x - w / 2, y - h / 2, w, h, 18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 9, y + h / 2 - 1); ctx.lineTo(x + 9, y + h / 2 - 1); ctx.lineTo(x, y + h / 2 + 10); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    rr(ctx, x - w / 2, y - h / 2, w, h, 18); ctx.stroke();
    gameText(ctx, 'OPEN THE CAFÉ', x, y - 12, 16, { stroke: '#121a3f', lw: 4, drop: false });
    const bw = 134, bh = 18, bx = x - bw / 2, byy = y + 4;
    ctx.fillStyle = '#0e1533';
    rr(ctx, bx, byy, bw, bh, 9); ctx.fill();
    const k = clamp(cash / price, 0, 1);
    if (k > 0) {
      const fg = ctx.createLinearGradient(0, byy, 0, byy + bh);
      fg.addColorStop(0, '#ffe066');
      fg.addColorStop(1, '#f5a623');
      ctx.fillStyle = fg;
      rr(ctx, bx + 2, byy + 2, Math.max(14, (bw - 4) * k), bh - 4, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      rr(ctx, bx + 5, byy + 3.5, Math.max(8, (bw - 10) * k), 4, 2); ctx.fill();
    }
    gameText(ctx, `$${cash} / $${price}`, x, byy + bh / 2 + 0.5, 13, { stroke: '#121a3f', lw: 3.5, drop: false });
  }

  drawMute(ctx, muted) {
    const { x, y, r } = this.mute;
    ctx.fillStyle = 'rgba(12,18,48,0.35)';
    ell(ctx, x, y + 4, r, r); ctx.fill();
    ctx.fillStyle = '#2c3d82';
    ell(ctx, x, y, r, r); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ell(ctx, x, y, r, r); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 4); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x + 2, y - 9); ctx.lineTo(x + 2, y + 9); ctx.lineTo(x - 4, y + 4); ctx.lineTo(x - 9, y + 4);
    ctx.closePath(); ctx.fill();
    ctx.lineCap = 'round';
    if (muted) {
      ctx.strokeStyle = '#ff6b5a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 6, y - 5); ctx.lineTo(x + 12, y + 5); ctx.moveTo(x + 12, y - 5); ctx.lineTo(x + 6, y + 5); ctx.stroke();
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(x + 3, y, 6, -0.8, 0.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3, y, 10.5, -0.8, 0.8); ctx.stroke();
    }
  }
}

// Tutorial glove. Fingertip sits at (x, y).
export function drawHand(ctx, x, y, s = 1, press = 0) {
  ctx.save();
  ctx.translate(x, y);
  const k = s * (1 - press * 0.12);
  ctx.scale(k, k);
  ctx.rotate(-0.4);
  const shapes = [[-6, 0, 12, 32, 6], [-15, 20, 32, 30, 12], [-22, 26, 11, 18, 5.5], [5, 18, 10, 16, 5]];
  ctx.fillStyle = 'rgba(20,24,50,0.25)';
  for (const [a, b, c, d, e] of shapes) { rr(ctx, a + 4, b + 6, c, d, e); ctx.fill(); }
  ctx.fillStyle = '#2b2f45';
  for (const [a, b, c, d, e] of shapes) { rr(ctx, a - 3, b - 3, c + 6, d + 6, e + 3); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  for (const [a, b, c, d, e] of shapes) { rr(ctx, a, b, c, d, e); ctx.fill(); }
  ctx.fillStyle = '#dfe5f5';
  rr(ctx, -12, 40, 26, 8, 4); ctx.fill();
  ctx.restore();
}
