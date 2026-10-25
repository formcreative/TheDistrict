import * as THREE from 'three';
import { mat, geo, rbox } from './kit.js';

// 3D particles: grass clippings, dust puffs, confetti, sparkles, and coins that pop out of the ground.

const CONFETTI = ['#ff6a4d', '#ffd23f', '#4fc3f7', '#7be35a', '#ff8fd0', '#ffffff'];

export class FX3D {
  constructor(scene, stage) {
    this.scene = scene;
    this.stage = stage;
    this.parts = [];
    this.coins = [];
    this.coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.045, 20).rotateX(Math.PI / 2);
    this.coinMat = new THREE.MeshLambertMaterial({ color: '#ffc12b', emissive: '#ff9d00', emissiveIntensity: 0.25 });
    this.coinRim = new THREE.MeshLambertMaterial({ color: '#e59a12' });
    this.dustMat = new THREE.MeshLambertMaterial({ color: '#fffaf0', emissive: '#ffffff', emissiveIntensity: 0.25 });
  }

  spawn(geometry, material, x, y, z, vx, vy, vz, life, opts = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    m.scale.setScalar(opts.scale || 1);
    this.scene.add(m);
    this.parts.push({ m, vx, vy, vz, life: 0, max: life, g: opts.g ?? 9, spin: opts.spin ?? 8, grow: opts.grow || 0, s0: opts.scale || 1, drag: opts.drag || 0, floor: opts.floor ?? 0.06 });
  }

  clippings(x, z, colors) {
    const g = geo('clip', () => new THREE.BoxGeometry(0.05, 0.14, 0.02));
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.8 + Math.random() * 1.6;
      this.spawn(g, mat(colors[i % colors.length]), x, 0.25, z, Math.cos(a) * s, 2 + Math.random() * 2.2, Math.sin(a) * s, 0.55 + Math.random() * 0.3);
    }
  }

  dust(x, y, z, n = 14, spread = 1) {
    const g = geo('dust', () => new THREE.IcosahedronGeometry(0.22, 1));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.spawn(g, this.dustMat, x + Math.cos(a) * r, y + Math.random() * 0.6, z + Math.sin(a) * r * 0.6, Math.cos(a) * 1.5, 0.6 + Math.random(), Math.sin(a) * 1.2, 0.7 + Math.random() * 0.5, { g: -0.5, spin: 1, grow: 1.6, scale: 0.6 + Math.random() * 0.8, drag: 2, floor: -99 });
    }
  }

  confetti(x, y, z, n = 70) {
    const g = geo('conf', () => new THREE.BoxGeometry(0.1, 0.02, 0.06));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3;
      this.spawn(g, mat(CONFETTI[i % CONFETTI.length], { emissive: CONFETTI[i % CONFETTI.length], emissiveIntensity: 0.2 }), x, y, z, Math.cos(a) * s, 4 + Math.random() * 4, Math.sin(a) * s * 0.7, 2 + Math.random(), { g: 5, spin: 10, drag: 1.2, floor: 0.1 });
    }
  }

  sparkle(x, y, z, n = 8, spread = 0.6) {
    const g = geo('spark', () => new THREE.OctahedronGeometry(0.06, 0));
    const m = mat('#fff4a8', { emissive: '#ffe066', emissiveIntensity: 1 });
    for (let i = 0; i < n; i++) {
      this.spawn(g, m, x + (Math.random() - 0.5) * spread, y + Math.random() * spread * 0.6, z + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 0.6, 0.8 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.4, { g: 0, spin: 6, floor: -99 });
    }
  }

  // A coin bursts out of the ground, bounces, then `onFly(screenXY, value)` takes over in the DOM.
  coin(x, y, z, value, onFly, delay = 0) {
    const m = new THREE.Group();
    const face = new THREE.Mesh(this.coinGeo, [this.coinRim, this.coinMat, this.coinMat]);
    face.castShadow = true;
    m.add(face);
    m.position.set(x, y, z);
    m.visible = delay <= 0;
    this.scene.add(m);
    const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 0.8;
    this.coins.push({ m, vx: Math.cos(a) * s, vy: 4.2 + Math.random() * 1.6, vz: Math.sin(a) * s * 0.6, t: -delay, hold: 0.5 + Math.random() * 0.15, value, onFly, bounces: 0, y0: y });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) { p.m.removeFromParent(); this.parts.splice(i, 1); continue; }
      if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vz *= f; if (p.g < 0) p.vy *= f; }
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      if (p.m.position.y < p.floor) { p.m.position.y = p.floor; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; p.spin *= 0.8; }
      p.m.rotation.x += p.spin * dt;
      p.m.rotation.y += p.spin * 0.7 * dt;
      const s = p.grow ? p.s0 * (1 + p.grow * k) * (1 - k * k) : p.s0 * (k > 0.7 ? (1 - k) / 0.3 : 1);
      p.m.scale.setScalar(Math.max(0.0001, s));
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt;
      if (c.t < 0) continue;
      c.m.visible = true;
      c.vy -= 16 * dt;
      c.m.position.x += c.vx * dt;
      c.m.position.y += c.vy * dt;
      c.m.position.z += c.vz * dt;
      if (c.m.position.y < 0.2) {
        c.m.position.y = 0.2;
        if (c.bounces < 2) { c.vy = -c.vy * 0.35; c.bounces++; c.vx *= 0.5; c.vz *= 0.5; } else { c.vy = c.vx = c.vz = 0; }
      }
      c.m.rotation.y += dt * 10;
      if (c.t > c.hold) {
        c.onFly(this.stage.toScreen(c.m.position), c.value);
        c.m.removeFromParent();
        this.coins.splice(i, 1);
      }
    }
  }
}
