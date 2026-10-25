import { LAYOUT } from './config.js';
import { rr, ell, gameText, plank, FONT } from './draw.js';

const X = 100, Y = 204, WD = 200, BASE = LAYOUT.buildingBase;
const BUY_TIME = 0.6;

function awning(ctx, x, y, w, h, c1, c2, valance, torn) {
  const n = 8, inset = 7, sw = w / n;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 6, y + h + 2, w - 12, 12);
  for (let i = 0; i < n; i++) {
    const tx0 = x + inset + (i * (w - 2 * inset)) / n, tx1 = x + inset + ((i + 1) * (w - 2 * inset)) / n;
    const bx0 = x + i * sw, bx1 = bx0 + sw;
    const by0 = y + h + (torn ? i * 0.9 : 0), by1 = y + h + (torn ? (i + 1) * 0.9 : 0);
    ctx.fillStyle = i % 2 ? c2 : c1;
    ctx.beginPath();
    ctx.moveTo(tx0, y);
    ctx.lineTo(tx1, y);
    ctx.lineTo(bx1, by1);
    if (torn && (i === 2 || i === 5)) {
      ctx.lineTo(bx1 - sw * 0.3, by1 - 7);
      ctx.lineTo(bx0 + sw * 0.55, by0 + 3);
      ctx.lineTo(bx0 + sw * 0.2, by0 - 5);
      ctx.lineTo(bx0, by0);
    } else {
      ctx.quadraticCurveTo((bx0 + bx1) / 2, (by0 + by1) / 2 + sw * 0.75, bx0, by0);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(x + inset, y); ctx.lineTo(x + w - inset, y);
  ctx.lineTo(x + w - inset * 0.6, y + h * 0.35); ctx.lineTo(x + inset * 0.6, y + h * 0.35);
  ctx.fill();
  ctx.fillStyle = valance;
  rr(ctx, x + 3, y - 5, w - 6, 8, 3); ctx.fill();
}

function drawDerelict(ctx) {
  ctx.fillStyle = 'rgba(40,35,30,0.22)';
  rr(ctx, X - 6, BASE - 8, WD + 12, 16, 8); ctx.fill();

  // blank, faded sign board
  ctx.fillStyle = '#857b6b';
  rr(ctx, 140, Y, 120, 28, 4); ctx.fill();
  ctx.fillStyle = '#9b917f';
  rr(ctx, 144, Y + 4, 112, 20, 3); ctx.fill();
  ctx.fillStyle = '#ada391';
  ctx.fillRect(150, Y + 8, 30, 6);
  ctx.fillRect(214, Y + 13, 22, 5);

  // cornice, chipped on the right
  ctx.fillStyle = '#958977';
  ctx.fillRect(X - 6, Y + 26, WD + 12, 20);
  ctx.fillStyle = '#ab9f8c';
  ctx.fillRect(X - 6, Y + 26, WD + 12, 5);
  ctx.fillStyle = '#7a6f60';
  ctx.beginPath();
  ctx.moveTo(262, Y + 26); ctx.lineTo(284, Y + 26); ctx.lineTo(276, Y + 40); ctx.closePath(); ctx.fill();

  const wall = ctx.createLinearGradient(0, Y + 46, 0, BASE);
  wall.addColorStop(0, '#bdb09e');
  wall.addColorStop(1, '#a4988a');
  ctx.fillStyle = wall;
  ctx.fillRect(X, Y + 46, WD, BASE - Y - 46);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(X, Y + 46, WD, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fillRect(X + WD - 12, Y + 46, 12, BASE - Y - 46);

  ctx.fillStyle = 'rgba(95,75,55,0.13)';
  ell(ctx, 130, 300, 22, 34); ctx.fill();
  ell(ctx, 262, 282, 16, 26); ctx.fill();
  ell(ctx, 244, 418, 30, 12); ctx.fill();

  for (const wx of [126, 234]) {
    ctx.fillStyle = '#7b7061';
    rr(ctx, wx - 3, 259, 46, 54, 3); ctx.fill();
    ctx.fillStyle = '#3b383d';
    ctx.fillRect(wx, 262, 40, 48);
    ctx.fillStyle = 'rgba(120,145,165,0.6)';
    ctx.beginPath(); ctx.moveTo(wx, 262); ctx.lineTo(wx + 18, 262); ctx.lineTo(wx, 286); ctx.fill();
    plank(ctx, wx - 5, 270, wx + 45, 302);
    plank(ctx, wx - 5, 304, wx + 45, 272);
  }

  awning(ctx, X + 8, 324, WD - 16, 24, '#c6b6a4', '#a2958a', '#8b7f72', true);

  for (const sx of [116, 226]) {
    ctx.fillStyle = '#7b7061';
    rr(ctx, sx - 3, 357, 64, 64, 3); ctx.fill();
    ctx.fillStyle = '#38353a';
    ctx.fillRect(sx, 360, 58, 58);
    plank(ctx, sx - 6, 370, sx + 64, 373, 9);
    plank(ctx, sx - 6, 390, sx + 64, 386, 9);
    plank(ctx, sx - 6, 408, sx + 64, 410, 9);
  }
  ctx.save();
  ctx.translate(146, 396);
  ctx.rotate(-0.09);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-22, -10, 46, 24);
  ctx.fillStyle = '#f3eddd';
  ctx.fillRect(-24, -12, 46, 24);
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d4432d';
  ctx.fillText('FOR SALE', -1, 0.5);
  ctx.restore();

  ctx.fillStyle = '#6c6153';
  rr(ctx, 178, 354, 44, 76, 3); ctx.fill();
  ctx.fillStyle = '#56473c';
  ctx.fillRect(181, 357, 38, 73);
  plank(ctx, 179, 364, 221, 422);
  plank(ctx, 221, 364, 179, 422);

  ctx.strokeStyle = '#86796a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(110, 252); ctx.lineTo(118, 264); ctx.lineTo(113, 276); ctx.lineTo(122, 292);
  ctx.moveTo(286, 318); ctx.lineTo(278, 332); ctx.lineTo(283, 344);
  ctx.moveTo(160, 428); ctx.lineTo(168, 416); ctx.lineTo(164, 406);
  ctx.stroke();

  ctx.fillStyle = '#a59b8b';
  rr(ctx, 174, 426, 52, 8, 2); ctx.fill();
}

function cupIcon(ctx, x, y, s, body = '#fff3df', coffee = '#7a4a2a') {
  ctx.fillStyle = body;
  rr(ctx, x - 6 * s, y - 5 * s, 12 * s, 11 * s, 3 * s); ctx.fill();
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = body;
  ctx.beginPath(); ctx.arc(x + 6.5 * s, y, 3 * s, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.fillStyle = coffee;
  ell(ctx, x, y - 5 * s, 6 * s, 1.6 * s); ctx.fill();
}

function drawOpen(ctx, time) {
  ctx.fillStyle = 'rgba(40,35,30,0.22)';
  rr(ctx, X - 6, BASE - 8, WD + 12, 16, 8); ctx.fill();

  // sign
  ctx.fillStyle = '#173f3c';
  rr(ctx, 130, Y - 4, 140, 36, 9); ctx.fill();
  ctx.fillStyle = '#24625e';
  rr(ctx, 132, Y - 6, 136, 34, 8); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fff1da';
  rr(ctx, 136, Y - 2, 128, 26, 6); ctx.stroke();
  cupIcon(ctx, 158, Y + 12, 1);
  ctx.strokeStyle = 'rgba(255,241,218,0.7)';
  ctx.lineWidth = 1.5;
  for (const dx of [-2, 2]) {
    const k = Math.sin(time * 3 + dx) * 1.5;
    ctx.beginPath(); ctx.moveTo(158 + dx, Y + 4); ctx.quadraticCurveTo(160 + dx + k, Y + 1, 158 + dx, Y - 2); ctx.stroke();
  }
  gameText(ctx, 'CAFÉ', 214, Y + 11, 22, { fill: '#fff1da', stroke: '#173f3c', lw: 4, drop: false });

  // cornice with dentils
  ctx.fillStyle = '#2d7a74';
  ctx.fillRect(X - 6, Y + 26, WD + 12, 20);
  ctx.fillStyle = '#4c9f97';
  ctx.fillRect(X - 6, Y + 26, WD + 12, 5);
  ctx.fillStyle = '#fff1da';
  for (let x = X - 2; x < X + WD + 4; x += 12) ctx.fillRect(x, Y + 40, 6, 4);

  const wall = ctx.createLinearGradient(0, Y + 46, 0, BASE);
  wall.addColorStop(0, '#fff2dc');
  wall.addColorStop(1, '#ffdcae');
  ctx.fillStyle = wall;
  ctx.fillRect(X, Y + 46, WD, BASE - Y - 46);
  ctx.fillStyle = 'rgba(120,60,20,0.14)';
  ctx.fillRect(X, Y + 46, WD, 7);
  ctx.fillStyle = 'rgba(160,90,30,0.08)';
  ctx.fillRect(X + WD - 12, Y + 46, 12, BASE - Y - 46);

  // wainscot
  ctx.fillStyle = '#2d7a74';
  ctx.fillRect(X, 414, WD, BASE - 414);
  ctx.fillStyle = '#4c9f97';
  ctx.fillRect(X, 414, WD, 3);

  // string lights
  ctx.strokeStyle = '#3b3436';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(X + 4, Y + 52);
  ctx.quadraticCurveTo(200, Y + 72, X + WD - 4, Y + 52);
  ctx.stroke();
  for (let i = 1; i < 11; i++) {
    const k = i / 11, bx = X + 4 + k * (WD - 8);
    const by = Y + 52 + 4 * k * (1 - k) * 10 + 3;
    const tw = 0.7 + 0.3 * Math.sin(time * 4 + i * 1.7);
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 9);
    glow.addColorStop(0, `rgba(255,226,140,${0.55 * tw})`);
    glow.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(bx - 9, by - 9, 18, 18);
    ctx.fillStyle = '#fff6c8';
    ell(ctx, bx, by, 2.4, 3); ctx.fill();
  }

  for (const wx of [126, 234]) {
    ctx.fillStyle = '#2d7a74';
    rr(ctx, wx - 5, 257, 50, 58, 5); ctx.fill();
    ctx.fillStyle = '#fff6ea';
    rr(ctx, wx - 3, 259, 46, 54, 4); ctx.fill();
    const glass = ctx.createLinearGradient(0, 262, 0, 310);
    glass.addColorStop(0, '#d8f2ff');
    glass.addColorStop(1, '#8fcdf0');
    ctx.fillStyle = glass;
    ctx.fillRect(wx, 262, 40, 48);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(wx + 4, 262); ctx.lineTo(wx + 16, 262); ctx.lineTo(wx, 280); ctx.lineTo(wx, 268); ctx.fill();
    ctx.fillStyle = '#fff6ea';
    ctx.fillRect(wx + 18.5, 262, 3, 48);
    ctx.fillRect(wx, 284.5, 40, 3);
    // flower box
    ctx.fillStyle = '#3f9c3a';
    for (let f = 0; f < 6; f++) { ell(ctx, wx + 2 + f * 7.2, 311, 5, 4); ctx.fill(); }
    const cols = ['#ff6fae', '#ffd23f', '#ff5a5a'];
    for (let f = 0; f < 5; f++) {
      ctx.fillStyle = cols[f % 3];
      ell(ctx, wx + 5 + f * 7.5, 308 - (f % 2) * 2, 2.8, 2.8); ctx.fill();
    }
    ctx.fillStyle = '#d4694a';
    rr(ctx, wx - 5, 312, 50, 10, 3); ctx.fill();
    ctx.fillStyle = '#e8866a';
    ctx.fillRect(wx - 3, 313, 46, 2);
  }

  awning(ctx, X + 8, 324, WD - 16, 24, '#ff6b4a', '#fff4e4', '#e0523a', false);

  for (const sx of [116, 226]) {
    ctx.fillStyle = '#2d7a74';
    rr(ctx, sx - 4, 356, 66, 62, 4); ctx.fill();
    const warm = ctx.createLinearGradient(0, 360, 0, 414);
    warm.addColorStop(0, '#ffe7b0');
    warm.addColorStop(1, '#ffb45e');
    ctx.fillStyle = warm;
    ctx.fillRect(sx, 360, 58, 54);
    ctx.fillStyle = '#c98146';
    ctx.fillRect(sx, 396, 58, 4);
    for (let c = 0; c < 3; c++) cupIcon(ctx, sx + 12 + c * 17, 389, 0.7, '#ffffff', '#c98146');
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(sx + 30, 360); ctx.lineTo(sx + 46, 360); ctx.lineTo(sx + 18, 414); ctx.lineTo(sx + 2, 414); ctx.fill();
  }

  // door
  ctx.fillStyle = '#1f5753';
  rr(ctx, 177, 352, 46, 78, 5); ctx.fill();
  ctx.fillStyle = '#2d7a74';
  rr(ctx, 181, 356, 38, 74, 3); ctx.fill();
  ctx.fillStyle = '#ffd88a';
  ell(ctx, 200, 376, 11, 11); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ell(ctx, 196, 372, 4, 3); ctx.fill();
  ctx.fillStyle = '#24625e';
  rr(ctx, 186, 394, 28, 30, 3); ctx.fill();
  ctx.fillStyle = '#ffcf4a';
  ell(ctx, 213, 398, 2.4, 2.4); ctx.fill();

  ctx.fillStyle = '#ece2d2';
  rr(ctx, 172, 426, 56, 9, 3); ctx.fill();

  for (const px of [160, 240]) {
    ctx.fillStyle = '#c75f40';
    ctx.beginPath(); ctx.moveTo(px - 10, 414); ctx.lineTo(px + 10, 414); ctx.lineTo(px + 7, 432); ctx.lineTo(px - 7, 432); ctx.fill();
    ctx.fillStyle = '#e07a58';
    ctx.fillRect(px - 11, 412, 22, 4);
    ctx.fillStyle = '#3c9a3a';
    ell(ctx, px, 402, 12, 12); ctx.fill();
    ctx.fillStyle = '#5cbf4e';
    ell(ctx, px - 3, 398, 8, 7); ctx.fill();
  }
}

function drawChalkboard(ctx) {
  const x = 140, y = 600;
  ctx.fillStyle = 'rgba(30,30,40,0.22)';
  ell(ctx, x, y + 22, 18, 4); ctx.fill();
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath(); ctx.moveTo(x - 15, y + 22); ctx.lineTo(x - 11, y - 8); ctx.lineTo(x + 11, y - 8); ctx.lineTo(x + 15, y + 22); ctx.lineTo(x + 12, y + 22); ctx.lineTo(x + 9, y - 4); ctx.lineTo(x - 9, y - 4); ctx.lineTo(x - 12, y + 22); ctx.fill();
  ctx.fillStyle = '#2e3a37';
  rr(ctx, x - 10, y - 5, 20, 22, 2); ctx.fill();
  ctx.font = `8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('OPEN', x, y + 2);
  cupIcon(ctx, x - 1, y + 12, 0.55, '#ffffff', '#ffd23f');
}

export class Cafe {
  constructor() {
    this.state = 'derelict';
    this.t = 0;
    this.springT = 99;
  }
  get isOpen() { return this.state === 'open'; }
  setOpen() { this.state = 'open'; this.springT = 99; }
  buy() {
    if (this.state !== 'derelict') return false;
    this.state = 'buying';
    this.t = 0;
    return true;
  }
  update(dt, onOpened) {
    this.springT += dt;
    if (this.state === 'buying') {
      this.t += dt;
      if (this.t >= BUY_TIME) {
        this.state = 'open';
        this.springT = 0;
        onOpened();
      }
    }
  }
  draw(ctx, time, reduced) {
    let sx = 1, sy = 1, dx = 0;
    if (this.state === 'buying') {
      const k = this.t / BUY_TIME;
      dx = reduced ? 0 : Math.sin(this.t * 70) * 2.5 * k;
      sy = 1 - 0.05 * k;
      sx = 1 + 0.03 * k;
    } else if (this.springT < 1.8) {
      const a = -0.15 * Math.exp(-4.2 * this.springT) * Math.cos(13 * this.springT);
      sx = 1 + a;
      sy = 1 - a;
    }
    ctx.save();
    ctx.translate(200 + dx, BASE);
    ctx.scale(sx, sy);
    ctx.translate(-200, -BASE);
    if (this.state === 'open') drawOpen(ctx, time);
    else drawDerelict(ctx);
    ctx.restore();
    if (this.state === 'open') drawChalkboard(ctx);
  }
}
