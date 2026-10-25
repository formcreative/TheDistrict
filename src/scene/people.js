import * as THREE from 'three';
import { rbox, mat, add, box, sphere, cyl, group, geo } from './kit.js';

// Tiny, round, toy-like pedestrians.

const SHIRTS = ['#ff7a59', '#4fb3ff', '#ffc93c', '#9b6bff', '#3fcf8e', '#ff5d8f', '#ffffff', '#2fb5a8'];
const PANTS = ['#3b3f5c', '#2f5d8a', '#6b4a3a', '#444a52'];
const SKINS = ['#f6d1b1', '#e8b48a', '#c98a5e', '#8f5a3a', '#f3c39b'];
const HAIR = ['#3a2a20', '#6b4226', '#1f1b24', '#d39a3e', '#8c3b2a', '#e8e1d6'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Person {
  constructor(parent, opts = {}) {
    this.root = group(parent);
    const g = (this.body = group(this.root));
    const shirt = opts.shirt || pick(SHIRTS);
    this.legL = box(g, 0.08, 0.2, 0.09, pick(PANTS), { x: -0.06, y: 0 }, 0.035);
    this.legR = box(g, 0.08, 0.2, 0.09, this.legL.material, { x: 0.06, y: 0 }, 0.035);
    box(g, 0.26, 0.26, 0.2, shirt, { y: 0.17 }, 0.09);
    if (opts.apron) box(g, 0.2, 0.2, 0.03, '#fff6e8', { y: 0.18, z: 0.1 }, 0.01);
    this.armL = box(g, 0.06, 0.18, 0.07, shirt, { x: -0.16, y: 0.2 }, 0.03);
    this.armR = box(g, 0.06, 0.18, 0.07, shirt, { x: 0.16, y: 0.2 }, 0.03);
    const skin = pick(SKINS);
    this.head = sphere(g, 0.15, skin, { y: 0.55 });
    const hair = pick(HAIR);
    const cap = add(g, geo('hair', () => new THREE.SphereGeometry(0.158, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), mat(hair), { y: 0.56, center: true });
    cap.rotation.x = -0.25;
    if (Math.random() < 0.35) sphere(g, 0.07, hair, { y: 0.56, z: -0.15 });
    for (const x of [-0.05, 0.05]) sphere(g, 0.02, '#2b2f45', { x, y: 0.56, z: 0.135 });
    for (const x of [-0.085, 0.085]) sphere(g, 0.025, '#ff9a9a', { x, y: 0.51, z: 0.12 }, 1, 0.6, 0.4);
    this.cup = group(g, 0.18, 0.22, 0.1);
    cyl(this.cup, 0.045, 0.035, 0.1, '#ffffff', {}, 10);
    cyl(this.cup, 0.047, 0.047, 0.03, '#ff6a4a', { y: 0.035 }, 10);
    this.cup.visible = false;
    this.shadow = add(this.root, geo('pshadow', () => new THREE.CircleGeometry(0.2, 16).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color: '#1e2433', transparent: true, opacity: 0.18, depthWrite: false }), { y: 0.005, center: true, cast: false, receive: false });
    this.root.scale.setScalar(opts.scale || 0.95 + Math.random() * 0.12);
    this.walkT = Math.random() * 6;
    this.speed = opts.speed || 0.9 + Math.random() * 0.25;
    this.path = [];
    this.moving = false;
    this.fade = 1;
  }

  get pos() { return this.root.position; }

  place(x, y, z) { this.root.position.set(x, y, z); return this; }

  goTo(points) { this.path = points.map((p) => p.clone()); this.moving = this.path.length > 0; }

  face(x, z) {
    this.targetYaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  update(dt) {
    if (this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d > 0.001) this.targetYaw = Math.atan2(dx, dz);
      if (d <= step) { this.pos.x = t.x; this.pos.z = t.z; this.path.shift(); }
      else { this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; }
      this.moving = this.path.length > 0;
    }
    if (this.targetYaw !== undefined) {
      let a = this.targetYaw - this.root.rotation.y;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      this.root.rotation.y += a * Math.min(1, dt * 10);
    }
    if (this.moving) {
      this.walkT += dt * 11 * this.speed;
      const s = Math.sin(this.walkT);
      this.legL.rotation.x = s * 0.6;
      this.legR.rotation.x = -s * 0.6;
      this.armL.rotation.x = -s * 0.5;
      this.armR.rotation.x = this.cup.visible ? -0.9 : s * 0.5;
      this.body.position.y = Math.abs(Math.cos(this.walkT)) * 0.035;
    } else {
      this.legL.rotation.x = this.legR.rotation.x = 0;
      this.armL.rotation.x = 0;
      this.armR.rotation.x = this.cup.visible ? -0.9 : 0;
      this.body.position.y = 0;
    }
  }

  setFade(f) {
    this.fade = f;
    this.root.scale.setScalar(Math.max(0.0001, f) * (this.baseScale || (this.baseScale = this.root.scale.x)));
  }

  dispose() { this.root.removeFromParent(); }

  headWorld() {
    const v = new THREE.Vector3();
    this.head.getWorldPosition(v);
    return v;
  }
}

// Ambient walkers that stroll the sidewalks so the street feels alive.
export class Walkers {
  constructor(parent) {
    this.parent = parent;
    this.list = [];
    this.target = 1;
  }

  setCount(n) { this.target = n; }

  spawn() {
    const near = Math.random() < 0.55;
    const z = near ? -0.55 + (Math.random() - 0.5) * 0.5 : -4.25 + (Math.random() - 0.5) * 0.2;
    const fromLeft = Math.random() < 0.5;
    const x0 = fromLeft ? -9 : 9, x1 = -x0;
    const p = new Person(this.parent).place(x0, 0.12, z);
    p.goTo([new THREE.Vector3(x1, 0.12, z)]);
    this.list.push(p);
  }

  update(dt) {
    if (this.list.length < this.target && Math.random() < dt * 0.6) this.spawn();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.update(dt);
      if (!p.moving) { p.dispose(); this.list.splice(i, 1); }
    }
  }
}
