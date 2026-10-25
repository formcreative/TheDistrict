import { GRASS } from './config.js';
import { mulberry, ell, easeOutBack } from './draw.js';

// Overgrown, sun-dried weeds vs. healthy regrown lawn.
export const TALL = ['#6c8b2b', '#839d33', '#9aaa3d', '#b4ac49'];
export const LUSH = ['#3aa838', '#4fbd41', '#64cf4b', '#7ddf5b'];

export function createGrass(rects) {
  const rng = mulberry(11);
  const tufts = [];
  for (const r of rects) {
    const cols = Math.max(1, Math.round(r.w / GRASS.spacing));
    const rows = Math.max(1, Math.round(r.h / GRASS.spacing));
    const cw = r.w / cols, ch = r.h / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const n = 5 + Math.floor(rng() * 3);
        const blades = [];
        for (let b = 0; b < n; b++) {
          blades.push({ dx: (rng() - 0.5) * 13, h: 13 + rng() * 13, lean: (rng() - 0.5) * 0.7, w: 3 + rng() * 2.4, c: Math.floor(rng() * 4) });
        }
        blades.sort((a, b) => b.h - a.h);
        tufts.push({
          cx: r.x + i * cw, cy: r.y + j * ch, cw, ch, stripe: i % 2,
          x: r.x + (i + 0.5) * cw + (rng() - 0.5) * 5,
          y: r.y + (j + 0.5) * ch + (rng() - 0.5) * 4 + 4,
          blades, weed: rng() < GRASS.weedChance, phase: rng() * 6.283,
          state: 'tall', grow: 1, growT: 0, lush: false, cutAt: 0, everCut: false, patchA: 0,
        });
      }
    }
  }
  tufts.sort((a, b) => a.y - b.y);
  return tufts;
}

export function updateGrass(tufts, time, dt) {
  for (const t of tufts) {
    if (t.state === 'cut' && time - t.cutAt > GRASS.regrowDelay) {
      t.state = 'growing';
      t.growT = 0;
      t.lush = true;
    }
    if (t.state === 'growing') {
      t.growT += dt;
      const k = Math.min(1, t.growT / 0.45);
      t.grow = easeOutBack(k);
      if (k >= 1) { t.state = 'tall'; t.grow = 1; }
    }
    if (t.everCut && t.patchA < 1) t.patchA = Math.min(1, t.patchA + dt * 7);
  }
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let k = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  k = Math.max(0, Math.min(1, k));
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}

export function cutAlong(tufts, ax, ay, bx, by, time, onCut) {
  for (const t of tufts) {
    if (t.state !== 'tall') continue;
    if (distToSeg(t.x, t.y - 7, ax, ay, bx, by) < GRASS.cutRadius) {
      const wasWeed = t.weed && !t.lush;
      t.state = 'cut';
      t.grow = 0;
      t.cutAt = time;
      t.everCut = true;
      onCut(t, wasWeed);
    }
  }
}

// Freshly mowed lawn revealed under cut tufts: soft overlapping discs with a darker
// rim, so the restored area reads as a raised, rounded patch rather than a grid.
export function drawLawnPatches(ctx, tufts, rects) {
  ctx.save();
  ctx.beginPath();
  for (const r of rects) ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  for (let pass = 0; pass < 2; pass++) {
    for (const t of tufts) {
      if (!t.everCut) continue;
      const r = Math.max(t.cw, t.ch) * 0.74 * (0.6 + 0.4 * t.patchA);
      const x = t.cx + t.cw / 2, y = t.cy + t.ch / 2;
      if (pass === 0) {
        ctx.fillStyle = '#5da83f';
        ell(ctx, x, y + 2.5, r + 1.5, r * 0.9 + 1.5);
      } else {
        ctx.fillStyle = t.stripe ? '#84cc58' : '#8fd563';
        ell(ctx, x, y, r, r * 0.9);
      }
      ctx.fill();
    }
  }
  ctx.restore();
}

function blade(ctx, bx, by, h, w, ang, color) {
  const sx = Math.sin(ang), cy = Math.cos(ang);
  const tx = bx + sx * h, ty = by - cy * h;
  const mx = bx + sx * h * 0.45, my = by - cy * h * 0.55;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx - w / 2, by);
  ctx.quadraticCurveTo(mx - w * 0.35, my, tx, ty);
  ctx.quadraticCurveTo(mx + w * 0.35, my, bx + w / 2, by);
  ctx.closePath();
  ctx.fill();
}

export function drawTufts(ctx, tufts, time) {
  for (const t of tufts) {
    const g = t.grow;
    if (g <= 0.02) continue;
    const pal = t.lush ? LUSH : TALL;
    const hs = t.lush ? 0.6 : 1;
    ctx.fillStyle = t.lush ? 'rgba(20,70,20,0.2)' : 'rgba(45,55,18,0.24)';
    ell(ctx, t.x, t.y + 1.5, 10 * g, 3.6 * g);
    ctx.fill();
    const sway = Math.sin(time * 1.8 + t.phase + t.x * 0.02) * 0.09;
    for (const b of t.blades) {
      blade(ctx, t.x + b.dx * 0.8, t.y, b.h * hs * g, b.w, b.lean + sway, pal[b.c]);
    }
    // Light catching the front blade gives the tuft some volume.
    const f = t.blades[t.blades.length - 1];
    blade(ctx, t.x + f.dx * 0.8 - 0.6, t.y, f.h * hs * g * 0.8, f.w * 0.45, f.lean + sway, 'rgba(255,255,210,0.28)');
    if (t.weed && !t.lush) {
      const b = t.blades[0];
      const fx = t.x + b.dx * 0.8 + Math.sin(b.lean + sway) * b.h * g;
      const fy = t.y - Math.cos(b.lean + sway) * b.h * g;
      // White clover-daisy, kept away from coin yellow so it never reads as money.
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t.phase;
        ell(ctx, fx + Math.cos(a) * 2.6 * g, fy + Math.sin(a) * 2.6 * g, 2 * g, 2 * g); ctx.fill();
      }
      ctx.fillStyle = '#f2a7c3';
      ell(ctx, fx, fy, 1.6 * g, 1.6 * g); ctx.fill();
    }
  }
}
