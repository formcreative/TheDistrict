import * as THREE from 'three';
import { rbox, mat, glow, add, box, sphere, cyl, group, mulberry, geo } from './kit.js';

// The street itself: ground, road, sidewalks (with swappable paving), lamps, park beds, trash.

export const ZONES = {
  farWalk: { x0: -6.6, x1: 6.6, z0: -5.6, z1: -4.0 },
  road: { z0: -4.0, z1: -1.2 },
  nearWalk: { x0: -6.6, x1: 6.6, z0: -1.2, z1: 0.2 },
  park: { x0: -6.6, x1: 6.6, z0: 0.2, z1: 7.2 },
  lawn: { x0: -2.5, x1: 2.5, z0: 1.1, z1: 5.3 },
  walkY: 0.12,
};

const BEDS = [
  { x: -3.55, z: 2.2, w: 1.6, d: 2.0 },
  { x: 3.55, z: 2.2, w: 1.6, d: 2.0 },
  { x: -3.55, z: 5.0, w: 1.6, d: 2.2 },
  { x: 3.55, z: 5.0, w: 1.6, d: 2.2 },
];

const TRASH = [
  [-2.9, 0.7], [2.6, 0.75], [-1.7, 6.3], [1.9, 6.2], [-3.6, -1.5], [1.1, -1.45], [3.75, -4.75], [-0.5, 0.65],
];

const LAMPS = [
  [-3.0, -1.0, 1], [0, -1.0, 1], [3.0, -1.0, 1],
  [-1.35, -4.1, -1], [1.35, -4.1, -1],
];

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,236,170,1)');
  grd.addColorStop(0.35, 'rgba(255,220,140,0.45)');
  grd.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function makeGlowSprite(scale = 1.6, opacity = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale);
  return s;
}

function instanced(geometry, material, transforms) {
  const m = new THREE.InstancedMesh(geometry, material, transforms.length);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  transforms.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
    o.scale.set(t.sx || 1, t.sy || 1, t.sz || 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    m.setColorAt(i, c.set(t.color || '#ffffff'));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

function walkRects() { return [ZONES.farWalk, ZONES.nearWalk]; }

function buildPaving(type, seed = 3) {
  const g = new THREE.Group();
  const r = mulberry(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const tiles = [];
  let geom, base;
  if (type === 'cobblestone') {
    base = '#6e6a66';
    geom = rbox(0.24, 0.1, 0.24, 0.05, 2);
    for (const z of walkRects()) {
      for (let zz = z.z0 + 0.14, row = 0; zz < z.z1 - 0.1; zz += 0.26, row++) {
        for (let xx = z.x0 + 0.14 + (row % 2) * 0.13; xx < z.x1 - 0.1; xx += 0.26) {
          tiles.push({ x: xx + (r() - 0.5) * 0.03, y: 0.08, z: zz + (r() - 0.5) * 0.03, ry: (r() - 0.5) * 0.3, sx: 0.9 + r() * 0.15, sz: 0.9 + r() * 0.15, color: pick(['#a7a19a', '#b5aea5', '#9b958e', '#c0b8ad', '#a39c90']) });
        }
      }
    }
  } else if (type === 'limestone') {
    base = '#cdbf9f';
    geom = rbox(0.86, 0.1, 0.56, 0.03, 1);
    for (const z of walkRects()) {
      for (let zz = z.z0 + 0.3, row = 0; zz < z.z1 - 0.2; zz += 0.6, row++) {
        for (let xx = z.x0 + 0.44 + (row % 2) * 0.45; xx < z.x1 - 0.3; xx += 0.9) {
          tiles.push({ x: xx, y: 0.08, z: zz, color: pick(['#f1e6cd', '#ebdfc3', '#f5ecd8', '#e6d8b8']) });
        }
      }
    }
  } else if (type === 'brick') {
    base = '#c9b9a6';
    geom = rbox(0.3, 0.1, 0.14, 0.02, 1);
    for (const z of walkRects()) {
      for (let zz = z.z0 + 0.09, row = 0; zz < z.z1 - 0.06; zz += 0.16, row++) {
        for (let xx = z.x0 + 0.16 + (row % 2) * 0.16; xx < z.x1 - 0.12; xx += 0.32) {
          tiles.push({ x: xx, y: 0.08, z: zz, color: pick(['#c4573f', '#b84d37', '#cf6449', '#ad4532', '#d16e52']) });
        }
      }
    }
  } else {
    // cracked, heaved concrete with missing slabs and weeds
    base = '#8f8774';
    geom = rbox(0.6, 0.1, 0.6, 0.03, 1);
    for (const z of walkRects()) {
      for (let zz = z.z0 + 0.34; zz < z.z1 - 0.2; zz += 0.64) {
        for (let xx = z.x0 + 0.34; xx < z.x1 - 0.2; xx += 0.64) {
          if (r() < 0.1) continue;
          tiles.push({ x: xx, y: 0.06 + r() * 0.03, z: zz, rx: (r() - 0.5) * 0.08, rz: (r() - 0.5) * 0.08, ry: (r() - 0.5) * 0.06, color: pick(['#bdb6a8', '#b3ab9c', '#c6bfb1', '#a9a192']) });
        }
      }
    }
    // weeds through the cracks
    const weeds = [];
    for (let i = 0; i < 40; i++) {
      const z = r() < 0.5 ? ZONES.farWalk : ZONES.nearWalk;
      weeds.push({ x: z.x0 + r() * (z.x1 - z.x0), y: 0.1, z: z.z0 + r() * (z.z1 - z.z0), ry: r() * 6, sy: 0.6 + r() * 0.6, color: pick(['#7e9a3a', '#93a842', '#6f8a33']) });
    }
    g.add(instanced(geo('weed', () => new THREE.ConeGeometry(0.05, 0.22, 4).translate(0, 0.11, 0)), mat('#ffffff'), weeds));
  }
  for (const z of walkRects()) {
    box(g, z.x1 - z.x0, 0.06, z.z1 - z.z0, base, { x: (z.x0 + z.x1) / 2, y: 0.02, z: (z.z0 + z.z1) / 2, cast: false }, 0.02);
  }
  g.add(instanced(geom, mat('#ffffff'), tiles));
  return g;
}

function buildRoad(fresh) {
  const g = new THREE.Group();
  const { z0, z1 } = ZONES.road;
  const asphalt = fresh ? '#4f5462' : '#6f727a';
  box(g, 40, 0.04, z1 - z0, asphalt, { x: 0, y: -0.02, z: (z0 + z1) / 2, cast: false }, 0.01);
  const zm = (z0 + z1) / 2;
  const r = mulberry(9);
  for (let x = -19; x < 19; x += 1.3) {
    if (!fresh && r() < 0.35) continue;
    box(g, 0.7, 0.012, 0.12, fresh ? '#fbf8ee' : '#d8d2b6', { x, y: 0.02, z: zm, cast: false }, 0.005);
  }
  if (fresh) {
    for (let i = 0; i < 6; i++) box(g, 0.18, 0.012, z1 - z0 - 0.4, '#fbf8ee', { x: -1.35 - 0.75 + i * 0.3, y: 0.02, z: zm, cast: false }, 0.005);
  } else {
    for (let i = 0; i < 9; i++) {
      box(g, 0.6 + r() * 1.2, 0.01, 0.4 + r() * 0.6, '#62656d', { x: -6 + r() * 12, y: 0.015, z: z0 + 0.4 + r() * (z1 - z0 - 0.8), ry: r(), cast: false }, 0.01);
    }
    for (const [px, pz, s] of [[-2.2, -2.0, 1], [3.4, -3.1, 0.8], [5.4, -1.9, 0.7], [-4.8, -3.3, 0.9]]) {
      const pot = add(g, geo('pot', () => new THREE.CylinderGeometry(0.28, 0.28, 0.03, 18)), mat('#4b4d54'), { x: px, y: 0.01, z: pz, cast: false });
      pot.scale.set(s * 1.3, 1, s * 0.8);
    }
  }
  return g;
}

function buildLamp(parent, x, z, side) {
  const g = group(parent, x, 0.12, z);
  const pole = group(g);
  box(pole, 0.22, 0.12, 0.22, '#2f4a45', { y: 0 }, 0.04);
  cyl(pole, 0.045, 0.06, 1.85, '#35554f', { y: 0.1 }, 10);
  box(pole, 0.12, 0.08, 0.42, '#35554f', { y: 1.85, z: 0.15 * -side }, 0.03);
  const head = group(pole, 0, 1.68, 0.32 * -side);
  box(head, 0.26, 0.06, 0.26, '#2f4a45', { y: 0.2 }, 0.02);
  const lit = add(head, rbox(0.2, 0.22, 0.2, 0.04), glow('#ffe7a3', 1.3), { y: -0.02 });
  const dark = add(head, rbox(0.2, 0.22, 0.2, 0.04), mat('#5d6266'), { y: -0.02 });
  const halo = makeGlowSprite(1.9, 0.85);
  halo.position.set(0, 0.08, 0);
  head.add(halo);
  return { g, pole, lit, dark, halo, side };
}

function deadTree(parent, x, z) {
  const g = group(parent, x, 0.05, z);
  cyl(g, 0.07, 0.11, 1.1, '#7b6450', {}, 8);
  for (const [a, h, l] of [[0.7, 0.8, 0.5], [-0.8, 0.95, 0.45], [2.4, 0.65, 0.4]]) {
    const b = cyl(g, 0.025, 0.04, l, '#7b6450', { y: h }, 6);
    b.rotation.set(0.6 * Math.cos(a), 0, 0.6 * Math.sin(a));
  }
  return g;
}

function lushTree(parent, x, z, scale = 1) {
  const g = group(parent, x, 0.05, z);
  cyl(g, 0.08 * scale, 0.12 * scale, 1.0 * scale, '#8a6747', {}, 8);
  sphere(g, 0.55 * scale, '#4fae4a', { y: 1.35 * scale });
  sphere(g, 0.4 * scale, '#62c257', { x: -0.3 * scale, y: 1.15 * scale, z: 0.2 * scale });
  sphere(g, 0.38 * scale, '#43a043', { x: 0.32 * scale, y: 1.2 * scale, z: -0.1 * scale });
  sphere(g, 0.18 * scale, '#7fd06e', { x: -0.18 * scale, y: 1.62 * scale, z: 0.3 * scale });
  return g;
}

export class Street {
  constructor(scene) {
    this.root = group(scene);
    this.tapTargets = [];
    this.trash = [];
    this.time = 0;
    this.buildBase();
    this.paving = buildPaving('cracked');
    this.root.add(this.paving);
    this.road = buildRoad(false);
    this.root.add(this.road);
    this.lamps = LAMPS.map(([x, z, side]) => buildLamp(this.root, x, z, side));
    this.setLights(false);
    this.buildPark();
    this.buildTrash();
  }

  buildBase() {
    const R = this.root;
    // surrounding land
    box(R, 60, 0.1, 60, '#a9c56e', { x: 0, y: -0.12, z: 0, cast: false }, 0.02);
    // behind the buildings
    box(R, 40, 0.06, 6, '#9fc46a', { x: 0, y: -0.06, z: -11.5, cast: false }, 0.02);
    const r = mulberry(21);
    for (let i = 0; i < 26; i++) {
      const x = -16 + i * 1.3 + (r() - 0.5) * 0.6, z = -10.2 - r() * 2.4, s = 0.75 + r() * 0.5;
      const t = group(R, x, 0, z);
      cyl(t, 0.08 * s, 0.11 * s, 0.9 * s, '#8a6e55', {}, 6);
      sphere(t, 0.7 * s, r() < 0.5 ? '#6fbf5a' : '#82cc66', { y: 1.4 * s }, 1, 1.1, 1);
    }
    for (const [x, z, s, c] of [[-8, -17, 6, '#b9dca8'], [2, -18.5, 7, '#c4e2b4'], [11, -16, 5.5, '#b2d79e']]) {
      sphere(R, 1, c, { x, y: -2.2, z }, s, s * 0.42, s * 0.5).castShadow = false;
    }
    // curbs
    for (const z of [ZONES.road.z0, ZONES.road.z1]) box(R, 40, 0.16, 0.16, '#c9c3b6', { x: 0, y: 0, z, cast: false }, 0.04);
    // park ground: dry, patchy grass
    const P = ZONES.park;
    box(R, P.x1 - P.x0 + 0.2, 0.06, P.z1 - P.z0, '#b2ab6d', { x: 0, y: -0.02, z: (P.z0 + P.z1) / 2, cast: false }, 0.03);
    for (let i = 0; i < 26; i++) {
      add(R, geo('patch', () => new THREE.CylinderGeometry(0.4, 0.4, 0.02, 14)), mat(r() < 0.5 ? '#a8936a' : '#9fa564'), { x: P.x0 + r() * (P.x1 - P.x0), y: 0.03, z: P.z0 + r() * (P.z1 - P.z0), cast: false }).scale.set(0.6 + r() * 1.2, 1, 0.5 + r() * 0.8);
    }
    // lawn bed edge
    const L = ZONES.lawn;
    box(R, L.x1 - L.x0 + 0.3, 0.05, L.z1 - L.z0 + 0.3, '#8a7a55', { x: 0, y: 0, z: (L.z0 + L.z1) / 2, cast: false }, 0.05);
    // low hedge-wall around the park front + sides
    this.fence = group(R);
    for (let x = -6.4; x <= 6.41; x += 0.8) {
      cyl(this.fence, 0.05, 0.05, 0.5, '#8f7c66', { x, y: 0, z: P.z1 - 0.1 }, 6);
    }
    box(this.fence, 13, 0.07, 0.06, '#8f7c66', { x: 0, y: 0.38, z: P.z1 - 0.1 }, 0.02);
    box(this.fence, 13, 0.07, 0.06, '#8f7c66', { x: 0, y: 0.16, z: P.z1 - 0.1, rz: 0.02 }, 0.02);
  }

  buildPark() {
    const R = this.root;
    this.beds = BEDS.map((b, i) => {
      const g = group(R, b.x, 0, b.z);
      box(g, b.w, 0.14, b.d, '#a58c6a', { y: 0 }, 0.06);
      box(g, b.w - 0.16, 0.06, b.d - 0.16, '#7b5f45', { y: 0.1 }, 0.04);
      const dead = group(g);
      deadTree(dead, 0, 0);
      const r = mulberry(40 + i);
      for (let k = 0; k < 7; k++) {
        cyl(dead, 0.012, 0.02, 0.3, '#8b7b62', { x: (r() - 0.5) * (b.w - 0.5), y: 0.14, z: (r() - 0.5) * (b.d - 0.5), rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6 }, 4);
      }
      const lush = group(g);
      lush.visible = false;
      lushTree(lush, 0, -0.1, 0.95);
      return { g, dead, lush, b };
    });
    // broken bench
    const bench = group(R, 0, 0.04, 6.35);
    for (const x of [-0.55, 0.55]) box(bench, 0.08, 0.32, 0.36, '#4d5552', { x, y: 0 }, 0.02);
    box(bench, 1.3, 0.05, 0.12, '#a97c52', { y: 0.3, z: 0.1 }, 0.02);
    box(bench, 0.6, 0.05, 0.12, '#a97c52', { x: -0.33, y: 0.3, z: -0.08, rz: 0.12 }, 0.02);
    this.bench = bench;
  }

  buildTrash() {
    const r = mulberry(77);
    TRASH.forEach(([x, z], i) => {
      const g = group(this.root, x, 0.05, z);
      sphere(g, 0.2, '#3f4a45', { y: 0.16 }, 1, 0.85, 1);
      sphere(g, 0.16, '#55625a', { x: 0.22, y: 0.13, z: 0.08 }, 1, 0.9, 1);
      sphere(g, 0.12, '#2f3532', { x: -0.16, y: 0.1, z: 0.14 }, 1, 0.9, 1);
      cyl(g, 0.05, 0.05, 0.12, '#c94f3f', { x: 0.08, y: 0, z: 0.26, rz: Math.PI / 2 }, 10);
      box(g, 0.16, 0.12, 0.12, '#d8c49a', { x: -0.22, y: 0, z: -0.12, ry: r() }, 0.02);
      g.rotation.y = r() * 6;
      g.userData.tap = { type: 'trash', id: i };
      // generous invisible hit area
      const hit = new THREE.Mesh(geo('trashHit', () => new THREE.CylinderGeometry(0.5, 0.5, 0.6, 8)), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.3;
      g.add(hit);
      this.trash.push(g);
      this.tapTargets.push(g);
    });
  }

  clearTrash(id) {
    const g = this.trash[id];
    if (!g) return null;
    g.visible = false;
    return g.position.clone();
  }

  setPaving(type) {
    this.root.remove(this.paving);
    this.paving = buildPaving(type || 'cracked');
    this.root.add(this.paving);
  }

  setRoad(fresh) {
    this.root.remove(this.road);
    this.road = buildRoad(fresh);
    this.root.add(this.road);
  }

  setLights(on) {
    this.lightsOn = on;
    for (const l of this.lamps) {
      l.lit.visible = on;
      l.halo.visible = on;
      l.dark.visible = !on;
      l.pole.rotation.z = on ? 0 : 0.16 * (l.side > 0 ? 1 : -1);
      l.pole.rotation.x = on ? 0 : 0.05;
    }
  }

  setLandscaping(color) {
    for (const bed of this.beds) {
      bed.dead.visible = !color;
      bed.lush.visible = !!color;
      if (bed.flowers) { bed.lush.remove(bed.flowers); bed.flowers = null; }
      if (color) {
        const r = mulberry(5 + bed.b.x * 3);
        const items = [];
        for (let k = 0; k < 34; k++) {
          const x = (r() - 0.5) * (bed.b.w - 0.35), z = (r() - 0.5) * (bed.b.d - 0.35);
          if (Math.hypot(x, z + 0.1) < 0.35) continue;
          items.push({ x, y: 0.2 + r() * 0.05, z, color, sx: 1, sy: 1, sz: 1 });
        }
        const leaves = items.map((it) => ({ ...it, y: 0.14, color: '#4f9e3e', sx: 1.5, sy: 0.8, sz: 1.5 }));
        const f = new THREE.Group();
        f.add(instanced(geo('leafball', () => new THREE.SphereGeometry(0.09, 10, 8)), mat('#ffffff'), leaves));
        f.add(instanced(geo('flower', () => new THREE.SphereGeometry(0.075, 10, 8)), mat('#ffffff'), items));
        bed.lush.add(f);
        bed.flowers = f;
      }
    }
    // the bench gets fixed with the landscaping
    this.bench.children.forEach((c, i) => { if (i === 3) { c.rotation.z = color ? 0 : 0.12; c.position.x = color ? 0 : -0.33; c.scale.x = color ? 2.15 : 1; } });
  }

  update(dt) {
    this.time += dt;
    if (this.lightsOn) for (const l of this.lamps) l.halo.material.opacity = 0.75 + Math.sin(this.time * 2 + l.g.position.x) * 0.08;
  }
}
