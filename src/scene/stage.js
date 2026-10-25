import * as THREE from 'three';

// Renderer, elevated three-quarter camera, lighting, and screen <-> world helpers.

// The whole street, and close-ups around a single shop front (two zoom levels).
const STREET_VIEW = { box: new THREE.Box3(new THREE.Vector3(-4.1, 0, -8.0), new THREE.Vector3(4.1, 3.2, 7.3)) };
export function shopView(x, level) {
  const half = level >= 2 ? 1.25 : 1.85;
  const box = level >= 2
    ? new THREE.Box3(new THREE.Vector3(x - half, 0, -5.8), new THREE.Vector3(x + half, 1.9, -3.5))
    : new THREE.Box3(new THREE.Vector3(x - half, 0, -7.2), new THREE.Vector3(x + half, 3.0, -3.3));
  return { box, center: true };
}
export { STREET_VIEW };
// How far a zoomed-in player can drag: the whole street plus the boutique lot and the park fence.
const PAN_BOX = new THREE.Box3(new THREE.Vector3(-5.2, 0, -8.6), new THREE.Vector3(6.8, 3.2, 7.6));
const PITCH = THREE.MathUtils.degToRad(46);
const YAW = THREE.MathUtils.degToRad(-6);
const TARGET = new THREE.Vector3(0, 0, -1);

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const dir = new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH));
    this.camera.position.copy(TARGET).addScaledVector(dir, 60);
    this.camera.lookAt(TARGET);

    const hemi = new THREE.HemisphereLight(0xcfeaff, 0xc9b27a, 1.7);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe9c4, 2.6);
    sun.position.set(-7, 14, 9);
    sun.target.position.set(0, 0, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.uiBottom = 0;
    this.uiTop = 0;
    this.resize();
  }

  // bottomPx / topPx: screen space reserved for HUD so content isn't covered.
  resize(topPx = this.uiTop, bottomPx = this.uiBottom) {
    this.uiTop = topPx;
    this.uiBottom = bottomPx;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.goal = this.fit(this.focus || STREET_VIEW);
    this.frame = { ...this.goal };
    this.apply();
  }

  // Frustum that fits `view.box` into the space between the HUD bars.
  fit(view) {
    const box = view.box;
    const { width: w, height: h, uiTop: topPx, uiBottom: bottomPx } = this;
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const usableH = Math.max(100, h - topPx - bottomPx);
    const aspect = w / usableH;
    let cw = maxX - minX, ch = maxY - minY;
    if (cw / ch > aspect) ch = cw / aspect; else cw = ch * aspect;
    const upp = ch / usableH;
    const cx = (minX + maxX) / 2;
    // street view sits on the bottom bar (extra space becomes sky); close-ups are centred
    const slack = ch - (maxY - minY);
    const bottom = minY - slack * (view.center ? 0.5 : 0.12) - bottomPx * upp;
    return { left: cx - (w * upp) / 2, right: cx + (w * upp) / 2, bottom, top: bottom + h * upp };
  }

  setFocus(view, instant = false) {
    this.focus = view;
    this.fling = null;
    this.goal = this.fit(view);
    if (instant || !this.frame) this.frame = { ...this.goal };
  }

  // Drag the zoomed-in camera around the street. dx/dy are screen pixels.
  panBy(dxPx, dyPx) {
    if (!this.goal) return;
    const u = (this.goal.top - this.goal.bottom) / this.height;
    const sx = -dxPx * u, sy = dyPx * u;
    for (const f of [this.goal, this.frame]) { f.left += sx; f.right += sx; f.top += sy; f.bottom += sy; }
    this.clampPan();
    this.apply();
  }

  clampPan() {
    const b = this.panBounds || (this.panBounds = this.projectBox(PAN_BOX));
    const g = this.goal, w = g.right - g.left, h = g.top - g.bottom;
    let dx = 0, dy = 0;
    if (w >= b.maxX - b.minX) dx = (b.minX + b.maxX) / 2 - (g.left + g.right) / 2;
    else if (g.left < b.minX) dx = b.minX - g.left;
    else if (g.right > b.maxX) dx = b.maxX - g.right;
    if (h >= b.maxY - b.minY) dy = (b.minY + b.maxY) / 2 - (g.top + g.bottom) / 2;
    else if (g.bottom < b.minY) dy = b.minY - g.bottom;
    else if (g.top > b.maxY) dy = b.maxY - g.top;
    for (const f of [this.goal, this.frame]) { f.left += dx; f.right += dx; f.top += dy; f.bottom += dy; }
  }

  projectBox(box) {
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    return { minX, maxX, minY, maxY };
  }

  // Centre of the view, as a point on the ground.
  viewCenterGround() {
    const r = this.canvas.getBoundingClientRect();
    return this.groundPoint(r.left + r.width / 2, r.top + (this.uiTop + r.height - this.uiBottom) / 2);
  }

  update(dt) {
    if (!this.goal) return;
    if (this.fling && !this.dragging) {
      this.panBy(this.fling.x * dt, this.fling.y * dt);
      const k = Math.exp(-dt * 5);
      this.fling.x *= k; this.fling.y *= k;
      if (Math.hypot(this.fling.x, this.fling.y) < 20) this.fling = null;
    }
    const k = 1 - Math.exp(-dt * 7);
    let moving = false;
    for (const key of ['left', 'right', 'top', 'bottom']) {
      const d = this.goal[key] - this.frame[key];
      if (Math.abs(d) > 1e-4) { this.frame[key] += d * k; moving = true; }
    }
    if (moving) this.apply();
  }

  apply() {
    Object.assign(this.camera, this.frame);
    this.camera.updateProjectionMatrix();
    this.unitsPerPx = (this.frame.top - this.frame.bottom) / this.height;
  }

  toScreen(v3, out = { x: 0, y: 0 }) {
    const p = v3.clone().project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * this.width;
    out.y = (-p.y * 0.5 + 0.5) * this.height;
    return out;
  }

  ndc(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  groundPoint(clientX, clientY) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, hit) ? hit : null;
  }

  pick(clientX, clientY, objects) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.tap) o = o.parent;
      if (o && o.visible !== false) return o;
    }
    return null;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
