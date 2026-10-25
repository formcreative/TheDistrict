import * as THREE from 'three';
import { mulberry, easeOutBack } from './kit.js';
import { ZONES } from './street.js';

// Instanced grass tufts on the park lawn. Overgrown weeds → cut → regrow as lush lawn.

const SPACING = 0.45;
const TALL = ['#7d9a35', '#8fa63c', '#a3ac45', '#b7b052'];
const LUSH = ['#43ad3d', '#52bd45', '#62c94d', '#4fb543'];

function tuftGeometry(seed, blades, minH, maxH) {
  const r = mulberry(seed);
  const pos = [], nor = [], col = [];
  const dark = new THREE.Color('#5d6e2a'), light = new THREE.Color('#ffffff');
  for (let i = 0; i < blades; i++) {
    const h = minH + r() * (maxH - minH);
    const c = new THREE.ConeGeometry(0.04, h, 3, 1).toNonIndexed();
    c.translate(0, h / 2, 0);
    c.rotateZ((r() - 0.5) * 0.7);
    c.rotateX((r() - 0.5) * 0.7);
    c.rotateY(r() * 6);
    c.translate((r() - 0.5) * 0.18, 0, (r() - 0.5) * 0.18);
    const p = c.attributes.position, n = c.attributes.normal;
    for (let k = 0; k < p.count; k++) {
      pos.push(p.getX(k), p.getY(k), p.getZ(k));
      nor.push(n.getX(k), n.getY(k), n.getZ(k));
      const t = Math.min(1, Math.max(0, p.getY(k) / maxH));
      const cc = dark.clone().lerp(light, 0.35 + 0.65 * t);
      col.push(cc.r, cc.g, cc.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export class Grass {
  constructor(scene) {
    const L = ZONES.lawn;
    const r = mulberry(11);
    this.tufts = [];
    const cols = Math.round((L.x1 - L.x0) / SPACING), rows = Math.round((L.z1 - L.z0) / SPACING);
    const cw = (L.x1 - L.x0) / cols, ch = (L.z1 - L.z0) / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        this.tufts.push({
          x: L.x0 + (i + 0.5) * cw + (r() - 0.5) * 0.1,
          z: L.z0 + (j + 0.5) * ch + (r() - 0.5) * 0.1,
          px: L.x0 + (i + 0.5) * cw, pz: L.z0 + (j + 0.5) * ch,
          stripe: i % 2, ry: r() * 6, phase: r() * 6.28, tint: Math.floor(r() * 4),
          weed: r() < 0.08, state: 'tall', grow: 1, growT: 0, lush: false, everCut: false, patch: 0, cutAt: 0,
        });
      }
    }
    const n = this.tufts.length;
    this.count = n;
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.tall = new THREE.InstancedMesh(tuftGeometry(5, 9, 0.3, 0.55), material, n);
    this.lush = new THREE.InstancedMesh(tuftGeometry(8, 8, 0.16, 0.26), material, n);
    this.flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#fff3f8', emissiveIntensity: 0.2 }), n);
    const pg = new THREE.CircleGeometry(cw * 0.72, 18).rotateX(-Math.PI / 2);
    this.patches = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: '#ffffff' }), n);
    this.patches.receiveShadow = true;
    for (const m of [this.tall, this.lush]) { m.castShadow = true; m.receiveShadow = true; }
    this.flowers.castShadow = true;
    this.cw = cw;
    const c = new THREE.Color();
    this.tufts.forEach((t, i) => {
      this.tall.setColorAt(i, c.set(TALL[t.tint]));
      this.lush.setColorAt(i, c.set(LUSH[t.tint]));
      this.patches.setColorAt(i, c.set(t.stripe ? '#7fcb55' : '#8ed663'));
    });
    this.group = new THREE.Group();
    this.group.add(this.patches, this.tall, this.lush, this.flowers);
    scene.add(this.group);
    this.o = new THREE.Object3D();
    this.time = 0;
    this.updateAll(0);
  }

  // Persisted as a string of 0/1: which tufts have been restored to lawn.
  serialize() { return this.tufts.map((t) => (t.everCut ? '1' : '0')).join(''); }

  restore(str) {
    if (!str || str.length !== this.tufts.length) return;
    this.tufts.forEach((t, i) => {
      if (str[i] === '1') { t.everCut = true; t.lush = true; t.patch = 1; t.weed = false; }
    });
  }

  remaining() { return this.tufts.filter((t) => !t.everCut).length; }

  // Cuts every standing tuft within `radius` of the segment a→b (world XZ).
  cutSegment(ax, az, bx, bz, radius, onCut) {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    for (const t of this.tufts) {
      if (t.state !== 'tall') continue;
      let k = L ? ((t.x - ax) * dx + (t.z - az) * dz) / L : 0;
      k = Math.max(0, Math.min(1, k));
      const d = Math.hypot(t.x - (ax + dx * k), t.z - (az + dz * k));
      if (d < radius) {
        const wasWeed = t.weed && !t.lush;
        t.state = 'cut';
        t.grow = 0;
        t.cutAt = this.time;
        t.everCut = true;
        t.weed = false;
        onCut(t, wasWeed);
      }
    }
  }

  update(dt, regrowSeconds) {
    this.time += dt;
    for (const t of this.tufts) {
      if (t.state === 'cut' && this.time - t.cutAt > regrowSeconds) { t.state = 'growing'; t.growT = 0; t.lush = true; }
      if (t.state === 'growing') {
        t.growT += dt;
        const k = Math.min(1, t.growT / 0.45);
        t.grow = easeOutBack(k);
        if (k >= 1) { t.state = 'tall'; t.grow = 1; }
      }
      if (t.everCut && t.patch < 1) t.patch = Math.min(1, t.patch + dt * 6);
    }
    this.updateAll(this.time);
  }

  updateAll(time) {
    const o = this.o;
    this.tufts.forEach((t, i) => {
      const sway = Math.sin(time * 1.7 + t.phase + t.x * 0.6) * 0.07;
      const g = t.grow;
      o.position.set(t.x, 0.04, t.z);
      o.rotation.set(sway, t.ry, sway * 0.6);
      o.scale.set(g || 0.0001, g || 0.0001, g || 0.0001);
      if (t.lush) {
        o.updateMatrix();
        this.lush.setMatrixAt(i, o.matrix);
        o.scale.setScalar(0.0001); o.updateMatrix();
        this.tall.setMatrixAt(i, o.matrix);
      } else {
        o.updateMatrix();
        this.tall.setMatrixAt(i, o.matrix);
        o.scale.setScalar(0.0001); o.updateMatrix();
        this.lush.setMatrixAt(i, o.matrix);
      }
      // weed flower on top
      if (t.weed && !t.lush && g > 0.5) {
        o.position.set(t.x + sway * 0.4, 0.04 + 0.55 * g, t.z);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(g);
      } else o.scale.setScalar(0.0001);
      o.updateMatrix();
      this.flowers.setMatrixAt(i, o.matrix);
      // mowed lawn patch
      o.position.set(t.px, 0.056 + t.stripe * 0.003, t.pz);
      o.rotation.set(0, 0, 0);
      const ps = t.everCut ? 0.6 + 0.4 * easeOutBack(t.patch) : 0.0001;
      o.scale.set(ps, 1, ps * 0.98);
      o.updateMatrix();
      this.patches.setMatrixAt(i, o.matrix);
    });
    for (const m of [this.tall, this.lush, this.flowers, this.patches]) m.instanceMatrix.needsUpdate = true;
  }
}

export { TALL, LUSH };
