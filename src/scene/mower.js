import * as THREE from 'three';
import { box, cyl, group, sphere } from './kit.js';

// Push mower that follows the player's finger while swiping across the lawn.
export class Mower {
  constructor(scene) {
    this.root = group(scene);
    const g = (this.body = group(this.root));
    box(g, 0.5, 0.2, 0.44, '#e8473a', { y: 0.1 }, 0.08);
    box(g, 0.36, 0.08, 0.3, '#ff6a5c', { y: 0.3 }, 0.04);
    cyl(g, 0.08, 0.1, 0.1, '#3b3f48', { y: 0.34 }, 12);
    for (const [x, z] of [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.18], [0.24, 0.18]]) {
      const w = cyl(g, 0.08, 0.08, 0.06, '#2b2f38', { x, y: 0.02, z, rz: Math.PI / 2 }, 14);
      w.rotation.set(0, 0, Math.PI / 2);
    }
    const h = group(g, 0, 0.3, -0.2);
    for (const x of [-0.16, 0.16]) cyl(h, 0.02, 0.02, 0.6, '#d9dde2', { x, y: 0, rx: -0.6 }, 6);
    cyl(h, 0.025, 0.025, 0.38, '#2b2f38', { y: 0.5, z: -0.34, rz: Math.PI / 2 }, 8).rotation.set(0, 0, Math.PI / 2);
    sphere(g, 0.03, '#ffe066', { x: 0.12, y: 0.36, z: 0.1 });
    this.root.scale.setScalar(1.15);
    this.root.visible = false;
    this.target = new THREE.Vector3();
    this.active = false;
    this.t = 0;
    this.show = 0;
  }

  start(p) {
    this.active = true;
    this.root.position.set(p.x, 0.05, p.z);
    this.target.copy(p);
  }

  moveTo(p) { this.target.copy(p); }
  stop() { this.active = false; }

  update(dt) {
    this.t += dt;
    this.show += ((this.active ? 1 : 0) - this.show) * Math.min(1, dt * 14);
    this.root.visible = this.show > 0.02;
    if (!this.root.visible) return;
    const p = this.root.position;
    const dx = this.target.x - p.x, dz = this.target.z - p.z;
    if (Math.hypot(dx, dz) > 0.02) {
      const yaw = Math.atan2(dx, dz) + Math.PI;
      let a = yaw - this.root.rotation.y;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      this.root.rotation.y += a * Math.min(1, dt * 16);
    }
    p.x += dx * Math.min(1, dt * 22);
    p.z += dz * Math.min(1, dt * 22);
    this.body.position.y = Math.abs(Math.sin(this.t * 40)) * 0.012;
    this.root.scale.setScalar(1.15 * this.show);
  }
}
