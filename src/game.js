import * as THREE from 'three';
import * as E from './economy.js';
import { audio } from './audio.js';
import { load, save, clear } from './save.js';
import { Stage, STREET_VIEW, shopView } from './scene/stage.js';
import { Street, ZONES } from './scene/street.js';
import { Building, framingBuildings, FACADE_Z, lotX } from './scene/buildings.js';
import { Grass, TALL, LUSH } from './scene/grass.js';
import { Person, Walkers } from './scene/people.js';
import { FX3D } from './scene/fx.js';
import { Mower } from './scene/mower.js';
import { group, sphere, cyl, box, geo } from './scene/kit.js';
import { UI, money, clock, icon } from './ui/ui.js';
import { ICONS } from './ui/icons.js';
import { purchase, purchaseMode } from './store.js';
import { worldMapSVG } from './ui/worldmap.js';
import { logoSVG } from './ui/logo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WALK_Z = -4.3;
const price$ = (n) => (n === 0 ? 'FREE' : money(n));

// Where timers and effects show for street projects that aren't buildings.
const PROJECT_SPOTS = {
  trash: V(0, 0.6, 3.2),
  sidewalk: V(0, 0.5, -0.5),
  landscaping: V(-3.55, 1.4, 3.6),
  streetlights: V(0, 2.5, -1.0),
  repave: V(0, 0.4, -2.6),
};

// Spots where litter can blow in (sidewalks and the park edges, never the lawn).
const LITTER_BANDS = [
  { x0: -4, x1: 4, z0: -5.3, z1: -4.6 },
  { x0: -4, x1: 4, z0: -0.9, z1: 0.0 },
  { x0: -4.2, x1: -2.9, z0: 0.6, z1: 6.6 },
  { x0: 2.9, x1: 4.2, z0: 0.6, z1: 6.6 },
  { x0: -2.4, x1: 2.4, z0: 5.6, z1: 6.8 },
];

export class Game {
  constructor(cfg, root, canvas, opts = {}) {
    this.base = cfg;
    this.opts = opts;
    this.root = root;
    this.stage = new Stage(canvas, { ...cfg.camera, ...opts.camera });
    this.keep = new Set(this.stage.scene.children); // lights survive a street change
    this.ui = new UI(root);

    const saved = load();
    this.g = saved && saved.v === 3 ? Object.assign(E.createGlobal(cfg), saved) : E.createGlobal(cfg);
    if (!E.allStreets(cfg).some((s) => s.id === this.g.currentStreet)) this.g.currentStreet = E.allStreets(cfg)[0].id;
    this.g.streets[this.g.currentStreet] ||= E.createStreet();

    this.streak = 0;
    this.lastCoin = 0;
    this.time = 0;
    this.timeScale = 1;
    this.pointers = new Map();
    this.pointer = null;
    this.saveT = 0;
    this.cutsThisSession = 0;
    this.grassBank = 0;
    this.lastTap = { t: 0, shop: null };

    this.bindInput(canvas);
    this.bindHud();
    this.buildWorld(this.g.currentStreet);
    this.layout();
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(); });
    window.addEventListener('pagehide', () => this.persist());
    E.log(this.g, 'session_start', { street: this.streetId });
    this.openHome(true);
  }

  // The save for the street on screen.
  get s() { return this.g.streets[this.streetId]; }

  // ---------- world (rebuilt whenever the player travels) ----------
  buildWorld(streetId) {
    const scene = this.stage.scene;
    for (const c of [...scene.children]) if (!this.keep.has(c)) scene.remove(c);
    this.streetId = streetId;
    this.g.currentStreet = streetId;
    this.g.streets[streetId] ||= E.createStreet();
    this.cfg = E.streetConfig(this.base, streetId);
    const st = this.cfg.street;

    this.street = new Street(scene, st.theme || 'traditional');
    framingBuildings(scene);
    this.buildings = {};
    st.lots.forEach((id, i) => { this.buildings[id] = new Building(scene, id, lotX(i)); });
    this.grass = new Grass(scene);
    this.fx = new FX3D(scene, this.stage);
    this.mower = new Mower(scene);
    this.walkers = new Walkers(scene);
    this.shops = {};
    for (const id of E.shopIds(this.cfg)) {
      if (!this.buildings[id]) continue;
      this.shops[id] = { id, sc: this.cfg.shops[id], b: this.buildings[id], customers: [], spawnT: 1, brew: null, ready: false, staff: [], helpers: [], readyMesh: this.makeReadyItem(id) };
    }
    this.litter = [];
    this.litterT = 6;
    this.vip = null;
    this.vipT = this.base.vip.firstAfterSeconds;
    this.rush = null;
    this.nextRushAt = null;
    this.helperUntil = 0;
    this.passive = {};
    this.zoom = { level: 0, shop: this.openShops()[0] || st.lots[1] };
    this.ui.beginAnchors();
    this.ui.placeAnchors(this.stage);
    this.ui.cardKey = '';

    this.restoreWorld();
    this.catchUpRegisters();
    this.applyZoom(true);
    this.renderSideButtons();
  }

  // A finished product waiting on the counter.
  makeReadyItem(id) {
    const p = new Person(this.stage.scene);
    p.hold(this.cfg.shops[id].item);
    const item = p.hand;
    p.dispose();
    const b = this.buildings[id];
    item.position.set(b.style.x - 0.78, 0.82, FACADE_Z + 0.58);
    item.scale.setScalar(1.3);
    item.visible = false;
    this.stage.scene.add(item);
    return item;
  }

  travel(streetId) {
    if (streetId === this.streetId) return;
    this.persist();
    const fade = this.root.querySelector('#fade');
    fade.hidden = false;
    fade.classList.add('on');
    audio.chime();
    setTimeout(() => {
      this.buildWorld(streetId);
      this.layout();
      E.log(this.g, 'travel', { street: streetId });
      fade.classList.remove('on');
      setTimeout(() => { fade.hidden = true; }, 350);
      this.ui.toast(this.cfg.street.title.toUpperCase(), this.cityOf(streetId).title);
      this.persist();
    }, 380);
  }

  cityOf(streetId) { return this.base.cities.find((c) => (c.streets || []).some((s) => s.id === streetId)); }

  // ---------- layout / persistence ----------
  layout() {
    const top = this.root.querySelector('#topbar').getBoundingClientRect().height + 8;
    const bottom = Math.max(this.root.querySelector('#card').getBoundingClientRect().height, 96) + 18;
    this.stage.resize(top, bottom);
    this.applyZoom(true);
  }

  persist() {
    if (!this.g) return;
    this.s.lawn = this.grass.serialize();
    this.s.lawnCut = this.grass.serializeCut();
    this.s.lastSeen = Date.now();
    save(this.g);
  }

  restoreWorld() {
    const s = this.s;
    this.grass.restore(s.lawn);
    this.grass.restoreCut(s.lawnCut);
    if (s.lawnRegrowAt && Date.now() >= s.lawnRegrowAt) { this.grass.regrowAll(); s.lawnRegrowAt = null; }
    for (const p of this.cfg.projects) if (s.done[p.id]) this.applyProject(p, false);
    for (const [id, sh] of Object.entries(this.shops)) {
      for (const u of sh.sc.upgrades) if (s.owned[E.upKey(id, u.id)]) this.applyUpgrade(id, u, false);
    }
    for (const b of s.builds) this.constructionVisual(b, true);
    for (const id of s.trashCleared) this.street.clearTrash(id);
    this.updateWalkers();
    this.refreshCash();
    this.ui.shown = this.g.cash;
  }

  // Staff kept selling while the player was away (other street, or app closed) — up to the register cap.
  catchUpRegisters() {
    const s = this.s;
    const away = Math.max(0, (Date.now() - (s.lastSeen || Date.now())) / 1000);
    s.lastSeen = Date.now();
    if (away < 5) return;
    let total = 0;
    for (const id of Object.keys(this.shops)) {
      const rate = E.staffRate(this.cfg, s, id);
      if (!rate) continue;
      const cap = E.registerCap(this.cfg, s, id);
      const before = s.registers[id] || 0;
      s.registers[id] = Math.min(cap, before + rate * away);
      total += s.registers[id] - before;
    }
    if (total >= 1) setTimeout(() => this.ui.toast('WELCOME BACK', `Your staff made ${money(total)}. Empty the registers!`), 500);
  }

  // ---------- money ----------
  totalIncome() {
    let r = 0;
    for (const st of E.allStreets(this.base)) {
      const ss = this.g.streets[st.id];
      if (ss) r += E.incomePerSecond(E.streetConfig(this.base, st.id), ss);
    }
    return r;
  }

  refreshCash() { this.ui.setCash(this.g.cash, this.totalIncome()); }

  addCash(v) {
    this.g.cash += v;
    this.g.earned += v;
    this.refreshCash();
    this.ui.bumpCash();
  }

  spend(v) {
    this.g.cash -= v;
    this.refreshCash();
  }

  flyCoin(xy, value, delay = 0) {
    this.ui.flyCoin(xy, () => {
      this.addCash(value);
      const now = performance.now();
      this.streak = now - this.lastCoin < 350 ? this.streak + 1 : 0;
      this.lastCoin = now;
      audio.coin(this.streak);
    }, delay);
  }

  popCoins(world, value, count = 1) {
    const per = value / count;
    for (let i = 0; i < count; i++) this.fx.coin(world.x, world.y, world.z, per, (xy, v) => this.flyCoin(xy, v), i * 0.06);
  }

  pressureOn() { return E.pressureActive(this.base, this.g, this.s); }

  paidOffersOn() { return this.base.monetization.mode !== 'off' && this.pressureOn(); }

  // ---------- zoom ----------
  openShops() { return Object.keys(this.shops || {}).filter((id) => E.shopOpen(this.cfg, this.s, id)); }

  shopX(id) { return this.buildings[id].style.x; }

  zoomTo(level, shop = this.zoom.shop) {
    const open = this.openShops();
    if (level > 0 && !open.length) return;
    if (level > 0 && !open.includes(shop)) shop = open.includes(this.zoom.shop) ? this.zoom.shop : open[0];
    level = Math.max(0, Math.min(2, level));
    if (level === this.zoom.level && shop === this.zoom.shop) return;
    this.zoom = { level, shop };
    if (level > 0) E.log(this.g, 'zoom', { level, shop });
    audio.tap();
    this.applyZoom(false);
  }

  applyZoom(instant) {
    const z = this.zoom;
    const shopOk = z.shop && this.buildings[z.shop];
    this.stage.setFocus(z.level && shopOk ? shopView(this.shopX(z.shop), z.level) : STREET_VIEW, instant);
    this.root.classList.toggle('zoomed', z.level > 0);
    const label = this.root.querySelector('#zoom-label');
    if (label) label.textContent = z.level && shopOk ? this.cfg.shops[z.shop].title : '';
    const open = this.openShops();
    this.root.querySelector('#shop-prev').hidden = !(z.level && open.length > 1);
    this.root.querySelector('#shop-next').hidden = !(z.level && open.length > 1);
    this.root.querySelector('#zoom-in').hidden = z.level >= 2 || !open.length;
    this.root.querySelector('#zoom-out').hidden = z.level === 0;
  }

  cycleShop(dir) {
    const open = this.openShops().sort((a, b) => this.shopX(a) - this.shopX(b));
    if (open.length < 2) return;
    const i = open.indexOf(this.zoom.shop);
    this.zoomTo(this.zoom.level, open[(i + dir + open.length) % open.length]);
  }

  // ---------- input ----------
  bindInput(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      audio.unlock();
      if (this.ui.modalOpen || this.ui.sheetOpen) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (this.pointers.size === 2) {
        this.mower.stop();
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), done: false, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, t: performance.now(), vx: 0, vy: 0 };
        this.stage.dragging = true;
        this.stage.fling = null;
        this.pointer = null;
        return;
      }
      const gp = this.stage.groundPoint(e.clientX, e.clientY);
      this.pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, mowing: false, panning: false, last: gp, t: performance.now(), vx: 0, vy: 0 };
      this.stage.fling = null;
      // a drag that starts on the lawn mows; when zoomed in, any other drag moves the camera
      if (gp && this.inLawn(gp)) this.startMow(gp);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) {
        const pz = this.pinch, [a, b] = [...this.pointers.values()];
        // two fingers together: move around the street (when zoomed in)…
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = mx - pz.mx, dy = my - pz.my;
        pz.mx = mx; pz.my = my;
        if (this.zoom.level) {
          this.stage.panBy(dx, dy);
          this.followView();
          const now = performance.now(), dtm = Math.max(1, now - pz.t);
          pz.vx = pz.vx * 0.6 + (dx / dtm) * 1000 * 0.4;
          pz.vy = pz.vy * 0.6 + (dy / dtm) * 1000 * 0.4;
          pz.t = now;
        }
        // …two fingers apart or together: zoom
        const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pz.d0;
        if (!pz.done && ratio > 1.3) { pz.done = true; this.zoomTo(this.zoom.level + 1, this.shopNearScreen(mx)); }
        if (!pz.done && ratio < 0.75) { pz.done = true; this.zoomTo(this.zoom.level - 1); }
        return;
      }
      const p = this.pointer;
      if (!p || p.id !== e.pointerId) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
        p.moved += Math.hypot(dx, dy);
        p.x = ev.clientX; p.y = ev.clientY;
        if (!p.mowing && this.zoom.level && (p.panning || p.moved > 8)) {
          if (!p.panning) { p.panning = true; this.stage.dragging = true; }
          this.stage.panBy(dx, dy);
          this.followView();
          const now = performance.now(), dtm = Math.max(1, now - p.t);
          p.vx = p.vx * 0.6 + (dx / dtm) * 1000 * 0.4;
          p.vy = p.vy * 0.6 + (dy / dtm) * 1000 * 0.4;
          p.t = now;
          continue;
        }
        const gp = this.stage.groundPoint(ev.clientX, ev.clientY);
        if (!gp) continue;
        if (!p.mowing && !this.zoom.level && p.moved > 10 && this.inLawn(gp)) this.startMow(gp);
        if (p.mowing && p.last) {
          const g = this.base.grass;
          this.grass.cutSegment(p.last.x, p.last.z, gp.x, gp.z, g.cutRadius, (t, weed) => this.onCut(t, weed), {
            passes: g.passes, cooldown: g.hitCooldown, onHit: (t) => this.onHalfCut(t),
          });
          this.mower.moveTo(gp);
          audio.mower();
        }
        p.last = gp;
      }
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pinch) {
        if (this.pointers.size < 2 && !this.pinch.ended) {
          this.pinch.ended = true;
          this.stage.dragging = false;
          if (this.zoom.level && performance.now() - this.pinch.t < 80 && Math.hypot(this.pinch.vx, this.pinch.vy) > 150) this.stage.fling = { x: this.pinch.vx, y: this.pinch.vy };
        }
        if (this.pointers.size === 0) this.pinch = null;
        return;
      }
      const p = this.pointer;
      if (!p || p.id !== e.pointerId) return;
      if (p.panning) {
        this.stage.dragging = false;
        if (performance.now() - p.t < 80 && Math.hypot(p.vx, p.vy) > 150) this.stage.fling = { x: p.vx, y: p.vy };
        this.followView();
      } else if (!p.mowing && p.moved < 14) this.tap(e.clientX, e.clientY);
      this.mower.stop();
      this.pointer = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // After a drag, the shop label follows whichever open shop is nearest the middle.
  followView() {
    const c = this.stage.viewCenterGround();
    if (!c) return;
    let best = null, bd = Infinity;
    for (const id of this.openShops()) {
      const d = Math.abs(this.shopX(id) - c.x);
      if (d < bd) { bd = d; best = id; }
    }
    const label = this.root.querySelector('#zoom-label');
    if (best && bd < 1.6 && c.z < -2.5) {
      this.zoom.shop = best;
      if (label) label.textContent = this.cfg.shops[best].title;
    } else if (label) label.textContent = '';
  }

  shopNearScreen(x) {
    let best = this.zoom.shop, bd = Infinity;
    for (const id of this.openShops()) {
      const d = Math.abs(this.stage.toScreen(this.buildings[id].anchor(1)).x - x);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  inLawn(p) {
    const L = ZONES.lawn, m = 0.5;
    return p.x > L.x0 - m && p.x < L.x1 + m && p.z > L.z0 - m && p.z < L.z1 + m;
  }

  startMow(gp) {
    this.pointer.mowing = true;
    this.mower.start(gp);
    this.strokeCuts = 0;
  }

  onHalfCut(t) {
    this.fx.clippings(t.x, t.z, TALL);
    audio.snip();
  }

  onCut(t, weed) {
    const g = this.base.grass;
    this.fx.clippings(t.x, t.z, t.lush ? LUSH : TALL);
    if (t.lush) {
      this.grassBank += g.regrownValue;
      if (this.grassBank >= 1) { this.grassBank -= 1; this.fx.coin(t.x, 0.2, t.z, 1, (xy, v) => this.flyCoin(xy, v)); }
    } else {
      const n = weed ? g.weedCoins : 1;
      for (let i = 0; i < n; i++) this.fx.coin(t.x, 0.2, t.z, g.coinValue, (xy, v) => this.flyCoin(xy, v), i * 0.05);
    }
    if (weed) this.fx.sparkle(t.x, 0.5, t.z, 4, 0.3);
    // the lawn grows back all at once, one timer after the first cut
    if (!this.s.lawnRegrowAt) this.s.lawnRegrowAt = Date.now() + this.base.grass.regrowSeconds * 1000;
    audio.snip();
    this.questEvent('mow');
    this.cutsThisSession++;
    this.strokeCuts = (this.strokeCuts || 0) + 1;
    const praise = { 10: 'Nice!', 20: 'Great!', 32: 'Amazing!' }[this.strokeCuts];
    if (praise && this.pointer) {
      this.ui.floater(praise, { x: this.pointer.x, y: this.pointer.y - 60 }, 'praise');
      audio.praise();
    }
    if (this.cutsThisSession % 4 === 0) { try { navigator.vibrate?.(5); } catch { /* unsupported */ } }
  }

  tap(cx, cy) {
    const custs = Object.values(this.shops).flatMap((sh) => sh.customers.map((c) => c.p.root));
    if (this.vip) custs.push(this.vip.p.root);
    const targets = [...Object.values(this.buildings).map((b) => b.root), ...this.street.tapTargets, ...this.litter.map((l) => l.g), ...custs];
    const hit = this.stage.pick(cx, cy, targets);
    if (!hit) return;
    const t = hit.userData.tap;
    if (t.type === 'trash') return this.tapTrash(t.id, hit);
    if (t.type === 'litter') return this.tapLitter(hit);
    if (t.type === 'vip') return this.serveVip();
    if (t.type === 'customer') return this.shopTap(t.shop);
    if (t.type === 'building') {
      const b = this.buildings[t.id];
      if (this.shops[t.id] && E.shopOpen(this.cfg, this.s, t.id)) {
        const now = performance.now();
        if (this.zoom.level === 0 && this.lastTap.shop === t.id && now - this.lastTap.t < 320) { this.zoomTo(1, t.id); this.lastTap.t = 0; return; }
        this.lastTap = { t: now, shop: t.id };
        return this.shopTap(t.id);
      }
      const p = E.availableProjects(this.cfg, this.s).find((q) => q.building === t.id);
      if (p && !E.isBuilding(this.s, 'project', p.id)) return this.buyProject(p);
      if (b.state === 'open') { b.anim = { t: 1.2 }; audio.tap(); }
    }
  }

  // ---------- shops ----------
  slotPos(sh, i) { return V(sh.b.style.x - 0.5 + i * 0.62, 0.12, FACADE_Z + 1.08); }

  front(sh) { return sh.customers.find((c) => c.slot === 0 && c.state === 'wait'); }

  staffed(id) { return E.autoServe(this.cfg, this.s, id) || this.time < this.helperUntil; }

  registerFull(id) {
    return E.autoServe(this.cfg, this.s, id) && (this.s.registers[id] || 0) >= E.registerCap(this.cfg, this.s, id);
  }

  shopTap(id) {
    const sh = this.shops[id];
    if (!sh || !E.shopOpen(this.cfg, this.s, id)) return;
    if (this.staffed(id) && !this.registerFull(id)) { sh.b.anim = { t: 1.4 }; audio.tap(); return; }
    // with a full register the staff stop, so the player can step in and serve by hand
    if (sh.ready) return this.serve(sh, true);
    if (!sh.brew && this.front(sh)) return this.startBrew(sh, sh.sc.serveSeconds, true);
    if (!sh.brew) { sh.b.anim = { t: 1.4 }; audio.tap(); }
  }

  startBrew(sh, dur, manual = false) {
    sh.brew = { t: 0, dur, manual };
    if (sh.id === 'cafe') audio.brew(); else audio.pop();
  }

  // Manual sales pay straight into the wallet; staff sales go to the register.
  serve(sh, manual) {
    const c = this.front(sh);
    if (!c) return;
    sh.ready = false;
    sh.readyMesh.visible = false;
    c.p.hold(sh.sc.item);
    const price = E.price(this.cfg, this.s, sh.id);
    const head = c.p.headWorld();
    if (manual) {
      this.popCoins(V(head.x, 0.9, head.z + 0.1), price, Math.min(4, Math.ceil(price / 5)));
      this.ui.floater(`+${money(price)}`, this.stage.toScreen(V(head.x, head.y + 0.6, head.z)), 'cash');
    } else {
      const cap = E.registerCap(this.cfg, this.s, sh.id);
      this.s.registers[sh.id] = Math.min(cap, (this.s.registers[sh.id] || 0) + price);
      this.ui.floater(`+${money(price)}`, this.stage.toScreen(V(head.x, head.y + 0.6, head.z)), 'cash small');
    }
    this.fx.sparkle(head.x, head.y + 0.2, head.z, 5, 0.4);
    this.g.served++;
    this.questEvent('serve');
    if (this.g.tutorial === 'serve') { this.g.tutorial = 'done'; E.log(this.g, 'tutorial_done'); }
    this.leave(sh, c, false);
  }

  collectRegister(id) {
    const v = Math.floor(this.s.registers[id] || 0);
    if (v < 1) return;
    this.s.registers[id] -= v;
    const sh = this.shops[id];
    const xy = this.stage.toScreen(sh.b.counterFront().add(V(0, 0.9, 0)));
    const n = Math.min(10, Math.max(3, Math.round(v / 15)));
    for (let i = 0; i < n; i++) this.flyCoin({ x: xy.x + (Math.random() - 0.5) * 40, y: xy.y + (Math.random() - 0.5) * 20 }, v / n, i * 45);
    this.ui.floater(`+${money(v)}`, { x: xy.x, y: xy.y - 30 }, 'cash');
    this.fx.sparkle(sh.b.style.x - 0.5, 1, FACADE_Z + 0.6, 8, 0.5);
    audio.chime();
    this.questEvent('collect');
    E.log(this.g, 'collect', { shop: id, value: v });
  }

  leave(sh, c, angry) {
    c.state = 'leave';
    c.mood = angry ? 'angry' : 'happy';
    c.moodT = 0;
    const edge = Math.random() < 0.5 ? -7 : 7;
    c.p.goTo([V(c.p.pos.x + 0.2, 0.12, WALK_Z + 0.05), V(edge, 0.12, WALK_Z + 0.05)]);
    for (const o of sh.customers) {
      if (o.state !== 'leave' && o.slot > c.slot) {
        o.slot--;
        o.state = 'approach';
        o.p.goTo([this.slotPos(sh, o.slot)]);
      }
    }
  }

  spawnCustomer(sh) {
    const fromLeft = Math.random() < 0.5;
    const queued = sh.customers.filter((c) => c.state !== 'leave').length;
    const p = new Person(this.stage.scene, { speed: 1.5 + Math.random() * 0.3 }).place(fromLeft ? -6.5 : 6.5, 0.12, WALK_Z);
    p.root.userData.tap = { type: 'customer', shop: sh.id };
    const sp = this.slotPos(sh, queued);
    p.goTo([V(sp.x + (fromLeft ? -0.3 : 0.3), 0.12, WALK_Z), sp]);
    sh.customers.push({ p, slot: queued, state: 'approach', wait: 0, mood: null, moodT: 0 });
  }

  updateShops(dt) {
    const cfg = this.cfg, s = this.s;
    const pressure = this.pressureOn();
    const rushRate = this.rush ? this.base.pressure.rush.customerRate : 1;
    for (const [id, sh] of Object.entries(this.shops)) {
      if (!E.shopOpen(cfg, s, id)) continue;
      const full = this.registerFull(id);
      const auto = this.staffed(id) && !full;
      const active = sh.customers.filter((c) => c.state !== 'leave').length;
      sh.spawnT -= dt;
      if (sh.spawnT <= 0) {
        if (active < sh.sc.maxQueue) this.spawnCustomer(sh);
        else if (pressure) this.loseSale(sh, this.slotPos(sh, sh.sc.maxQueue));
        sh.spawnT = E.customerInterval(cfg, s, id, rushRate) * (0.75 + Math.random() * 0.5);
      }
      for (let i = sh.customers.length - 1; i >= 0; i--) {
        const c = sh.customers[i];
        c.p.update(dt);
        if (c.state === 'approach' && !c.p.moving) { c.state = 'wait'; c.p.face(c.p.pos.x, c.p.pos.z - 1); }
        if (c.state === 'wait' || c.state === 'approach') {
          c.wait += dt;
          if (pressure && c.wait > this.base.pressure.patienceSeconds && !(c.slot === 0 && (sh.brew || sh.ready))) {
            this.loseSale(sh, c.p.headWorld());
            this.leave(sh, c, true);
          }
        }
        if (c.mood) c.moodT += dt;
        if (c.state === 'leave' && !c.p.moving) { c.p.dispose(); sh.customers.splice(i, 1); }
      }
      if (sh.brew) {
        sh.brew.t += dt;
        if (sh.b.machine) sh.b.machine.position.y = 0.57 + Math.abs(Math.sin(sh.brew.t * 30)) * 0.01;
        if (sh.brew.t >= sh.brew.dur) {
          const manual = sh.brew.manual;
          sh.brew = null;
          sh.ready = true;
          if (!manual && auto) this.serve(sh, false);
          else { sh.readyMesh.visible = true; audio.ding(); }
        }
      } else if (auto && sh.ready) {
        // an order the player made by hand still pays them directly
        this.serve(sh, sh.readyMesh.visible);
      } else if (auto && !sh.ready && this.front(sh)) {
        const boost = this.time < this.helperUntil ? this.base.monetization.rushHelper.speedMultiplier : 1;
        this.startBrew(sh, E.staffSeconds(cfg, s, id) / boost);
      }
      for (const st of [...sh.staff, ...sh.helpers]) {
        st.update(dt);
        st.body.position.y = sh.brew && !sh.brew.manual ? Math.abs(Math.sin(this.time * 14)) * 0.03 : 0;
      }
    }
  }

  loseSale(sh, world) {
    const v = E.price(this.cfg, this.s, sh.id);
    this.g.lost += v;
    if (this.rush) this.rush.lost += v;
    this.ui.floater(`-${money(v)}`, this.stage.toScreen(world.clone().add(V(0, 0.5, 0))), 'lost');
    audio.deny();
    E.log(this.g, 'lost_sale', { shop: sh.id, value: v });
  }

  // ---------- VIP customers: big tips, only the player can serve them ----------
  updateVip(dt) {
    const v = this.base.vip;
    const open = this.openShops();
    if (!open.length) return;
    if (!this.vip) {
      this.vipT -= dt;
      if (this.vipT > 0) return;
      const id = open[Math.floor(Math.random() * open.length)];
      const sh = this.shops[id];
      const fromLeft = Math.random() < 0.5;
      const p = new Person(this.stage.scene, { shirt: '#ffc12b', scale: 1.12, speed: 1.6 }).place(fromLeft ? -6.5 : 6.5, 0.12, WALK_Z);
      const crown = group(p.body, 0, 0.74, 0);
      cyl(crown, 0.1, 0.11, 0.08, '#ffd23f', {}, 10);
      for (let i = 0; i < 5; i++) sphere(crown, 0.025, '#ff5a5a', { x: Math.cos(i * 1.256) * 0.1, y: 0.1, z: Math.sin(i * 1.256) * 0.1 });
      p.root.userData.tap = { type: 'vip' };
      const spot = V(sh.b.style.x - 1.15, 0.12, FACADE_Z + 1.05);
      p.goTo([V(spot.x, 0.12, WALK_Z), spot]);
      this.vip = { p, shop: id, state: 'approach', wait: 0 };
      E.log(this.g, 'vip_arrive', { shop: id });
      return;
    }
    const c = this.vip;
    c.p.update(dt);
    if (c.state === 'approach' && !c.p.moving) { c.state = 'wait'; c.p.face(c.p.pos.x + 1, c.p.pos.z - 1); audio.chime(); }
    if (c.state === 'wait') {
      c.wait += dt;
      if (c.wait > v.patienceSeconds) {
        this.ui.floater('VIP left', this.stage.toScreen(c.p.headWorld().add(V(0, 0.5, 0))), 'warn');
        this.vipLeave();
      }
    }
    if (c.state === 'leave' && !c.p.moving) {
      c.p.dispose();
      this.vip = null;
      this.vipT = v.everySeconds[0] + Math.random() * (v.everySeconds[1] - v.everySeconds[0]);
    }
  }

  vipLeave() {
    const c = this.vip;
    c.state = 'leave';
    c.p.goTo([V(c.p.pos.x, 0.12, WALK_Z), V(Math.random() < 0.5 ? -7 : 7, 0.12, WALK_Z)]);
  }

  serveVip() {
    const c = this.vip;
    if (!c || c.state !== 'wait') return;
    const sh = this.shops[c.shop];
    const value = E.price(this.cfg, this.s, c.shop) * this.base.vip.multiplier;
    c.p.hold(sh.sc.item);
    const head = c.p.headWorld();
    this.popCoins(V(head.x, 0.9, head.z + 0.1), value, 6);
    this.ui.floater(`VIP +${money(value)}`, this.stage.toScreen(head.clone().add(V(0, 0.6, 0))), 'cash');
    this.fx.confetti(head.x, head.y + 0.3, head.z, 40);
    audio.fanfare();
    this.questEvent('vip');
    E.log(this.g, 'vip_served', { shop: c.shop, value });
    this.vipLeave();
  }

  // ---------- litter ----------
  updateLitter(dt) {
    if (!this.openShops().length) return;
    for (const l of this.litter) { l.t += dt; l.g.scale.setScalar(Math.min(1, l.t * 4)); }
    this.litterT -= dt;
    if (this.litterT > 0) return;
    this.litterT = this.base.litter.everySeconds * (0.7 + Math.random() * 0.6);
    if (this.litter.length >= this.base.litter.max) return;
    const band = LITTER_BANDS[Math.floor(Math.random() * LITTER_BANDS.length)];
    const x = band.x0 + Math.random() * (band.x1 - band.x0), z = band.z0 + Math.random() * (band.z1 - band.z0);
    const y = z < 0.2 ? 0.12 : 0.05;
    const g = group(this.stage.scene, x, y, z);
    if (Math.random() < 0.5) {
      sphere(g, 0.08, '#f4f1ea', { y: 0.07 }, 1, 0.8, 1);
      sphere(g, 0.05, '#e6e1d4', { x: 0.08, y: 0.05, z: 0.04 }, 1, 0.8, 1);
    } else {
      cyl(g, 0.045, 0.045, 0.14, ['#e8473a', '#2f9dff', '#21a55c'][Math.floor(Math.random() * 3)], { y: 0 }, 10).rotation.set(0, 0, Math.PI / 2);
    }
    const hit = new THREE.Mesh(geo('litterHit', () => new THREE.CylinderGeometry(0.4, 0.4, 0.5, 8)), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.25;
    g.add(hit);
    g.rotation.y = Math.random() * 6;
    g.scale.setScalar(0.01);
    g.userData.tap = { type: 'litter' };
    this.litter.push({ g, t: 0 });
  }

  tapLitter(g) {
    const i = this.litter.findIndex((l) => l.g === g);
    if (i < 0) return;
    this.litter.splice(i, 1);
    g.removeFromParent();
    const r = this.base.litter.reward;
    this.fx.dust(g.position.x, 0.2, g.position.z, 5, 0.2);
    this.popCoins(V(g.position.x, 0.3, g.position.z), r, 1);
    audio.pop();
    this.questEvent('litter');
  }

  // ---------- quests ----------
  fillQuests() {
    const q = this.base.quests;
    if (!this.openShops().length && Object.keys(this.g.streets).length < 2) return;
    while (this.g.quests.length < q.active) {
      const used = new Set(this.g.quests.map((x) => x.type));
      const pool = q.pool.filter((p) => !used.has(p.type));
      const t = pool[Math.floor(Math.random() * pool.length)] || q.pool[0];
      const tier = Math.min(t.counts.length - 1, this.g.questTier[t.type] || 0);
      this.g.quests.push({ type: t.type, n: t.counts[tier], reward: t.rewards[tier], progress: 0, text: t.text.replace('{n}', t.counts[tier]).replace('{s}', t.counts[tier] === 1 ? '' : 's') });
    }
  }

  questEvent(type, amount = 1) {
    let completed = false;
    for (const q of this.g.quests) {
      if (q.type !== type || q.progress >= q.n) continue;
      q.progress = Math.min(q.n, q.progress + amount);
      if (q.progress >= q.n) completed = true;
    }
    if (completed) {
      audio.chime();
      this.ui.floater('Goal complete!', { x: 48, y: this.root.querySelector('#quest-btn').getBoundingClientRect().bottom + 20 }, 'praise small');
    }
    this.renderSideButtons();
    if (this.questSheetOpen) this.renderQuestSheet();
  }

  claimQuest(i) {
    const q = this.g.quests[i];
    if (!q || q.progress < q.n) return;
    this.g.quests.splice(i, 1);
    this.g.questTier[q.type] = (this.g.questTier[q.type] || 0) + 1;
    const btn = this.root.querySelector('#quest-btn').getBoundingClientRect();
    for (let k = 0; k < 6; k++) this.flyCoin({ x: btn.right + 40, y: btn.bottom + 60 + k * 4 }, q.reward / 6, k * 50);
    audio.fanfare();
    E.log(this.g, 'quest_claim', { type: q.type, reward: q.reward });
    this.fillQuests();
    this.renderSideButtons();
    this.renderQuestSheet();
    this.persist();
  }

  openQuests() {
    audio.tap();
    this.fillQuests();
    this.questSheetOpen = true;
    this.ui.openSheet(`
      <div class="sheet-head"><div class="sheet-title">${icon('quest')} Goals</div><button class="x" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="quest-list"></div>`, () => { this.questSheetOpen = false; });
    this.renderQuestSheet();
  }

  renderQuestSheet() {
    const list = this.ui.sheet.querySelector('.quest-list');
    if (!list) return;
    const icons = { serve: 'cup', mow: 'tree', litter: 'trash', vip: 'star', collect: 'register' };
    list.innerHTML = this.g.quests.map((q, i) => `
      <div class="up-row ${q.progress >= q.n ? 'is-owned' : ''}">
        <div class="up-icon">${icon(icons[q.type] || 'star')}</div>
        <div class="up-text"><div class="up-title">${q.text}</div>
          <div class="bar sm"><i style="width:${(100 * q.progress) / q.n}%"></i></div></div>
        ${q.progress >= q.n
          ? `<button class="btn btn-green sm" data-claim="${i}">${icon('coin')}<span>${money(q.reward)}</span></button>`
          : `<span class="q-count">${q.progress}/${q.n}</span>`}
      </div>`).join('');
    list.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => this.claimQuest(+b.dataset.claim)));
  }

  // ---------- pressure: rush hour + helpers ----------
  updatePressure() {
    const g = this.g, cfg = this.base;
    if (!this.pressureOn()) return;
    if (g.pressureStartedAt === null) {
      g.pressureStartedAt = g.playSeconds;
      E.log(g, 'pressure_start');
      this.ui.toast('BUSY STREET!', 'Customers won\'t wait forever now');
    }
    if (!this.openShops().length) return;
    if (this.nextRushAt === null) this.nextRushAt = g.playSeconds + cfg.pressure.rush.firstAfterSeconds;
    if (!this.rush && g.playSeconds >= this.nextRushAt) {
      this.rush = { until: g.playSeconds + cfg.pressure.rush.durationSeconds, lost: 0, helped: false };
      this.nextRushAt = g.playSeconds + cfg.pressure.rush.everySeconds;
      E.log(g, 'rush_start');
      audio.fanfare();
      this.ui.toast('RUSH HOUR!', 'Serve fast or lose customers');
    }
    if (this.rush && g.playSeconds >= this.rush.until) {
      const lost = this.rush.lost;
      E.log(g, 'rush_end', { lost });
      if (lost > 0) this.ui.toast('RUSH OVER', `You lost ${money(lost)} to waiting customers`);
      else this.ui.toast('PERFECT RUSH!', 'Nobody left unhappy');
      this.rush = null;
    }
  }

  renderRush() {
    const el = this.root.querySelector('#rush');
    if (!this.rush) { el.hidden = true; return; }
    el.hidden = false;
    const left = this.rush.until - this.g.playSeconds;
    const helper = this.base.monetization.rushHelper;
    const showHelper = helper.enabled && this.paidOffersOn() && !this.rush.helped;
    const key = `${Math.ceil(left)}|${this.rush.lost}|${showHelper}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = `
      <div class="rush-pill">${icon('clock')}<span>RUSH ${clock(left)}</span>${this.rush.lost ? `<b class="rush-lost">-${money(this.rush.lost)}</b>` : ''}</div>
      ${showHelper ? `<button class="rush-help" data-act="helper">${icon('barista')}<span>Helpers</span><b>${this.product('rush_helper').price}</b></button>` : ''}`;
  }

  hireHelpers() {
    if (!this.rush) return;
    this.offer('rush_helper', { title: 'Hire rush helpers', sub: 'Every shop serves itself until the rush is over.' }, () => {
      this.rush.helped = true;
      this.helperUntil = this.time + (this.rush.until - this.g.playSeconds);
      for (const sh of Object.values(this.shops)) {
        if (!E.shopOpen(this.cfg, this.s, sh.id) || E.autoServe(this.cfg, this.s, sh.id)) continue;
        const p = new Person(this.stage.scene, { shirt: '#ffc93c', apron: true, scale: 1 }).place(sh.b.style.x - 0.75, 0.12, FACADE_Z + 0.22);
        sh.helpers.push(p);
        this.fx.sparkle(p.pos.x, 0.8, p.pos.z, 10, 0.6);
      }
    });
  }

  updateHelpers() {
    if (this.helperUntil && this.time >= this.helperUntil) {
      this.helperUntil = 0;
      for (const sh of Object.values(this.shops)) { sh.helpers.forEach((p) => p.dispose()); sh.helpers = []; }
    }
  }

  // ---------- trash ----------
  tapTrash(id, obj) {
    if (!this.openShops().length) {
      obj.rotation.z = 0.2;
      setTimeout(() => { obj.rotation.z = 0; }, 120);
      audio.deny();
      return;
    }
    if (this.s.trashCleared.includes(id)) return;
    const pos = this.street.clearTrash(id);
    this.s.trashCleared.push(id);
    this.fx.dust(pos.x, 0.2, pos.z, 8, 0.3);
    audio.pop();
    this.popCoins(V(pos.x, 0.3, pos.z), this.base.trash.rewardPerPile, 2);
    this.ui.floater(`+${money(this.base.trash.rewardPerPile)}`, this.stage.toScreen(V(pos.x, 0.9, pos.z)), 'cash');
    this.questEvent('litter');
    if (this.s.trashCleared.length >= this.street.trash.length && !this.s.done.trash) {
      const p = this.cfg.projects.find((q) => q.id === 'trash');
      if (p) this.completeProject(p);
    }
  }

  // ---------- projects ----------
  buyProject(p) {
    const s = this.s;
    if (s.done[p.id] || E.isBuilding(s, 'project', p.id) || p.type === 'task') return;
    if (this.g.cash < p.cost) {
      audio.deny();
      this.ui.floater(`Need ${money(p.cost - this.g.cash)} more`, this.anchorScreen(p), 'warn');
      return;
    }
    if (p.buildSeconds > 0 && E.buildersBusy(s) >= this.builderCount()) {
      audio.deny();
      const extra = this.product('builder');
      if (extra && !this.g.bought?.builder && !this.g.bought?.starter && purchaseMode(this.base) !== 'off') {
        this.offer('builder', { title: 'Your builder is busy', sub: 'Hire a second builder to work on two projects at once.' }, null, { from: 'busy' });
      } else this.ui.floater('Your builder is busy', this.anchorScreen(p), 'warn');
      return;
    }
    this.spend(p.cost);
    E.log(this.g, 'buy_project', { id: p.id, street: this.streetId, cost: p.cost });
    if (p.hook) E.log(this.g, 'hook_bought', { id: p.id });
    audio.tap();
    if (p.choice) this.openChoice(p, (choiceId) => { s.choices[p.choice] = choiceId; E.log(this.g, 'choice', { id: p.choice, value: choiceId }); this.startProjectBuild(p); });
    else this.startProjectBuild(p);
    if (this.g.tutorial === 'mow') this.g.tutorial = 'serve';
    this.persist();
  }

  startProjectBuild(p) {
    if (p.buildSeconds > 0) {
      const b = { kind: 'project', id: p.id, endsAt: Date.now() + p.buildSeconds * 1000, total: p.buildSeconds };
      this.s.builds.push(b);
      this.constructionVisual(b, true);
      const spot = this.projectSpot(p);
      this.fx.dust(spot.x, 0.2, spot.z, 10, 0.8);
      audio.thud();
    } else this.completeProject(p);
  }

  completeProject(p) {
    const s = this.s;
    s.done[p.id] = true;
    s.builds = s.builds.filter((b) => !(b.kind === 'project' && b.id === p.id));
    this.constructionVisual({ kind: 'project', id: p.id }, false);
    this.applyProject(p, true);
    const spot = this.projectSpot(p);
    this.fx.dust(spot.x, spot.y * 0.6, spot.z, 22, 1.4);
    this.fx.confetti(spot.x, spot.y + 0.8, spot.z, p.hook ? 140 : 70);
    audio.poof();
    audio.fanfare();
    try { navigator.vibrate?.([25, 40, 25]); } catch { /* unsupported */ }
    E.log(this.g, 'complete_project', { id: p.id, street: this.streetId });
    const titles = { cafe: ['CAFÉ OPEN!', 'Tap the café to serve'], trash: ['SPOTLESS!', 'The street is clean'], flowershop: ['FLOWER SHOP OPEN!', 'Run two shops at once'], bakery: ['BAKERY OPEN!', 'Fresh croissants every morning'] };
    const [t, sub] = titles[p.id] || [`${p.title.toUpperCase()}!`, ''];
    if (p.type !== 'unlock') this.ui.toast(t, sub);
    this.updateWalkers();
    if (p.shop && this.shops[p.shop]) this.shops[p.shop].spawnT = 0.6;
    if (p.hook && this.streetId === E.allStreets(this.base)[0].id) setTimeout(() => this.openMilestone(p), 1600);
    if (p.type === 'unlock') this.unlockStreet(p.street);
    this.fillQuests();
    this.refreshCash();
    this.applyZoom(false);
    this.renderSideButtons();
    this.persist();
  }

  applyProject(p, animate) {
    const s = this.s;
    if (p.type === 'building') {
      const b = this.buildings[p.building];
      if (animate) b.restore(); else b.setState('open');
      b.setHighlight(false);
      return;
    }
    if (p.id === 'trash') this.street.trash.forEach((_, i) => this.street.clearTrash(i));
    else if (p.id === 'sidewalk') this.street.setPaving(s.choices.pavement || 'brick');
    else if (p.id === 'landscaping') {
      const opt = this.base.choices.flowers.options.find((o) => o.id === s.choices.flowers) || this.base.choices.flowers.options[0];
      this.street.setLandscaping(opt.color);
    } else if (p.id === 'streetlights') this.street.setLights(true);
    else if (p.id === 'repave') this.street.setRoad(true);
  }

  unlockStreet(id) {
    this.g.streets[id] ||= E.createStreet();
    const st = E.allStreets(this.base).find((x) => x.id === id);
    E.log(this.g, 'street_unlocked', { street: id });
    this.root.querySelector('#map-btn').classList.add('hint');
    const el = this.ui.openModal(`
      <div class="fd">
        <div class="fd-art">${icon('map', 'xl')}</div>
        <div class="modal-title">${st.title} is open!</div>
        <p class="fineprint">A whole new street to restore, with new shops. Your staff here keep selling while you're away.</p>
        <button class="btn btn-green big" data-act="go">Go there</button>
        <button class="btn-link" data-act="later">Later</button>
      </div>`);
    el.querySelector('[data-act="go"]').addEventListener('click', () => { this.ui.closeModal(); this.travel(id); });
    el.querySelector('[data-act="later"]').addEventListener('click', () => this.ui.closeModal());
  }

  projectSpot(p) {
    if (p.type === 'building') return this.buildings[p.building].anchor(1.4);
    return (PROJECT_SPOTS[p.id] || V(0, 0.8, -0.5)).clone();
  }

  anchorScreen(p) { return this.stage.toScreen(this.projectSpot(p)); }

  constructionVisual(b, on) {
    if (b.kind === 'project') {
      const p = this.cfg.projects.find((q) => q.id === b.id);
      if (p?.type === 'building') this.buildings[p.building].setConstructing(on);
    }
  }

  // ---------- shop upgrades ----------
  buyUpgrade(shop, u) {
    const s = this.s, key = E.upKey(shop, u.id);
    if (s.owned[key] || E.isBuilding(s, 'upgrade', u.id, shop)) return;
    if (this.g.cash < u.cost) { audio.deny(); return; }
    this.spend(u.cost);
    E.log(this.g, 'buy_upgrade', { id: key, cost: u.cost });
    audio.tap();
    if (u.buildSeconds > 0) {
      s.builds.push({ kind: 'upgrade', shop, id: u.id, endsAt: Date.now() + u.buildSeconds * 1000, total: u.buildSeconds });
      const b = this.buildings[shop];
      this.fx.dust(b.style.x, 0.4, FACADE_Z + 0.8, 8, 0.6);
    } else this.completeUpgrade(shop, u);
    this.persist();
    this.renderShopSheet();
  }

  completeUpgrade(shop, u) {
    const s = this.s;
    s.owned[E.upKey(shop, u.id)] = true;
    s.builds = s.builds.filter((b) => !(b.kind === 'upgrade' && b.id === u.id && b.shop === shop));
    this.applyUpgrade(shop, u, true);
    const a = this.buildings[shop].anchor(1.2);
    this.fx.sparkle(a.x, a.y, a.z, 14, 1.4);
    this.fx.confetti(a.x, a.y + 0.6, a.z, 40);
    audio.fanfare();
    this.ui.toast(u.title.toUpperCase(), u.effect?.autoServe ? 'Sales go to the register. Tap it to collect.' : u.effectLabel || '');
    E.log(this.g, 'complete_upgrade', { id: E.upKey(shop, u.id) });
    this.refreshCash();
    this.persist();
    this.renderShopSheet();
  }

  applyUpgrade(shop, u, animate) {
    const e = u.effect || {};
    const sh = this.shops[shop];
    const b = this.buildings[shop];
    if (sh && (e.autoServe || e.staffSpeed)) {
      const p = new Person(this.stage.scene, { shirt: b.style.trim, apron: true, scale: 1 }).place(b.style.x - 0.75 + sh.staff.length * 0.5, 0.12, FACADE_Z + 0.22);
      sh.staff.push(p);
    }
    if (e.decor) {
      b.setDecor(e.decor, true);
      if (e.decor === 'seating' || e.decor === 'tables') {
        const x0 = b.style.x + (b.decor.seating || shop === 'bistro' ? -1.2 : 1.12);
        for (const [dx, dz, face] of [[-0.6, -0.08, 1], [0.52, 0.32, -1]]) {
          const p = new Person(this.stage.scene).place(x0 + dx, 0.2, FACADE_Z + 0.75 + dz);
          p.root.rotation.y = (face * Math.PI) / 2;
          p.legL.rotation.x = p.legR.rotation.x = -1.3;
          p.hold(this.cfg.shops[shop]?.item || 'cup');
          p.armR.rotation.x = -0.9;
        }
      }
    }
    if (animate) b.anim = { t: 0.8 };
  }

  // ---------- builds, passive income ----------
  updateBuilds() {
    const now = Date.now();
    for (const b of [...this.s.builds]) if (now >= b.endsAt) this.finishBuild(b);
  }

  finishBuild(b) {
    if (b.kind === 'project') {
      const p = this.cfg.projects.find((q) => q.id === b.id);
      if (p) this.completeProject(p); else this.s.builds.splice(this.s.builds.indexOf(b), 1);
    } else {
      const u = this.cfg.shops[b.shop]?.upgrades.find((q) => q.id === b.id);
      if (u) this.completeUpgrade(b.shop, u); else this.s.builds.splice(this.s.builds.indexOf(b), 1);
    }
  }

  updatePassive(dt) {
    for (const p of this.cfg.projects) {
      const rate = p.effect?.passivePerSecond;
      if (!rate || !this.s.done[p.id]) continue;
      const bank = (this.passive[p.id] ||= { v: 0, t: Math.random() * 3 });
      bank.v += rate * dt;
      bank.t += dt;
      if (bank.t > 3.5 && bank.v >= 1) {
        const v = Math.floor(bank.v);
        bank.v -= v;
        bank.t = 0;
        const spot = p.type === 'building' ? this.buildings[p.building].anchor(1.6) : this.street.lamps[1].g.position.clone().add(V(0, 2, 0));
        const xy = this.stage.toScreen(spot);
        this.ui.floater(`+${money(v)}`, { x: xy.x, y: xy.y - 10 }, 'cash small');
        this.flyCoin(xy, v);
      }
    }
  }

  updateWalkers() {
    const pc = this.base.pedestrians;
    const done = Object.keys(this.s.done).length;
    this.walkers.setCount(Math.min(pc.max, pc.base + pc.perCompletedProject * done));
  }

  // ---------- speeding up timers: rewarded ad, or (after the pinch point) $0.99 ----------
  speedUp(b) {
    const label = b.kind === 'upgrade' ? this.cfg.shops[b.shop].upgrades.find((u) => u.id === b.id)?.title : this.cfg.projects.find((p) => p.id === b.id)?.title;
    const ads = this.base.ads;
    const paid = this.paidOffersOn();
    E.log(this.g, 'speedup_open', { item: b.id });
    const left = () => Math.max(0, (b.endsAt - Date.now()) / 1000);
    const el = this.ui.openModal(`
      <div class="fd">
        <div class="fd-art">${icon('clock', 'xl')}</div>
        <div class="modal-title">${label}</div>
        <div class="speed-left">${icon('clock')}<span data-left>${clock(left())}</span> left</div>
        ${ads.enabled ? `<button class="btn btn-blue big ad-btn" data-act="ad">${icon('play')}<span>Watch ad · −${clock(ads.skipSeconds)}</span></button>` : ''}
        ${paid ? `<button class="btn btn-gold big" data-act="pay">${icon('bolt')}<span>Finish now · ${this.product('skip_build').price}</span></button>` : ''}
        <button class="btn-link" data-act="no">Keep waiting</button>
      </div>`);
    const tick = setInterval(() => {
      const l = el.querySelector('[data-left]');
      if (!l || this.ui.modal.hidden) return clearInterval(tick);
      l.textContent = clock(left());
      if (left() <= 0) { clearInterval(tick); this.ui.closeModal(); }
    }, 500);
    el.querySelector('[data-act="no"]').addEventListener('click', () => { E.log(this.g, 'speedup_dismiss', { item: b.id }); this.ui.closeModal(); });
    el.querySelector('.modal-scrim').addEventListener('click', () => this.ui.closeModal());
    el.querySelector('[data-act="ad"]')?.addEventListener('click', () => {
      this.ui.closeModal();
      this.playAd(() => {
        b.endsAt -= ads.skipSeconds * 1000;
        E.log(this.g, 'ad_watched', { item: b.id });
        this.ui.toast('TIME SKIPPED', `−${clock(ads.skipSeconds)}`);
        this.persist();
      });
    });
    el.querySelector('[data-act="pay"]')?.addEventListener('click', () => {
      this.ui.closeModal();
      this.buyProduct('skip_build', () => this.finishBuild(b), { item: b.shop ? E.upKey(b.shop, b.id) : b.id });
    });
  }

  speedUpGrass() {
    const s = this.s, ads = this.base.ads;
    if (!s.lawnRegrowAt) return;
    E.log(this.g, 'speedup_open', { item: 'grass' });
    const left = () => Math.max(0, (s.lawnRegrowAt - Date.now()) / 1000);
    const el = this.ui.openModal(`
      <div class="fd">
        <div class="fd-art">${icon('tree', 'xl')}</div>
        <div class="modal-title">The grass is growing</div>
        <div class="speed-left">${icon('clock')}<span data-left>${clock(left())}</span> left</div>
        ${ads.enabled ? `<button class="btn btn-blue big ad-btn" data-act="ad">${icon('play')}<span>Watch ad · grow it now</span></button>` : ''}
        <button class="btn-link" data-act="no">Keep waiting</button>
      </div>`);
    el.querySelector('[data-act="no"]').addEventListener('click', () => this.ui.closeModal());
    el.querySelector('.modal-scrim').addEventListener('click', () => this.ui.closeModal());
    el.querySelector('[data-act="ad"]')?.addEventListener('click', () => {
      this.ui.closeModal();
      this.playAd(() => { s.lawnRegrowAt = Date.now(); E.log(this.g, 'ad_watched', { item: 'grass' }); });
    });
  }

  // Placeholder for a rewarded video ad (AdMob / AppLovin in the store build).
  playAd(onReward) {
    const el = this.root.querySelector('#ad');
    const secs = this.base.ads.durationSeconds;
    el.hidden = false;
    el.innerHTML = `<div class="ad-box"><div class="ad-tag">Ad · test placeholder</div><div class="ad-art">${icon('play', 'xl')}</div><div class="ad-copy">A rewarded video plays here in the real app</div><div class="ad-bar"><i></i></div><div class="ad-count"></div></div>`;
    const bar = el.querySelector('.ad-bar i'), count = el.querySelector('.ad-count');
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      bar.style.width = `${k * 100}%`;
      count.textContent = k < 1 ? `Reward in ${Math.ceil(secs * (1 - k))}` : '';
      if (k < 1) requestAnimationFrame(step);
      else { el.hidden = true; audio.fanfare(); onReward(); }
    };
    requestAnimationFrame(step);
  }

  // ---------- purchases (test mode on the web, real in-app purchase in the app builds) ----------
  product(id) { return this.base.store.products.find((p) => p.id === id); }

  builderCount() { return this.base.builders.count + (this.g.extraBuilders || 0); }

  // Apply what a product gives. Cash arrives as a shower of coins.
  grantProduct(p) {
    const gr = p.grant || {};
    if (gr.builders) this.g.extraBuilders = (this.g.extraBuilders || 0) + gr.builders;
    if (gr.cash) {
      const from = { x: this.stage.width / 2, y: this.stage.height * 0.55 };
      const n = 12;
      for (let i = 0; i < n; i++) this.flyCoin({ x: from.x + (Math.random() - 0.5) * 140, y: from.y + (Math.random() - 0.5) * 90 }, gr.cash / n, i * 40);
    }
    if (p.oneTime) (this.g.bought ||= {})[p.id] = true;
  }

  async buyProduct(id, onGrant, meta = {}) {
    const p = this.product(id);
    if (!p) return;
    E.log(this.g, 'purchase_start', { product: id, ...meta });
    const res = await purchase(this.base, id);
    if (!res.ok) {
      E.log(this.g, res.cancelled ? 'purchase_cancel' : 'purchase_fail', { product: id, reason: res.reason });
      if (res.reason) this.ui.toast('NOT PURCHASED', res.reason);
      return false;
    }
    E.log(this.g, 'purchase', { product: id, price: p.price, test: !!res.test, ...meta });
    this.grantProduct(p);
    onGrant?.();
    audio.fanfare();
    this.ui.toast('PURCHASE COMPLETE', p.title);
    this.persist();
    return true;
  }

  // An offer shown in the middle of play (rush helpers, cash boost): explain it, then buy.
  offer(id, { title, sub, art }, onGrant, meta = {}) {
    const p = this.product(id);
    if (!p || purchaseMode(this.base) === 'off') return;
    E.log(this.g, 'offer_open', { product: id, ...meta });
    const el = this.ui.openModal(`
      <div class="fd">
        <div class="fd-art">${art || icon(p.icon, 'xl')}</div>
        <div class="modal-title">${title || p.title}</div>
        ${sub ? `<p class="fineprint">${sub}</p>` : ''}
        <button class="btn btn-gold big" data-act="pay">${p.price}</button>
        <button class="btn-link" data-act="no">Not now</button>
      </div>`);
    const dismiss = () => { E.log(this.g, 'offer_dismiss', { product: id, ...meta }); this.ui.closeModal(); };
    el.querySelector('[data-act="no"]').addEventListener('click', dismiss);
    el.querySelector('.modal-scrim').addEventListener('click', dismiss);
    el.querySelector('[data-act="pay"]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = '…';
      this.ui.closeModal();
      await this.buyProduct(id, onGrant, meta);
    });
  }

  openStore() {
    audio.tap();
    E.log(this.g, 'store_open');
    const test = purchaseMode(this.base) === 'test';
    const items = this.base.store.products.filter((p) => !p.hidden);
    const packs = items.filter((p) => p.grant?.cash && !p.oneTime);
    const specials = items.filter((p) => !(p.grant?.cash && !p.oneTime));
    // the starter pack and the second builder both give the extra builder, so owning either covers both
    const owned = (p) => p.oneTime && (this.g.bought?.[p.id] || (p.grant?.builders && (this.g.extraBuilders || 0) >= p.grant.builders));
    const el = this.ui.openSheet(`
      <div class="sheet-head"><div class="sheet-title">${icon('coin')} Store</div><button class="x" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="packs">${packs.map((p, i) => `
        <button class="pack" data-buy="${p.id}">
          ${p.tag ? `<span class="pack-tag">${p.tag}</span>` : ''}
          <span class="pack-art">${Array.from({ length: i + 1 }, () => icon('coin')).join('')}</span>
          <span class="pack-amt">${money(p.grant.cash)}</span>
          <span class="pack-price">${p.price}</span>
        </button>`).join('')}</div>
      <div class="up-list">${specials.map((p) => `
        <div class="up-row ${owned(p) ? 'is-owned' : ''}">
          <div class="up-icon">${icon(p.icon)}</div>
          <div class="up-text"><div class="up-title">${p.title}${p.tag && !owned(p) ? ` <span class="chip sm">${p.tag}</span>` : ''}</div><div class="up-effect">${p.desc || ''}</div></div>
          ${owned(p) ? `<span class="owned">${icon('check')}</span>` : `<button class="btn btn-gold sm" data-buy="${p.id}"><span>${p.price}</span></button>`}
        </div>`).join('')}</div>
      ${test ? '<p class="store-note">Test mode: purchases are free in this prototype. The App Store and Google Play versions charge real money.</p>' : ''}`);
    el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const ok = await this.buyProduct(b.dataset.buy, null, { where: 'store' });
      if (ok) { this.ui.closeSheet(); }
      else b.disabled = false;
    }));
  }

  // ---------- districts (home screen) ----------
  cityProgress(city) {
    let total = 0, done = 0;
    for (const st of city.streets || []) {
      const ss = this.g.streets[st.id];
      for (const p of st.projects) {
        if (p.type === 'unlock') continue;
        total++;
        if (ss?.done[p.id]) done++;
      }
    }
    return { total, done, complete: total > 0 && done === total };
  }

  // A district opens once every project in the district before it is finished.
  cityUnlocked(i) {
    if (i === 0) return true;
    const prev = this.base.cities[i - 1];
    return this.cityProgress(prev).complete;
  }

  openHome(first = false) {
    const home = this.root.querySelector('#home');
    const g = this.g;
    const here = this.cityOf(this.streetId);
    const info = this.base.cities.map((c, i) => {
      const unlocked = this.cityUnlocked(i) && !c.comingSoon;
      const pr = this.cityProgress(c);
      const why = !this.cityUnlocked(i) ? `Finish ${this.base.cities[i - 1].title} to unlock` : 'Coming soon';
      return { unlocked, current: c.id === here?.id, progress: pr.total ? Math.round((100 * pr.done) / pr.total) : 0, why };
    });
    const streets = (here.streets || []).map((st) => {
      const open = !!g.streets[st.id];
      const cur = st.id === this.streetId;
      return `<button class="d-street ${cur ? 'here' : ''} ${open ? '' : 'locked'}" ${open ? `data-street="${st.id}"` : 'disabled'}>${open ? '' : icon('lock')}<span>${st.title}</span>${cur ? '<i>You are here</i>' : ''}</button>`;
    }).join('');
    home.innerHTML = `
      ${worldMapSVG(this.base.cities, info)}
      <div class="home-top">
        ${logoSVG()}
      </div>
      <div class="home-bottom">
        <div class="d-streets">${streets}</div>
        ${first ? '' : `<button class="btn-link home-close" data-act="close">Back to ${this.cfg.street.title}</button>`}
      </div>`;
    home.hidden = false;
    requestAnimationFrame(() => home.classList.add('open'));
    const close = () => { home.classList.remove('open'); setTimeout(() => { home.hidden = true; }, 300); };
    const enterCity = (id) => {
      const i = this.base.cities.findIndex((c) => c.id === id);
      const city = this.base.cities[i];
      audio.unlock();
      if (!info[i].unlocked) {
        audio.deny();
        const el = home.querySelector(`.map-city[data-city="${id}"]`);
        el.classList.remove('shake'); void el.getBoundingClientRect(); el.classList.add('shake');
        this.ui.toast(city.title.toUpperCase(), info[i].why);
        return;
      }
      audio.tap();
      close();
      const target = city.streets.some((s) => s.id === this.streetId) ? this.streetId : city.streets.find((s) => g.streets[s.id])?.id || city.streets[0].id;
      if (target !== this.streetId) setTimeout(() => this.travel(target), 200);
      E.log(g, 'enter_district', { city: id });
    };
    home.querySelectorAll('.map-city').forEach((el) => {
      el.addEventListener('click', () => enterCity(el.dataset.city));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') enterCity(el.dataset.city); });
    });
    home.querySelectorAll('[data-street]').forEach((b) => b.addEventListener('click', () => {
      audio.unlock(); audio.tap();
      close();
      if (b.dataset.street !== this.streetId) setTimeout(() => this.travel(b.dataset.street), 200);
    }));
    home.querySelector('[data-act="close"]')?.addEventListener('click', () => { audio.tap(); close(); });
    this.root.querySelector('#map-btn').classList.remove('hint');
  }

  // ---------- UI: HUD, tiles, anchors, sheets ----------
  bindHud() {
    const r = this.root;
    r.querySelector('#map-btn').innerHTML = ICONS.map;
    r.querySelector('#quest-btn').insertAdjacentHTML('afterbegin', ICONS.quest);
    r.querySelector('#settings-btn').addEventListener('click', () => this.openSettings());
    r.querySelector('#map-btn').addEventListener('click', () => this.openHome());
    r.querySelector('#store-btn').addEventListener('click', () => this.openStore());
    r.querySelector('#quest-btn').addEventListener('click', () => this.openQuests());
    r.querySelector('#zoom-in').addEventListener('click', () => this.zoomTo(this.zoom.level + 1));
    r.querySelector('#zoom-out').addEventListener('click', () => this.zoomTo(this.zoom.level - 1));
    r.querySelector('#shop-prev').addEventListener('click', () => this.cycleShop(-1));
    r.querySelector('#shop-next').addEventListener('click', () => this.cycleShop(1));
    r.querySelector('#rush').addEventListener('click', (e) => { if (e.target.closest('[data-act="helper"]')) this.hireHelpers(); });
    r.querySelector('#card').addEventListener('click', (e) => {
      const tile = e.target.closest('[data-tile]');
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'offer') return this.cashOffer();
      if (tile) this.onTile(tile.dataset.tile);
    });
  }

  renderSideButtons() {
    const r = this.root;
    const started = this.openShops().length > 0 || Object.keys(this.g.streets).length > 1;
    r.querySelector('#quest-btn').hidden = !started;
    r.querySelector('#map-btn').hidden = false;
    const ready = this.g.quests.filter((q) => q.progress >= q.n).length;
    const badge = r.querySelector('#quest-btn .badge');
    badge.textContent = ready || '';
    badge.hidden = !ready;
  }

  onTile(id) {
    const p = this.cfg.projects.find((q) => q.id === id);
    if (!p) return;
    const build = this.s.builds.find((b) => b.kind === 'project' && b.id === p.id);
    if (build) return this.speedUp(build);
    if (p.type === 'task') {
      this.ui.floater('Tap the trash bags', this.anchorScreen(p), 'warn');
      return;
    }
    if (this.zoom.level && p.type !== 'building') this.zoomTo(0);
    this.buyProject(p);
  }

  cashOffer() {
    const m = this.base.monetization;
    const hook = E.availableProjects(this.cfg, this.s).find((p) => p.hook);
    const p = this.product('cash_boost');
    this.offer('cash_boost', { title: 'Cash boost', art: `${icon('coin', 'xl')}<div class="fd-amt">+${money(p.grant.cash)}</div>` }, null, { hook: hook?.id });
  }

  openChoice(p, onPick) {
    const c = this.base.choices[p.choice];
    const el = this.ui.openModal(`
      <div class="modal-title">${c.title}</div>
      <div class="choices">${c.options.map((o) => `
        <button class="choice" data-id="${o.id}">
          <span class="swatch sw-${p.choice} sw-${o.id}" style="${o.color ? `--c:${o.color}` : ''}"></span>
          <span class="choice-label">${o.label}</span>
        </button>`).join('')}
      </div>`);
    el.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
      b.classList.add('picked');
      audio.chime();
      setTimeout(() => { this.ui.closeModal(); onPick(b.dataset.id); }, 260);
    }));
  }

  openMilestone(p) {
    const el = this.ui.openModal(`
      <div class="fd">
        <div class="fd-art">${icon(p.icon, 'xl')}</div>
        <div class="modal-title">The block is coming back!</div>
        <p class="fineprint">You turned a forgotten street into a place people want to be. Next: open Elm Street down the road.</p>
        <button class="btn btn-green big" data-act="ok">Keep playing</button>
      </div>`);
    el.querySelector('[data-act="ok"]').addEventListener('click', () => this.ui.closeModal());
  }

  openSettings() {
    audio.tap();
    const el = this.ui.openSheet(`
      <div class="sheet-head"><div class="sheet-title">Settings</div><button class="x" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="settings">
        <button class="row-btn" data-act="sound">${icon(audio.muted ? 'soundOff' : 'sound', 'dark')}<span>${audio.muted ? 'Sound off' : 'Sound on'}</span></button>
        <button class="row-btn" data-act="stats">${icon('clock', 'dark')}<span>Playtest stats</span></button>
        <button class="row-btn danger" data-act="reset">${icon('close', 'dark')}<span>Start over</span></button>
      </div>`);
    el.querySelector('[data-act="sound"]').addEventListener('click', () => { audio.setMuted(!audio.muted); this.ui.closeSheet(); this.openSettings(); });
    el.querySelector('[data-act="stats"]').addEventListener('click', () => { this.ui.closeSheet(); setTimeout(() => this.openStats(), 230); });
    el.querySelector('[data-act="reset"]').addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (b.dataset.armed) { clear(); this.g = null; location.reload(); return; }
      b.dataset.armed = '1';
      b.querySelector('span').textContent = 'Tap again to erase progress';
    });
  }

  statsSummary() {
    const g = this.g, ev = g.events;
    const find = (type, id) => ev.find((e) => e.type === type && (!id || e.id === id));
    const count = (type) => ev.filter((e) => e.type === type).length;
    const fmt = (t) => (t === undefined ? '—' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
    const hookSeen = find('hook_seen'), hookBought = find('hook_bought');
    const taps = ev.filter((e) => e.type === 'purchase');
    const revenue = taps.reduce((a, e) => a + (parseFloat(String(e.price || '').replace(/[^0-9.]/g, '')) || 0), 0);
    return {
      playTime: fmt(g.playSeconds),
      earned: Math.floor(g.earned),
      lost: Math.floor(g.lost || 0),
      served: g.served,
      streets: Object.keys(g.streets).length,
      cafeBoughtAt: fmt(find('buy_project', 'cafe')?.t),
      pressureAt: fmt(find('pressure_start')?.t),
      bakeryCardAt: fmt(hookSeen?.t),
      bakeryBoughtAt: fmt(hookBought?.t),
      waitedForBakery: hookSeen && hookBought ? fmt(hookBought.t - hookSeen.t) : '—',
      speedupOpened: count('speedup_open'),
      adsWatched: count('ad_watched'),
      vipsServed: count('vip_served'),
      goalsClaimed: count('quest_claim'),
      firstPurchaseAt: fmt(taps[0]?.t),
      purchases: taps.length,
      wouldBeRevenue: `$${revenue.toFixed(2)}`,
      offersDismissed: count('offer_dismiss'),
      storeOpened: count('store_open'),
      purchasedItems: taps.map((e) => e.product),
    };
  }

  openStats() {
    const st = this.statsSummary();
    const rows = [
      ['Play time', st.playTime], ['Earned', money(st.earned)], ['Lost to waiting', money(st.lost)], ['Customers served', st.served],
      ['Streets unlocked', st.streets], ['Bought café at', st.cafeBoughtAt], ['Pressure started at', st.pressureAt],
      ['Bakery appeared at', st.bakeryCardAt], ['Bought bakery at', st.bakeryBoughtAt], ['Waited for bakery', st.waitedForBakery],
      ['Opened speed-up', st.speedupOpened], ['Ads watched', st.adsWatched], ['VIPs served', st.vipsServed], ['Goals claimed', st.goalsClaimed],
      ['Store opened', st.storeOpened], ['First purchase at', st.firstPurchaseAt], ['Purchases', st.purchases], ['Would-be revenue', st.wouldBeRevenue], ['Offers dismissed', st.offersDismissed],
    ];
    const el = this.ui.openSheet(`
      <div class="sheet-head"><div class="sheet-title">Playtest stats</div><button class="x" data-close aria-label="Close">${icon('close')}</button></div>
      <dl class="stats-list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <button class="btn btn-blue" data-act="copy">Copy full log</button>`);
    el.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
      const text = JSON.stringify({ summary: st, events: this.g.events }, null, 1);
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Copy blocked here'; }
    });
  }

  renderShopSheet() {
    const shop = this.sheetShop;
    if (!shop) return;
    const s = this.s, cfg = this.cfg, sc = cfg.shops[shop];
    const list = this.ui.sheet.querySelector('.up-list');
    if (!list) return;
    const firstOpen = sc.upgrades.findIndex((u) => !s.owned[E.upKey(shop, u.id)]);
    list.innerHTML = sc.upgrades.map((u, i) => {
      const key = E.upKey(shop, u.id);
      const build = s.builds.find((b) => b.kind === 'upgrade' && b.id === u.id && b.shop === shop);
      let right;
      if (s.owned[key]) right = `<span class="owned">${icon('check')}</span>`;
      else if (build) right = `<button class="btn btn-blue sm skip" data-skip="${u.id}">${icon('clock')}<span class="tleft" data-tl="${u.id}">${clock((build.endsAt - Date.now()) / 1000)}</span></button>`;
      else if (i > firstOpen) right = `<span class="locked">${icon('lock')}</span>`;
      else right = `<button class="btn ${this.g.cash >= u.cost ? 'btn-green' : 'btn-dim'} sm" data-buy="${u.id}">${icon('coin')}<span>${money(u.cost)}</span></button>`;
      return `<div class="up-row ${s.owned[key] ? 'is-owned' : ''}">
        <div class="up-icon">${icon(u.icon)}</div>
        <div class="up-text"><div class="up-title">${u.title}</div><div class="up-effect">${u.effectLabel || ''}${u.buildSeconds ? ` · ${clock(u.buildSeconds)}` : ''}</div></div>
        ${right}</div>`;
    }).join('');
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => this.buyUpgrade(shop, sc.upgrades.find((u) => u.id === b.dataset.buy))));
    list.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => {
      const bd = s.builds.find((x) => x.kind === 'upgrade' && x.id === b.dataset.skip && x.shop === shop);
      if (bd) { this.ui.closeSheet(() => { this.sheetShop = null; }); setTimeout(() => this.speedUp(bd), 230); }
    }));
    const chips = this.ui.sheet.querySelector('.chips');
    const rate = E.staffRate(cfg, s, shop);
    if (chips) chips.innerHTML = `<span class="chip">${icon(sc.icon)}${money(E.price(cfg, s, shop))}</span><span class="chip">${icon('clock')}${E.customerInterval(cfg, s, shop).toFixed(1)}s</span>${rate ? `<span class="chip">${icon('register')}${money(E.registerCap(cfg, s, shop))} max</span>` : ''}`;
    this.sheetKey = this.shopSheetKey();
  }

  shopSheetKey() {
    const shop = this.sheetShop;
    if (!shop) return '';
    return this.cfg.shops[shop].upgrades.map((u) => (this.g.cash >= u.cost ? 1 : 0)).join('') + this.s.builds.length + Object.keys(this.s.owned).length;
  }

  openShopSheet(shop) {
    audio.tap();
    this.sheetShop = shop;
    const sc = this.cfg.shops[shop];
    this.ui.openSheet(`
      <div class="sheet-head"><div class="sheet-title">${icon(sc.icon)} ${sc.title}</div><button class="x" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="chips"></div>
      <div class="up-list"></div>`, () => { this.sheetShop = null; });
    this.renderShopSheet();
  }

  updateTiles() {
    const s = this.s, cfg = this.cfg, g = this.g;
    const cafe = cfg.projects.find((p) => p.id === 'cafe');
    if (cafe && !s.done.cafe && g.cash < cafe.cost && !E.isBuilding(s, 'project', 'cafe')) {
      this.ui.setCard('mow', `
        <div class="card-inner">
          <div class="card-icon">${icon('coin')}</div>
          <div class="card-body"><div class="card-title">Mow the lawn</div><div class="bar"><i></i></div></div>
          <div class="count"></div>
        </div>`);
      this.ui.updateCard({ '.bar i': (el) => { el.style.width = `${Math.min(100, (100 * g.cash) / cafe.cost)}%`; }, '.count': (el) => { el.textContent = `${money(g.cash)}/${money(cafe.cost)}`; } });
      return;
    }
    const list = E.availableProjects(cfg, s).slice(0, 4);
    const hook = list.find((p) => p.hook);
    if (hook && !g.events.some((e) => e.type === 'hook_seen' && e.id === hook.id)) E.log(g, 'hook_seen', { id: hook.id });
    if (!list.length) {
      this.ui.setCard('done', `<div class="card-inner"><div class="card-icon">${icon('map')}</div><div class="card-body"><div class="card-title">This street is restored! More are coming.</div></div></div>`);
      return;
    }
    const m = this.base.monetization;
    const offer = hook && this.paidOffersOn() && m.cashOffer.enabled && g.cash < hook.cost && g.cash >= hook.cost * m.cashOffer.showWhenCashFraction;
    const busy = E.buildersBusy(s) >= this.builderCount();
    const state = (p) => {
      if (s.builds.some((b) => b.kind === 'project' && b.id === p.id)) return 'build';
      if (p.type === 'task') return 'task';
      if (busy && p.buildSeconds > 0) return 'busy';
      return g.cash >= p.cost ? 'ready' : 'save';
    };
    const key = list.map((p) => `${p.id}:${state(p)}`).join(',') + `|${offer ? 1 : 0}`;
    this.ui.setCard(key, `
      ${offer ? `<button class="offer" data-act="offer">${icon('coin')}<span>+${money(this.product('cash_boost').grant.cash)}</span><b>${this.product('cash_boost').price}</b></button>` : ''}
      <div class="tiles">${list.map((p) => {
        const st = state(p);
        const foot = st === 'build' ? `${icon('clock')}<span class="tl"></span>`
          : st === 'task' ? '<span class="tl"></span>'
          : st === 'busy' ? `${icon('clock')}<span>Busy</span>`
          : `${icon('coin')}<span>${price$(p.cost)}</span>`;
        return `<button class="tile ${st} ${p.hook ? 'hook' : ''}" data-tile="${p.id}" aria-label="${p.title}">
          <span class="tile-fill"></span>
          <span class="tile-icon">${icon(p.icon)}</span>
          <span class="tile-name">${p.title}</span>
          <span class="tile-foot">${foot}</span>
          ${st === 'build' ? `<span class="tile-speed">${icon('play')}</span>` : ''}
        </button>`;
      }).join('')}</div>`);
    for (const p of list) {
      const el = this.ui.card.querySelector(`[data-tile="${p.id}"]`);
      if (!el) continue;
      const st = state(p);
      let pct = 0;
      if (st === 'build') {
        const b = s.builds.find((x) => x.kind === 'project' && x.id === p.id);
        const left = (b.endsAt - Date.now()) / 1000;
        pct = 100 * (1 - left / b.total);
        const tl = el.querySelector('.tl'); const t = clock(left); if (tl.textContent !== t) tl.textContent = t;
      } else if (st === 'task') {
        const n = s.trashCleared.length, total = this.street.trash.length;
        pct = (100 * n) / total;
        el.querySelector('.tl').textContent = `${n}/${total}`;
      } else if (p.cost) pct = Math.min(100, (100 * g.cash) / p.cost);
      else pct = 100;
      el.style.setProperty('--p', `${pct}%`);
    }
  }

  updateAnchors() {
    const s = this.s, cfg = this.cfg, ui = this.ui, g = this.g;
    ui.beginAnchors();
    const avail = E.availableProjects(cfg, s);

    // price tags over every building that's for sale
    for (const b of Object.values(this.buildings)) b.setHighlight(false);
    for (const p of avail) {
      if (p.type !== 'building' || E.isBuilding(s, 'project', p.id)) continue;
      const b = this.buildings[p.building];
      if (!b) continue;
      const afford = g.cash >= p.cost;
      b.setHighlight(p.hook || afford);
      ui.anchor(`tag:${p.id}`, `<div class="tag ${afford ? 'go' : ''} ${p.hook ? 'gold' : ''}">${afford ? '<b>BUY</b>' : icon('lock')}<span>${price$(p.cost)}</span></div>`,
        () => b.anchor(), { onTap: () => this.buyProject(p), cls: 'center-bottom' });
    }

    const pressure = this.pressureOn();
    for (const [id, sh] of Object.entries(this.shops)) {
      if (!E.shopOpen(cfg, s, id)) continue;
      // upgrade button / upgrade timer
      const u = E.nextUpgrade(cfg, s, id);
      const ub = s.builds.find((b) => b.kind === 'upgrade' && b.shop === id);
      if (ub) {
        const left = (ub.endsAt - Date.now()) / 1000;
        ui.anchor(`up:${id}`, `<div class="timer">${icon('clock')}<span>${clock(left)}</span><b class="skip">${icon('play')}</b></div>`,
          () => sh.b.anchor(), { onTap: () => this.speedUp(ub), cls: 'center-bottom' });
      } else if (u) {
        const afford = g.cash >= u.cost;
        ui.anchor(`up:${id}`, `<div class="upbtn ${afford ? 'ready' : ''}">${icon('up')}${afford ? '<i class="dot"></i>' : ''}</div>`,
          () => sh.b.anchor(), { onTap: () => this.openShopSheet(id), cls: 'center-bottom' });
      }
      // register: staff sales wait here until the player collects them
      const reg = s.registers[id] || 0;
      if (E.autoServe(cfg, s, id) || reg >= 1) {
        const cap = E.registerCap(cfg, s, id);
        const full = reg >= cap;
        ui.anchor(`reg:${id}`, `<div class="register ${full ? 'full' : ''} ${reg >= 1 ? 'has' : ''}">${icon('register')}<span>${full ? 'FULL' : money(reg)}</span></div>`,
          () => V(sh.b.style.x + 0.62, 1.4, FACADE_Z + 0.5), { onTap: () => this.collectRegister(id), cls: 'center-bottom', vars: { '--f': Math.min(1, reg / cap).toFixed(3) } });
      }
      // order bubbles, with a patience ring once the street is busy
      for (const c of sh.customers) {
        if (c.state === 'wait' || (c.state === 'approach' && c.slot === 0)) {
          const ready = c.slot === 0 && sh.ready && sh.readyMesh.visible;
          const pat = pressure ? Math.max(0, 1 - c.wait / this.base.pressure.patienceSeconds) : 1;
          const urgent = pressure && pat < 0.35;
          ui.anchor(`cust:${c.p.root.id}`, `<div class="bubble ${ready ? 'ready' : ''} ${urgent ? 'urgent' : ''}">${icon(sh.sc.icon)}</div>`,
            () => c.p.headWorld().add(V(0, 0.42, 0)), { onTap: () => this.shopTap(id), cls: 'center-bottom', vars: { '--pat': pressure ? pat.toFixed(3) : 1 } });
        }
        if (c.state === 'leave' && c.mood && c.moodT < 1.2) {
          ui.anchor(`mood:${c.p.root.id}`, `<div class="${c.mood === 'angry' ? 'angry' : 'heart'}"></div>`, () => c.p.headWorld().add(V(0, 0.4 + c.moodT * 0.6, 0)), { cls: 'center-bottom' });
        }
      }
      if (sh.brew) {
        ui.anchor(`brew:${id}`, `<div class="ring">${icon(sh.sc.icon)}</div>`,
          () => sh.b.machineTop(), { cls: 'center-bottom', vars: { '--p': (sh.brew.t / sh.brew.dur).toFixed(3) } });
      }
    }

    // VIP
    if (this.vip && this.vip.state === 'wait') {
      const pat = Math.max(0, 1 - this.vip.wait / this.base.vip.patienceSeconds);
      ui.anchor('vip', `<div class="bubble vip">${icon('star')}</div>`,
        () => this.vip.p.headWorld().add(V(0, 0.5, 0)), { onTap: () => this.serveVip(), cls: 'center-bottom', vars: { '--pat': pat.toFixed(3) } });
    }

    // lawn regrowth timer
    if (s.lawnRegrowAt && this.grass.cutCount() > 0) {
      const left = (s.lawnRegrowAt - Date.now()) / 1000;
      ui.anchor('grass', `<div class="timer grass-timer">${icon('tree')}<span>${clock(left)}</span><b class="skip">${icon('play')}</b></div>`,
        () => V(0, 0.2, ZONES.lawn.z1 + 0.35), { onTap: () => this.speedUpGrass(), cls: 'center-bottom' });
    }

    // street project build timers
    for (const b of s.builds) {
      if (b.kind !== 'project') continue;
      const proj = cfg.projects.find((q) => q.id === b.id);
      if (!proj) continue;
      const left = (b.endsAt - Date.now()) / 1000;
      ui.anchor(`build:${b.id}`, `<div class="timer">${icon('clock')}<span>${clock(left)}</span><b class="skip">${icon('play')}</b></div>`,
        () => this.projectSpot(proj), { onTap: () => this.speedUp(b), cls: 'center-bottom' });
    }
    ui.placeAnchors(this.stage);

    // tutorial hand (first street only)
    const L = ZONES.lawn;
    const cafeP = cfg.projects.find((p) => p.id === 'cafe');
    const cafe = this.shops.cafe;
    if (cafeP && this.zoom.level === 0 && !s.done.cafe && g.cash < cafeP.cost && this.cutsThisSession < 10 && !s.lawn?.includes('1')) {
      const zm = (L.z0 + L.z1) / 2 + 0.6;
      ui.hand('swipe', this.stage.toScreen(V(L.x0 + 0.6, 0, zm)), this.stage.toScreen(V(L.x1 - 0.6, 0, zm - 0.6)));
    } else if (cafeP && !s.done.cafe && g.cash >= cafeP.cost && !E.isBuilding(s, 'project', 'cafe')) {
      const xy = this.stage.toScreen(this.buildings.cafe.anchor());
      ui.hand('tap', { x: xy.x + 30, y: xy.y + 4 });
    } else if (g.tutorial === 'serve' && cafe && s.done.cafe && this.front(cafe) && !cafe.brew) {
      const xy = this.stage.toScreen(this.buildings.cafe.machineTop());
      ui.hand('tap', { x: xy.x + 18, y: xy.y + 26 });
    } else ui.hand(null);
  }

  // ---------- loop ----------
  update(dtReal) {
    const dt = dtReal * this.timeScale;
    const g = this.g;
    g.playSeconds += dt;
    this.time += dt;
    this.stage.update(dtReal);
    this.grass.update(dt);
    if (this.s.lawnRegrowAt && Date.now() >= this.s.lawnRegrowAt) {
      this.s.lawnRegrowAt = null;
      if (this.grass.regrowAll()) {
        this.ui.floater('The grass grew back!', this.stage.toScreen(V(0, 0.6, 3.2)), 'praise small');
        audio.chime();
      }
    }
    this.street.update(dt);
    for (const b of Object.values(this.buildings)) b.update(dt, this.time);
    this.fx.update(dt);
    this.mower.update(dt);
    this.walkers.update(dt);
    this.updatePressure();
    this.renderRush();
    this.updateHelpers();
    this.updateShops(dt);
    this.updateVip(dt);
    this.updateLitter(dt);
    this.updateBuilds();
    this.updatePassive(dt);
    if (!g.quests.length) { this.fillQuests(); if (g.quests.length) this.renderSideButtons(); }
    this.updateTiles();
    this.updateAnchors();
    this.ui.tickCash(dtReal);
    if (this.sheetShop) {
      const key = this.shopSheetKey();
      if (key !== this.sheetKey) this.renderShopSheet();
      this.ui.sheet.querySelectorAll('[data-tl]').forEach((el) => {
        const b = this.s.builds.find((x) => x.kind === 'upgrade' && x.id === el.dataset.tl && x.shop === this.sheetShop);
        if (b) el.textContent = clock((b.endsAt - Date.now()) / 1000);
      });
    }
    if (!this.zoomHintShown && this.openShops().length >= 1 && g.served >= 3 && this.zoom.level === 0) {
      this.zoomHintShown = true;
      this.root.querySelector('#zoom-in').classList.add('hint');
      setTimeout(() => this.root.querySelector('#zoom-in').classList.remove('hint'), 6000);
    }
    this.saveT += dtReal;
    if (this.saveT > 3) { this.saveT = 0; this.persist(); }
  }

  render() { this.stage.render(); }
}
