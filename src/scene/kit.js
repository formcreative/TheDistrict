import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

// Shared geometry + material caches and small builders for the chunky, rounded look.

const geos = new Map();
const mats = new Map();

export function rbox(w, h, d, r = 0.05, seg = 2) {
  const key = `rb${w},${h},${d},${r},${seg}`;
  if (!geos.has(key)) geos.set(key, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999));
  return geos.get(key);
}

export function geo(key, make) {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
}

export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return mats.get(key);
}

export function glow(color, intensity = 1) {
  return mat(color, { emissive: color, emissiveIntensity: intensity });
}

// Adds a mesh to parent. `y` is the BOTTOM of the object unless center:true.
export function add(parent, geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, center = false, cast = true, receive = true, s = 1 } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (!center) {
    geometry.computeBoundingBox();
    y -= geometry.boundingBox.min.y * s;
  }
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s !== 1) m.scale.setScalar(s);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

export function box(parent, w, h, d, color, pos = {}, r = 0.05) {
  return add(parent, rbox(w, h, d, r), typeof color === 'string' ? mat(color) : color, pos);
}

export function sphere(parent, rad, color, pos = {}, sx = 1, sy = 1, sz = 1) {
  const m = add(parent, geo(`sph${rad}`, () => new THREE.SphereGeometry(rad, 16, 12)), typeof color === 'string' ? mat(color) : color, { ...pos, center: true });
  m.scale.set(sx, sy, sz);
  return m;
}

export function cyl(parent, rt, rb, h, color, pos = {}, seg = 16) {
  return add(parent, geo(`cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), typeof color === 'string' ? mat(color) : color, pos);
}

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// Text drawn to a canvas, used for shop signs.
export function signTexture(text, { bg = '#24625e', fg = '#fff1da', border = '#fff1da', w = 512, h = 160, size = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = border;
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(14, 14, w - 28, h - 28, 26);
  g.stroke();
  g.font = `${size}px "Lilita One", "Arial Rounded MT Bold", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.fillText(text, w / 2, h / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

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

export const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
