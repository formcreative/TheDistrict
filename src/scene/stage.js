import * as THREE from 'three';

// Renderer, elevated three-quarter camera, lighting, and screen <-> world helpers.

// The part of the world that must always be on screen.
const CONTENT = new THREE.Box3(new THREE.Vector3(-4.1, 0, -8.0), new THREE.Vector3(4.1, 3.2, 7.3));
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

    const hemi = new THREE.HemisphereLight(0xdff1ff, 0xb9a98a, 1.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
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

    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? CONTENT.max.x : CONTENT.min.x, i & 2 ? CONTENT.max.y : CONTENT.min.y, i & 4 ? CONTENT.max.z : CONTENT.min.z).applyMatrix4(inv);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const usableH = Math.max(100, h - topPx - bottomPx);
    const aspect = w / usableH;
    let cw = maxX - minX, ch = maxY - minY;
    if (cw / ch > aspect) ch = cw / aspect; else cw = ch * aspect;
    const unitsPerPx = ch / usableH;
    const cx = (minX + maxX) / 2;
    // anchor content to the bottom of the usable area; extra space becomes sky
    const bottom = minY - (ch - (maxY - minY)) * 0.12 - bottomPx * unitsPerPx;
    const top = bottom + h * unitsPerPx;
    Object.assign(this.camera, { left: cx - (w * unitsPerPx) / 2, right: cx + (w * unitsPerPx) / 2, top, bottom });
    this.camera.updateProjectionMatrix();
    this.unitsPerPx = unitsPerPx;
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
