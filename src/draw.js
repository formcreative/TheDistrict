export const FONT = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  const k = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function ell(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
}

// Chunky game text: dark outline, soft drop, bright fill.
export function gameText(ctx, text, x, y, size, opts = {}) {
  const { fill = '#ffffff', stroke = '#1b2246', lw = size * 0.2, align = 'center', drop = true } = opts;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (drop) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(10,14,40,0.28)';
    ctx.strokeText(text, x, y + size * 0.1);
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function drawCoin(ctx, x, y, r, spin = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.22, spin), 1);
  ctx.fillStyle = '#b8730b';
  ell(ctx, 0, r * 0.16, r, r); ctx.fill();
  ctx.fillStyle = '#ffc12b';
  ell(ctx, 0, 0, r, r); ctx.fill();
  ctx.fillStyle = '#ffe070';
  ell(ctx, 0, 0, r * 0.68, r * 0.68); ctx.fill();
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#eaa21c';
  ell(ctx, 0, 0, r * 0.68, r * 0.68); ctx.stroke();
  if (r > 11) {
    ctx.font = `${r * 1.05}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d98a10';
    ctx.fillText('$', 0, r * 0.06);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ell(ctx, -r * 0.34, -r * 0.4, r * 0.3, r * 0.15); ctx.fill();
  ctx.restore();
}

// A nailed wooden board between two points.
export function plank(ctx, x1, y1, x2, y2, w = 8) {
  const L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, -w / 2 + 2, L, w);
  ctx.fillStyle = '#ad875a';
  ctx.fillRect(0, -w / 2, L, w);
  ctx.fillStyle = '#c9a272';
  ctx.fillRect(0, -w / 2, L, 2);
  ctx.fillStyle = '#5b4632';
  ell(ctx, 4, 0, 1.3, 1.3); ctx.fill();
  ell(ctx, L - 4, 0, 1.3, 1.3); ctx.fill();
  ctx.restore();
}
