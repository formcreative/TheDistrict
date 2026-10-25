import { LAYOUT as L } from './config.js';
import { rr, ell, mulberry, hash, shade, plank } from './draw.js';

function cloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(214,236,250,0.95)';
  ell(ctx, x + 4 * s, y + 8 * s, 46 * s, 14 * s); ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [[-26, 2, 16], [-6, -8, 22], [18, -2, 18], [36, 6, 12]]) {
    ell(ctx, x + dx * s, y + dy * s, r * s, r * s); ctx.fill();
  }
  ctx.fillRect(x - 36 * s, y + 2 * s, 78 * s, 12 * s);
}

function neighbor(ctx, x, w, top, wall, seed) {
  const r = mulberry(seed), base = L.buildingBase;
  ctx.fillStyle = 'rgba(40,35,30,0.2)';
  rr(ctx, x - 4, base - 6, w + 8, 12, 6); ctx.fill();
  const g = ctx.createLinearGradient(0, top, 0, base);
  g.addColorStop(0, wall);
  g.addColorStop(1, shade(wall, -16));
  ctx.fillStyle = g;
  ctx.fillRect(x, top + 16, w, base - top - 16);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(x, top + 16, w, 6);
  ctx.fillStyle = shade(wall, -26);
  ctx.fillRect(x - 4, top, w + 8, 16);
  ctx.fillStyle = shade(wall, 10);
  ctx.fillRect(x - 4, top, w + 8, 4);
  // stains
  ctx.fillStyle = 'rgba(90,70,50,0.12)';
  for (let i = 0; i < 3; i++) { ell(ctx, x + r() * w, top + 40 + r() * 200, 10 + r() * 18, 16 + r() * 22); ctx.fill(); }
  // windows
  const cols = Math.max(1, Math.floor((w - 16) / 46));
  const gap = (w - cols * 30) / (cols + 1);
  for (let wy = top + 34; wy + 40 < 352; wy += 60) {
    for (let c = 0; c < cols; c++) {
      const wx = x + gap + c * (30 + gap);
      ctx.fillStyle = shade(wall, -34);
      rr(ctx, wx - 3, wy - 3, 36, 46, 2); ctx.fill();
      const roll = r();
      ctx.fillStyle = roll < 0.45 ? '#3d3a41' : '#7d93a4';
      ctx.fillRect(wx, wy, 30, 40);
      if (roll >= 0.45) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx + 6, wy + 4); ctx.lineTo(wx + 14, wy + 18); ctx.lineTo(wx + 10, wy + 30);
        ctx.moveTo(wx + 14, wy + 18); ctx.lineTo(wx + 25, wy + 22);
        ctx.stroke();
      } else if (roll < 0.3) {
        plank(ctx, wx - 3, wy + 8, wx + 33, wy + 30, 6);
      }
    }
  }
  // rolled-down shop shutter
  const sx = x + 10, sw = w - 20;
  ctx.fillStyle = '#6f747a';
  ctx.fillRect(sx - 2, 356, sw + 4, 8);
  ctx.fillStyle = '#8f949a';
  ctx.fillRect(sx, 364, sw, base - 364);
  ctx.fillStyle = '#7c8187';
  for (let y = 368; y < base; y += 6) ctx.fillRect(sx, y, sw, 1.5);
  ctx.fillStyle = 'rgba(120,80,40,0.25)';
  ell(ctx, sx + sw * 0.3, base - 14, 18, 8); ctx.fill();
}

function weedyBase(ctx, x0, y, w, h, seed) {
  ctx.fillStyle = '#a4a75d';
  ctx.fillRect(x0, y, w, h);
  const step = 28;
  for (let gx = Math.floor(x0 / step) * step; gx < x0 + w; gx += step) {
    for (let gy = y; gy < y + h; gy += step) {
      const k = hash(gx * 0.37 + gy * 1.91 + seed * 17);
      if (k < 0.35) {
        ctx.fillStyle = 'rgba(150,120,72,0.5)';
        ell(ctx, gx + hash(k * 9) * step, gy + hash(k * 13) * step, 9 + k * 20, 5 + k * 10); ctx.fill();
      } else if (k > 0.75) {
        ctx.fillStyle = 'rgba(120,135,60,0.6)';
        ell(ctx, gx + hash(k * 7) * step, gy + hash(k * 3) * step, 12, 6); ctx.fill();
      }
    }
  }
}

export function drawBackdrop(ctx, v, time) {
  const x0 = v.x0 - 2, x1 = v.x1 + 2, y0 = v.y0 - 2, y1 = v.y1 + 2, w = x1 - x0;

  const sky = ctx.createLinearGradient(0, Math.min(y0, 0), 0, L.buildingBase);
  sky.addColorStop(0, '#4fb6ff');
  sky.addColorStop(0.55, '#a6dcff');
  sky.addColorStop(1, '#e8f7ff');
  ctx.fillStyle = sky;
  ctx.fillRect(x0, y0, w, L.buildingBase - y0);

  const sun = ctx.createRadialGradient(334, 118, 4, 334, 118, 110);
  sun.addColorStop(0, 'rgba(255,250,210,1)');
  sun.addColorStop(0.25, 'rgba(255,246,190,0.6)');
  sun.addColorStop(1, 'rgba(255,246,190,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(220, 0, 230, 240);
  ctx.fillStyle = '#fff6b8';
  ell(ctx, 334, 118, 24, 24); ctx.fill();

  for (let i = 0; i < 4; i++) {
    const span = w + 260;
    const cx = x0 - 130 + ((i * 197 + time * (5 + i * 2)) % span);
    cloud(ctx, cx, 96 + i * 34 + (i % 2) * 20, 0.75 + (i % 3) * 0.18);
  }

  // distant skyline
  ctx.fillStyle = '#c3dcef';
  for (let k = Math.floor(x0 / 46) - 1; k <= Math.ceil(x1 / 46); k++) {
    const h = 70 + hash(k) * 90;
    ctx.fillRect(k * 46, 330 - h, 42, h + 100);
  }
  ctx.fillStyle = '#d3e7f5';
  for (let k = Math.floor(x0 / 46) - 1; k <= Math.ceil(x1 / 46); k++) {
    const h = 70 + hash(k) * 90;
    ctx.fillRect(k * 46, 330 - h, 42, 4);
  }

  neighbor(ctx, -262, 178, 278, '#a79e94', 8);
  neighbor(ctx, -80, 176, 254, '#b3a796', 3);
  neighbor(ctx, 304, 178, 270, '#aaa79c', 5);
  neighbor(ctx, 486, 172, 250, '#b4aa9b', 9);

  // stoop strip along the building line
  ctx.fillStyle = '#b8b0a3';
  ctx.fillRect(x0, L.buildingBase, w, L.yardTop - L.buildingBase);
  ctx.fillStyle = '#d1c9bc';
  ctx.fillRect(x0, L.buildingBase, w, 3);

  weedyBase(ctx, x0, L.yardTop, w, L.yardBottom - L.yardTop, 1);

  // cracked stone path to the café door
  ctx.fillStyle = '#9d927f';
  ctx.fillRect(L.pathX0, L.yardTop, L.pathX1 - L.pathX0, L.yardBottom - L.yardTop);
  let row = 0;
  for (let y = L.yardTop + 2; y < L.yardBottom - 2; y += 19, row++) {
    const off = row % 2 ? 11 : 0;
    for (let x = L.pathX0 + 2 - off; x < L.pathX1 - 2; x += 21) {
      const sx = Math.max(L.pathX0 + 2, x), ex = Math.min(L.pathX1 - 2, x + 19);
      if (ex - sx < 4) continue;
      ctx.fillStyle = hash(x * 3 + y) > 0.85 ? '#c3b49b' : '#ddd0b8';
      rr(ctx, sx, y, ex - sx, 16, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(sx + 2, y + 1, ex - sx - 4, 2);
    }
  }

  // sidewalk
  ctx.fillStyle = '#d4cdc1';
  ctx.fillRect(x0, L.sidewalkTop, w, L.curbTop - L.sidewalkTop);
  ctx.fillStyle = '#c4bcaf';
  ctx.fillRect(x0, L.sidewalkTop, w, 3);
  ctx.fillRect(x0, L.sidewalkTop + 23, w, 1.5);
  for (let x = Math.floor(x0 / 36) * 36; x < x1; x += 36) ctx.fillRect(x, L.sidewalkTop, 1.5, L.curbTop - L.sidewalkTop);
  ctx.strokeStyle = '#a99f90';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(52, 596); ctx.lineTo(60, 608); ctx.lineTo(56, 618); ctx.lineTo(66, 630);
  ctx.moveTo(300, 594); ctx.lineTo(292, 606); ctx.lineTo(304, 614);
  ctx.moveTo(358, 620); ctx.lineTo(370, 628); ctx.lineTo(366, 636);
  ctx.stroke();

  // curb
  ctx.fillStyle = '#e4ded2';
  ctx.fillRect(x0, L.curbTop, w, 5);
  ctx.fillStyle = '#9f988b';
  ctx.fillRect(x0, L.curbTop + 5, w, L.roadTop - L.curbTop - 5);

  // road
  ctx.fillStyle = '#6c707b';
  ctx.fillRect(x0, L.roadTop, w, L.roadBottom - L.roadTop);
  ctx.fillStyle = '#62666f';
  for (let k = Math.floor(x0 / 90); k * 90 < x1; k++) {
    const h = hash(k + 40);
    rr(ctx, k * 90 + h * 40, L.roadTop + 10 + h * 50, 30 + h * 30, 14, 5); ctx.fill();
  }
  ctx.fillStyle = 'rgba(230,224,190,0.55)';
  for (let x = Math.floor(x0 / 54) * 54; x < x1; x += 54) {
    if (hash(x) > 0.25) { rr(ctx, x + 6, (L.roadTop + L.roadBottom) / 2 - 2, 28, 5, 2); ctx.fill(); }
  }
  ctx.fillStyle = '#545862';
  ell(ctx, 118, 714, 16, 6); ctx.fill();
  ell(ctx, 318, 668, 11, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x0, L.roadTop, w, 3);

  // far curb
  ctx.fillStyle = '#9f988b';
  ctx.fillRect(x0, L.roadBottom, w, 4);
  ctx.fillStyle = '#cbc4b7';
  ctx.fillRect(x0, L.roadBottom + 4, w, L.vergeTop - L.roadBottom - 4);

  weedyBase(ctx, x0, L.vergeTop, w, Math.max(0, y1 - L.vergeTop), 2);

  // Hedge framing the bottom edge on tall screens.
  if (y1 > L.hedgeTop) {
    ctx.fillStyle = '#3d8a3a';
    ctx.fillRect(x0, L.hedgeTop + 8, w, y1 - L.hedgeTop);
    for (let x = Math.floor(x0 / 20) * 20 - 10; x < x1 + 20; x += 20) {
      const h = hash(x * 0.13);
      ctx.fillStyle = '#3d8a3a';
      ell(ctx, x, L.hedgeTop + 10 - h * 3, 14, 12); ctx.fill();
      ctx.fillStyle = '#58ad48';
      ell(ctx, x - 2, L.hedgeTop + 7 - h * 3, 9, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ell(ctx, x - 4, L.hedgeTop + 4 - h * 3, 4, 2.5); ctx.fill();
    }
  }
}
