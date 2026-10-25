import * as THREE from 'three';
import { rbox, mat, glow, add, box, sphere, cyl, group, signTexture, geo, easeOutCubic } from './kit.js';

// Shops along the far side of the street. Each has a neglected and a restored look.

export const STYLES = {
  flowershop: { x: -2.7, sign: 'FLOWERS', h: 2.4, roof: 'gable', wall: '#ffd8e1', trim: '#3f8a5a', awnA: '#ff86ad', awnB: '#fff3f6', signBg: '#3f8a5a', signFg: '#fff3f6', door: '#3f8a5a', roofColor: '#e8735f' },
  cafe: { x: 0, sign: 'CAFÉ', h: 2.7, roof: 'flat', roofColor: '#d9cdb8', wall: '#fff0d6', trim: '#2d7a74', awnA: '#ff6a4a', awnB: '#fff4e4', signBg: '#24625e', signFg: '#fff1da', door: '#2d7a74' },
  bakery: { x: 2.7, sign: 'BAKERY', h: 2.55, roof: 'gable', wall: '#ffe7a6', trim: '#8a5636', awnA: '#f2a03a', awnB: '#fff8e8', signBg: '#8a5636', signFg: '#fff1d0', door: '#8a5636', roofColor: '#c4623e' },
  boutique: { x: 5.4, sign: 'BOUTIQUE', h: 2.8, roof: 'flat', roofColor: '#d6cfe6', wall: '#e5dcff', trim: '#5b4c96', awnA: '#8c78e6', awnB: '#ffffff', signBg: '#4a3d80', signFg: '#ffffff', door: '#5b4c96' },
};

const W = 2.45, D = 2.2, LOT_Z = -6.7;
export const FACADE_Z = LOT_Z + D / 2; // -5.6

const DERELICT = { wall: '#a9a397', trim: '#7b746a', awnA: '#b8afa3', awnB: '#968e84', glass: '#3c3d44', roofColor: '#8b7f72' };

function plank(parent, x, y, z, len, angle, list) {
  const m = box(parent, len, 0.1, 0.04, '#ad875a', { x, y, z, rz: angle, center: true }, 0.015);
  list.push(m);
  return m;
}

function gableRoof(parent, color, h) {
  const a = 0.55, hd = D / 2 + 0.18;
  const L = hd / Math.cos(a) + 0.04;
  for (const s of [1, -1]) {
    const slab = add(parent, rbox(W + 0.32, 0.12, L, 0.04), mat(color), { center: true });
    slab.position.set(0, h + 0.12 + (hd / 2) * Math.tan(a), (s * hd) / 2);
    slab.rotation.x = s * a;
  }
  const shape = new THREE.Shape();
  shape.moveTo(-hd + 0.12, 0);
  shape.lineTo(hd - 0.12, 0);
  shape.lineTo(0, (hd - 0.12) * Math.tan(a));
  shape.closePath();
  const tri = new THREE.ExtrudeGeometry(shape, { depth: W - 0.02, bevelEnabled: false });
  tri.rotateY(Math.PI / 2);
  tri.translate(-(W - 0.02) / 2, 0, 0);
  return add(parent, tri, mat('#ffffff'), { y: h + 0.1, center: true });
}

export class Building {
  constructor(scene, id) {
    this.id = id;
    this.style = STYLES[id];
    this.state = 'derelict';
    this.root = group(scene, this.style.x, 0, LOT_Z);
    this.body = group(this.root);
    this.boards = [];
    this.debris = [];
    this.anim = null;
    this.signGlow = 0;
    this.highlight = null;
    this.root.userData.tap = { type: 'building', id };
    this.build();
    this.setState('derelict');
  }

  build() {
    const s = this.style, B = this.body, h = s.h, fz = D / 2;
    this.mWall = new THREE.MeshLambertMaterial({ color: DERELICT.wall });
    this.mTrim = new THREE.MeshLambertMaterial({ color: DERELICT.trim });
    this.mRoof = new THREE.MeshLambertMaterial({ color: DERELICT.roofColor });

    box(B, W + 0.12, 0.14, D + 0.12, '#9a948a', { y: 0 }, 0.04);
    add(B, rbox(W, h, D, 0.06), this.mWall, { y: 0.12 });
    if (s.roof === 'flat') {
      add(B, rbox(W + 0.2, 0.2, D + 0.2, 0.05), this.mTrim, { y: h + 0.08 });
      add(B, rbox(W - 0.1, 0.1, D - 0.1, 0.03), this.mRoof, { y: h + 0.26 });
      // rooftop clutter so the flat roof doesn't read as an empty slab
      box(B, 0.55, 0.32, 0.45, '#c9ced3', { x: 0.55, y: h + 0.34, z: -0.3 }, 0.05);
      box(B, 0.4, 0.06, 0.34, '#9aa3ab', { x: 0.55, y: h + 0.66, z: -0.3 }, 0.02);
      cyl(B, 0.06, 0.06, 0.3, '#8f979e', { x: -0.7, y: h + 0.34, z: -0.5 }, 10);
      box(B, 0.5, 0.18, 0.5, '#b5aa98', { x: -0.45, y: h + 0.34, z: 0.25 }, 0.04);
    } else {
      add(B, rbox(W + 0.14, 0.12, D + 0.14, 0.04), this.mTrim, { y: h + 0.06 });
      const tri = gableRoof(B, DERELICT.roofColor, h + 0.06);
      tri.material = this.mWall;
      B.children.slice(-3, -1).forEach((m) => { m.material = this.mRoof; });
    }

    // upper windows
    this.upper = [];
    for (const x of [-0.6, 0.6]) {
      const y = h * 0.66 + 0.12;
      add(B, rbox(0.58, 0.68, 0.08, 0.03), this.mTrim, { x, y: y - 0.34, z: fz + 0.02 });
      const glass = add(B, rbox(0.46, 0.56, 0.06, 0.02), mat(DERELICT.glass), { x, y: y - 0.28, z: fz + 0.04 });
      const box2 = group(B, x, y - 0.42, fz + 0.12);
      box(box2, 0.58, 0.1, 0.16, '#d36d4b', { y: 0 }, 0.03);
      for (let i = 0; i < 5; i++) sphere(box2, 0.055, ['#ff6fae', '#ffd23f', '#ff5a5a', '#ffffff', '#ff9f43'][i], { x: -0.22 + i * 0.11, y: 0.13 });
      for (let i = 0; i < 6; i++) sphere(box2, 0.05, '#3f9c3a', { x: -0.25 + i * 0.1, y: 0.1, z: 0.03 });
      this.upper.push({ glass, box: box2 });
      plank(B, x, y, fz + 0.09, 0.7, 0.75, this.boards);
      plank(B, x, y, fz + 0.1, 0.7, -0.75, this.boards);
    }

    // shop window + door
    add(B, rbox(1.0, 0.98, 0.08, 0.03), this.mTrim, { x: -0.5, y: 0.26, z: fz + 0.02 });
    this.shopGlass = add(B, rbox(0.86, 0.84, 0.06, 0.02), mat(DERELICT.glass), { x: -0.5, y: 0.33, z: fz + 0.04 });
    for (const y of [0.48, 0.75, 1.02]) plank(B, -0.5, y, fz + 0.1, 1.08, (y - 0.75) * 0.12, this.boards);
    add(B, rbox(0.62, 1.16, 0.08, 0.03), this.mTrim, { x: 0.62, y: 0.14, z: fz + 0.02 });
    this.door = add(B, rbox(0.5, 1.06, 0.06, 0.02), mat('#5a4a3e'), { x: 0.62, y: 0.16, z: fz + 0.05 });
    this.doorWindow = add(B, geo('doorwin', () => new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16).rotateX(Math.PI / 2)), mat('#ffd88a', { emissive: '#ffb84a', emissiveIntensity: 0.6 }), { x: 0.62, y: 0.95, z: fz + 0.09, center: true });
    plank(B, 0.62, 0.7, fz + 0.1, 1.2, 1.0, this.boards);
    plank(B, 0.62, 0.7, fz + 0.11, 1.2, -1.0, this.boards);

    // FOR SALE notice taped to the window
    const sale = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.24), new THREE.MeshLambertMaterial({ map: signTexture('FOR SALE', { bg: '#f6f0e1', fg: '#d6432d', border: '#d6432d', size: 82 }) }));
    sale.position.set(-0.62, 0.62, fz + 0.13);
    sale.rotation.z = 0.08;
    B.add(sale);
    this.saleSign = sale;

    // awning: tilted stripes with scalloped edge
    this.awning = group(B, 0, 1.42, fz + 0.06);
    this.stripes = [];
    const n = 8, sw = (W - 0.1) / n;
    for (let i = 0; i < n; i++) {
      const m = new THREE.MeshLambertMaterial({ color: i % 2 ? DERELICT.awnB : DERELICT.awnA });
      const st = add(this.awning, rbox(sw * 0.99, 0.04, 0.62, 0.015), m, { x: -W / 2 + 0.05 + sw * (i + 0.5), y: 0, z: 0.28, rx: 0.42, center: true });
      const sc = add(this.awning, geo('scallop', () => new THREE.SphereGeometry(sw / 2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI)), m, { x: st.position.x, y: -0.13, z: 0.57, center: true });
      sc.scale.set(1, 0.6, 0.35);
      this.stripes.push({ st, sc, m });
    }

    // sign board
    this.signMat = new THREE.MeshLambertMaterial({ map: signTexture(s.sign, { bg: s.signBg, fg: s.signFg, border: s.signFg }), emissive: '#ffffff', emissiveIntensity: 0 });
    this.signMat.emissiveMap = this.signMat.map;
    this.signBoard = add(B, rbox(W * 0.78, 0.4, 0.1, 0.04), this.mTrim, { y: 1.68, z: fz + 0.06 });
    this.signFace = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.74, 0.34), this.signMat);
    this.signFace.position.set(0, 1.88, fz + 0.115);
    B.add(this.signFace);
    this.signDead = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.74, 0.34), mat('#6f685f'));
    this.signDead.position.copy(this.signFace.position);
    B.add(this.signDead);

    // planters by the door (restored only)
    this.extras = group(B);
    for (const x of [0.12, 1.12]) {
      const p = group(this.extras, x, 0.14, fz + 0.25);
      cyl(p, 0.13, 0.1, 0.22, '#d06a47', {}, 12);
      sphere(p, 0.16, '#4caa45', { y: 0.32 });
      sphere(p, 0.1, '#6cc95a', { x: -0.05, y: 0.4, z: 0.05 });
    }
    // string lights under the cornice
    const bulbs = [];
    for (let i = 0; i < 9; i++) {
      const t = i / 8, x = -W / 2 + 0.12 + t * (W - 0.24);
      bulbs.push(sphere(this.extras, 0.035, glow('#ffe7a3', 1.4), { x, y: s.h - 0.02 - Math.sin(t * Math.PI) * 0.12, z: fz + 0.08 }));
    }
    this.bulbs = bulbs;
    this.buildSpecial();

    // scaffold shown while under construction
    this.scaffold = group(this.root);
    for (const x of [-1.3, 0, 1.3]) cyl(this.scaffold, 0.03, 0.03, s.h + 0.4, '#d9a441', { x, y: 0, z: fz + 0.42 }, 6);
    for (const y of [0.7, 1.5, s.h + 0.2]) box(this.scaffold, 2.7, 0.06, 0.32, '#c98b3a', { y, z: fz + 0.42 }, 0.02);
    box(this.scaffold, 0.42, 0.36, 0.36, '#c9965a', { x: 1.0, y: 0.12, z: fz + 0.9 }, 0.04);
    box(this.scaffold, 0.3, 0.26, 0.3, '#b9864a', { x: 1.0, y: 0.48, z: fz + 0.9, ry: 0.4 }, 0.04);
    this.scaffold.visible = false;

    // invisible tap volume
    const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, s.h + 0.8, D + 1.4), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, (s.h + 0.8) / 2, 0.5);
    this.root.add(hit);
  }

  buildSpecial() {
    const fz = D / 2, X = this.extras;
    if (this.id === 'cafe') {
      // espresso window counter on the sidewalk
      const c = group(X, -0.5, 0.12, fz + 0.48);
      box(c, 0.98, 0.5, 0.42, '#2d7a74', { y: 0 }, 0.04);
      box(c, 1.06, 0.07, 0.5, '#e8d3b3', { y: 0.5 }, 0.03);
      const m = group(c, 0.12, 0.57, -0.02);
      box(m, 0.4, 0.32, 0.28, '#d5dde2', { y: 0 }, 0.05);
      box(m, 0.42, 0.06, 0.3, '#e0523a', { y: 0.32 }, 0.02);
      box(m, 0.12, 0.04, 0.06, '#3b3f48', { y: 0.12, z: 0.16 }, 0.01);
      cyl(m, 0.05, 0.04, 0.08, '#ffffff', { x: -0.08, y: 0.02, z: 0.2 }, 10);
      this.machine = m;
      this.counter = c;
      this.cupSpot = new THREE.Vector3();
      // outdoor seating, shown after that upgrade
      this.seating = group(this.root, -1.2, 0.12, fz + 0.75);
      for (const [x, z] of [[-0.35, -0.05], [0.25, 0.35]]) {
        const t = group(this.seating, x, 0, z);
        cyl(t, 0.2, 0.2, 0.04, '#ffffff', { y: 0.36 }, 16);
        cyl(t, 0.025, 0.04, 0.36, '#3b3f48', {}, 8);
        cyl(t, 0.015, 0.015, 1.05, '#3b3f48', { y: 0.36 }, 6);
        const umb = add(t, geo('umb', () => new THREE.ConeGeometry(0.42, 0.22, 10)), mat('#ff6a4a'), { y: 1.28 });
        umb.material = mat(x < 0 ? '#ff6a4a' : '#fff4e4');
        for (const a of [0, Math.PI]) box(t, 0.16, 0.24, 0.16, '#e0a36b', { x: Math.cos(a) * 0.3, y: 0, z: Math.sin(a) * 0.3 }, 0.03);
      }
      this.seating.visible = false;
    } else if (this.id === 'flowershop') {
      for (const [x, c] of [[-0.85, '#ff7eb9'], [-0.55, '#ffd23f'], [-0.25, '#ff5a5a']]) {
        const b = group(X, x, 0.12, fz + 0.4);
        cyl(b, 0.1, 0.08, 0.2, '#6d8fb0', {}, 10);
        for (let i = 0; i < 4; i++) sphere(b, 0.06, c, { x: Math.cos(i * 1.6) * 0.05, y: 0.26 + (i % 2) * 0.04, z: Math.sin(i * 1.6) * 0.05 });
      }
    } else if (this.id === 'bakery') {
      const sign = group(X, -0.5, 0.12, fz + 0.38);
      box(sign, 0.36, 0.5, 0.06, '#5b3a26', { y: 0, rx: -0.2 }, 0.02);
      const crois = add(sign, geo('crois', () => new THREE.TorusGeometry(0.1, 0.05, 8, 14, Math.PI * 1.3)), mat('#e9a64a'), { y: 0.28, z: 0.08, center: true });
      crois.rotation.z = Math.PI * 0.35;
    } else if (this.id === 'boutique') {
      for (const x of [-0.75, -0.3]) {
        const m = group(X, x, 0.14, fz - 0.1);
        cyl(m, 0.13, 0.16, 0.5, '#ffffff', { y: 0.25 }, 12);
        sphere(m, 0.08, '#ffffff', { y: 0.85 });
      }
    }
  }

  // world anchor for UI badges above the building
  anchor(y = this.style.h + 0.9) {
    return new THREE.Vector3(this.style.x, y, FACADE_Z + 0.4);
  }

  setState(state) {
    this.state = state;
    const open = state === 'open';
    const s = this.style;
    this.mWall.color.set(open ? s.wall : DERELICT.wall);
    this.mTrim.color.set(open ? s.trim : DERELICT.trim);
    this.mRoof.color.set(open ? s.roofColor || s.trim : DERELICT.roofColor);
    for (const b of this.boards) b.visible = !open;
    for (const u of this.upper) {
      u.glass.material = open ? mat('#a9dcf5', { emissive: '#bfe6ff', emissiveIntensity: 0.25 }) : mat(DERELICT.glass);
      u.box.visible = open;
    }
    this.shopGlass.material = open ? mat('#ffd28a', { emissive: '#ffb04a', emissiveIntensity: 0.75 }) : mat(DERELICT.glass);
    this.door.material = open ? mat(s.door) : mat('#5a4a3e');
    this.doorWindow.visible = open;
    this.saleSign.visible = !open;
    this.signFace.visible = open;
    this.signDead.visible = !open;
    this.extras.visible = open;
    this.stripes.forEach((p, i) => {
      p.m.color.set(open ? (i % 2 ? s.awnB : s.awnA) : (i % 2 ? DERELICT.awnB : DERELICT.awnA));
      const torn = !open && (i === 2 || i === 5);
      p.st.visible = !torn;
      p.sc.visible = !torn;
      p.st.rotation.z = open ? 0 : (i - 4) * 0.012;
    });
    this.awning.rotation.z = open ? 0 : -0.05;
    if (!open) this.signGlow = 0;
  }

  // Boards fly off, the building squashes and springs back, the sign flickers on.
  restore() {
    for (const b of this.boards) {
      const w = new THREE.Vector3();
      b.getWorldPosition(w);
      const m = b.clone();
      m.position.copy(w);
      m.rotation.copy(b.rotation);
      this.root.parent.add(m);
      this.debris.push({ m, vx: (Math.random() - 0.5) * 2.5, vy: 2 + Math.random() * 2, vz: 1.5 + Math.random() * 2, vr: (Math.random() - 0.5) * 12, life: 0 });
    }
    this.setState('open');
    this.anim = { t: 0 };
  }

  setConstructing(on) {
    this.scaffold.visible = on;
  }

  setSeating(on) {
    if (this.seating) this.seating.visible = on;
  }

  setHighlight(on) {
    if (on && !this.highlight) {
      const g = group(this.root, 0, 0, 0.6);
      const c = document.createElement('canvas');
      c.width = 4; c.height = 128;
      const x = c.getContext('2d');
      const grd = x.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, 'rgba(255,230,140,0)');
      grd.addColorStop(1, 'rgba(255,230,140,0.7)');
      x.fillStyle = grd;
      x.fillRect(0, 0, 4, 128);
      const tex = new THREE.CanvasTexture(c);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 5, 32, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      beam.position.y = 2.5;
      g.add(beam);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 40), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.8, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.16;
      g.add(ring);
      this.highlight = { g, beam, ring };
    }
    if (this.highlight) this.highlight.g.visible = on;
  }

  update(dt, time) {
    if (this.anim) {
      const t = (this.anim.t += dt);
      const a = -0.16 * Math.exp(-4 * t) * Math.cos(12 * t);
      this.body.scale.set(1 + a, 1 - a, 1 + a);
      this.signGlow = Math.min(0.55, t * 0.8) * (t < 0.7 ? (Math.sin(t * 60) > 0 ? 1 : 0.2) : 1);
      if (t > 2) { this.anim = null; this.body.scale.set(1, 1, 1); this.signGlow = 0.55; }
    }
    if (this.state === 'open') {
      this.signMat.emissiveIntensity = this.signGlow;
      this.bulbs.forEach((b, i) => { b.scale.setScalar(0.85 + 0.2 * Math.sin(time * 3 + i)); });
    }
    if (this.scaffold.visible) this.body.position.y = Math.abs(Math.sin(time * 9)) * 0.015;
    else this.body.position.y = 0;
    if (this.highlight?.g.visible) {
      const p = 0.5 + 0.5 * Math.sin(time * 3);
      this.highlight.beam.material.opacity = 0.22 + p * 0.22;
      this.highlight.ring.material.opacity = 0.5 + p * 0.4;
      this.highlight.ring.scale.setScalar(1 + p * 0.05);
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life += dt;
      d.vy -= 12 * dt;
      d.m.position.x += d.vx * dt;
      d.m.position.y += d.vy * dt;
      d.m.position.z += d.vz * dt;
      d.m.rotation.z += d.vr * dt;
      d.m.rotation.x += d.vr * 0.5 * dt;
      if (d.m.position.y < 0.15) { d.m.position.y = 0.15; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; d.vr *= 0.5; }
      if (d.life > 1.3) d.m.scale.multiplyScalar(Math.max(0, 1 - dt * 6));
      if (d.life > 1.8) { d.m.removeFromParent(); this.debris.splice(i, 1); }
    }
  }

  // world positions used by the café queue
  counterFront() { return new THREE.Vector3(this.style.x - 0.5, 0.12, FACADE_Z + 1.05); }
  machineTop() { return new THREE.Vector3(this.style.x - 0.38, 1.25, FACADE_Z + 0.5); }
}

// Closed storefronts that frame the edges of the street.
export function framingBuildings(scene) {
  for (const [x, h, c] of [[-5.4, 2.6, '#a8a093'], [-8.1, 2.9, '#a59b8f'], [8.1, 2.5, '#aba497'], [10.8, 2.7, '#a39f96']]) {
    const g = group(scene, x, 0, LOT_Z);
    box(g, W + 0.12, 0.14, D + 0.12, '#9a948a', { y: 0 }, 0.04);
    box(g, W, h, D, c, { y: 0.12 }, 0.06);
    box(g, W + 0.2, 0.18, D + 0.2, '#857d72', { y: h + 0.08 }, 0.05);
    box(g, W - 0.4, 0.9, 0.06, '#8d9298', { y: 0.14, z: D / 2 + 0.02 }, 0.02);
    for (const wx of [-0.6, 0.6]) box(g, 0.46, 0.56, 0.06, '#3c3d44', { x: wx, y: h * 0.62, z: D / 2 + 0.02 }, 0.02);
  }
}

export { easeOutCubic };
