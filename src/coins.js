import { ell, drawCoin } from './draw.js';

// Coins burst out of the ground, bounce, then get vacuumed into the cash counter.
export class Coins {
  constructor() { this.list = []; }

  pop(x, y, value = 1, delay = 0) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 70;
    this.list.push({
      x, y, z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 300 + Math.random() * 130,
      t: -delay, state: 'pop', b: 0, value, spin: Math.random() * 6,
      hold: 0.42 + Math.random() * 0.16, fd: 0.4 + Math.random() * 0.12, ft: 0, px: x, py: y, sc: 1,
    });
  }

  update(dt, target, onCollect) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const c = L[i];
      c.t += dt;
      if (c.t < 0) continue;
      if (c.state === 'pop') {
        c.vz -= 1250 * dt;
        c.z += c.vz * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.z <= 0) {
          c.z = 0;
          if (c.b < 2) { c.vz = -c.vz * 0.36; c.b++; c.vx *= 0.5; c.vy *= 0.5; }
          else { c.vz = c.vx = c.vy = 0; }
        }
        if (c.t > c.hold) {
          c.state = 'fly';
          c.sx = c.x;
          c.sy = c.y - c.z - 6;
          c.side = (Math.random() - 0.5) * 140;
        }
      } else {
        c.ft += dt;
        const k = Math.min(1, c.ft / c.fd);
        const e = k * k * (0.35 + 0.65 * k);
        const qx = c.sx + c.side, qy = Math.min(c.sy, target.y) + (c.sy - target.y) * 0.25;
        const u = 1 - e;
        c.px = u * u * c.sx + 2 * u * e * qx + e * e * target.x;
        c.py = u * u * c.sy + 2 * u * e * qy + e * e * target.y;
        c.sc = 1 + 0.45 * Math.sin(k * Math.PI) - 0.2 * k;
        if (k >= 1) { L.splice(i, 1); onCollect(c.value); }
      }
    }
  }

  drawGround(ctx, time) {
    for (const c of this.list) {
      if (c.t < 0 || c.state !== 'pop') continue;
      const s = 1 - Math.min(c.z, 90) / 160;
      ctx.fillStyle = 'rgba(30,40,20,0.25)';
      ell(ctx, c.x, c.y, 6.5 * s, 2.6 * s); ctx.fill();
      drawCoin(ctx, c.x, c.y - c.z - 6, 7.5, Math.cos(c.spin + c.t * 10));
    }
  }

  drawFlying(ctx) {
    for (const c of this.list) {
      if (c.state !== 'fly') continue;
      drawCoin(ctx, c.px, c.py, 7.5 * c.sc, Math.cos(c.spin + c.t * 14));
    }
  }
}
