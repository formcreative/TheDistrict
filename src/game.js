import * as THREE from 'three';
import * as E from './economy.js';
import { audio } from './audio.js';
import { load, save, clear } from './save.js';
import { Stage, STREET_VIEW, shopView } from './scene/stage.js';
import { Street, ZONES } from './scene/street.js';
import { Building, framingBuildings, FACADE_Z, STYLES } from './scene/buildings.js';
import { Grass, TALL, LUSH } from './scene/grass.js';
import { Person, Walkers } from './scene/people.js';
import { FX3D } from './scene/fx.js';
import { Mower } from './scene/mower.js';
import { UI, money, clock, icon } from './ui/ui.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WALK_Z = -4.3;

// Where timers and effects show for street projects that aren't buildings.
const PROJECT_SPOTS = {
  trash: V(0, 0.6, 3.2),
  sidewalk: V(0, 0.5, -0.5),
  landscaping: V(-3.55, 1.4, 3.6),
  streetlights: V(0, 2.5, -1.0),
  repave: V(0, 0.4, -2.6),
};

export class Game {
  constructor(cfg, root, canvas, opts = {}) {
    this.cfg = cfg;
    this.opts = opts;
    this.root = root;
    this.stage = new Stage(canvas);
    const scene = this.stage.scene;
    this.street = new Street(scene);
    framingBuildings(scene);
    this.buildings = {};
    for (const id of Object.keys(STYLES)) this.buildings[id] = new Building(scene, id);
    this.grass = new Grass(scene);
    this.fx = new FX3D(scene, this.stage);
    this.mower = new Mower(scene);
    this.walkers = new Walkers(scene);
    this.ui = new UI(root);

    this.s = Object.assign(E.createState(cfg), load() || {});
    this.shops = {};
    for (const id of E.shopIds(cfg)) {
      if (!this.buildings[id]) continue;
      this.shops[id] = { id, sc: cfg.shops[id], b: this.buildings[id], customers: [], spawnT: 1, brew: null, ready: false, staff: [], helpers: [], readyMesh: this.makeReadyItem(id) };
    }
    this.zoom = { level: 0, shop: 'cafe' };
    this.rush = null;
    this.nextRushAt = null;
    this.helperUntil = 0;
    this.passive = {};
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

    this.restoreWorld();
    this.bindInput(canvas);
    this.bindHud();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(); });
    window.addEventListener('pagehide', () => this.persist());
    E.log(this.s, 'session_start');
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

  // ---------- layout / persistence ----------
  layout() {
    const top = this.root.querySelector('#topbar').getBoundingClientRect().height + 8;
    const bottom = Math.max(this.root.querySelector('#card').getBoundingClientRect().height, 96) + 18;
    this.stage.resize(top, bottom);
    this.applyZoom(true);
  }

  persist() {
    this.s.lawn = this.grass.serialize();
    save(this.s);
  }

  restoreWorld() {
    const s = this.s;
    this.grass.restore(s.lawn);
    for (const p of this.cfg.projects) if (s.done[p.id]) this.applyProject(p, false);
    for (const [id, sh] of Object.entries(this.shops)) {
      for (const u of sh.sc.upgrades) if (s.owned[E.upKey(id, u.id)]) this.applyUpgrade(id, u, false);
    }
    for (const b of s.builds) this.constructionVisual(b, true);
    for (const id of s.trashCleared) this.street.clearTrash(id);
    this.updateWalkers();
    this.ui.setCash(s.cash, E.incomePerSecond(this.cfg, s));
    this.ui.shown = s.cash;
  }

  // ---------- money ----------
  addCash(v) {
    this.s.cash += v;
    this.s.earned += v;
    this.ui.setCash(this.s.cash, E.incomePerSecond(this.cfg, this.s));
    this.ui.bumpCash();
  }

  spend(v) {
    this.s.cash -= v;
    this.ui.setCash(this.s.cash, E.incomePerSecond(this.cfg, this.s));
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

  monetizationOn() {
    return this.cfg.monetization.mode !== 'off' && E.pressureActive(this.cfg, this.s);
  }

  // ---------- zoom ----------
  openShops() { return Object.keys(this.shops).filter((id) => E.shopOpen(this.cfg, this.s, id)); }

  zoomTo(level, shop = this.zoom.shop) {
    const open = this.openShops();
    if (level > 0 && !open.length) return;
    if (level > 0 && !open.includes(shop)) shop = open.includes(this.zoom.shop) ? this.zoom.shop : open[0];
    level = Math.max(0, Math.min(2, level));
    if (level === this.zoom.level && shop === this.zoom.shop) return;
    this.zoom = { level, shop };
    if (level > 0) E.log(this.s, 'zoom', { level, shop });
    audio.tap();
    this.applyZoom(false);
  }

  applyZoom(instant) {
    const z = this.zoom;
    this.stage.setFocus(z.level ? shopView(STYLES[z.shop].x, z.level) : STREET_VIEW, instant);
    this.root.classList.toggle('zoomed', z.level > 0);
    const label = this.root.querySelector('#zoom-label');
    if (label) label.textContent = z.level ? this.cfg.shops[z.shop].title : '';
    const open = this.openShops();
    this.root.querySelector('#shop-prev').hidden = !(z.level && open.length > 1);
    this.root.querySelector('#shop-next').hidden = !(z.level && open.length > 1);
    this.root.querySelector('#zoom-in').hidden = z.level >= 2 || !open.length;
    this.root.querySelector('#zoom-out').hidden = z.level === 0;
  }

  cycleShop(dir) {
    const open = this.openShops().sort((a, b) => STYLES[a].x - STYLES[b].x);
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
        // second finger: switch from mowing to pinch-zoom
        this.mower.stop();
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), done: false };
        this.pointer = null;
        return;
      }
      const gp = this.stage.groundPoint(e.clientX, e.clientY);
      this.pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, mowing: false, last: gp };
      if (gp && this.zoom.level === 0 && this.inLawn(gp)) this.startMow(gp);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const ratio = Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d0;
        if (!this.pinch.done && ratio > 1.3) { this.pinch.done = true; this.zoomTo(this.zoom.level + 1, this.shopNearScreen((a.x + b.x) / 2)); }
        if (!this.pinch.done && ratio < 0.75) { this.pinch.done = true; this.zoomTo(this.zoom.level - 1); }
        return;
      }
      const p = this.pointer;
      if (!p || p.id !== e.pointerId) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        p.moved += Math.hypot(ev.clientX - p.x, ev.clientY - p.y);
        p.x = ev.clientX; p.y = ev.clientY;
        if (this.zoom.level) continue;
        const gp = this.stage.groundPoint(ev.clientX, ev.clientY);
        if (!gp) continue;
        if (!p.mowing && p.moved > 10 && this.inLawn(gp)) this.startMow(gp);
        if (p.mowing && p.last) {
          const g = this.cfg.grass;
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
      if (this.pinch) { if (this.pointers.size === 0) this.pinch = null; return; }
      const p = this.pointer;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
      if (!p.mowing && this.zoom.level && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.cycleShop(dx < 0 ? 1 : -1);
      else if (!p.mowing && p.moved < 14) this.tap(e.clientX, e.clientY);
      this.mower.stop();
      this.pointer = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
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
    const g = this.cfg.grass;
    this.fx.clippings(t.x, t.z, t.lush ? LUSH : TALL);
    if (t.lush) {
      this.grassBank += g.regrownValue;
      if (this.grassBank >= 1) { this.grassBank -= 1; this.fx.coin(t.x, 0.2, t.z, 1, (xy, v) => this.flyCoin(xy, v)); }
    } else {
      const n = weed ? g.weedCoins : 1;
      for (let i = 0; i < n; i++) this.fx.coin(t.x, 0.2, t.z, g.coinValue, (xy, v) => this.flyCoin(xy, v), i * 0.05);
    }
    if (weed) this.fx.sparkle(t.x, 0.5, t.z, 4, 0.3);
    audio.snip();
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
    const targets = [...Object.values(this.buildings).map((b) => b.root), ...this.street.tapTargets, ...custs];
    const hit = this.stage.pick(cx, cy, targets);
    if (!hit) return;
    const t = hit.userData.tap;
    if (t.type === 'trash') return this.tapTrash(t.id, hit);
    if (t.type === 'customer') return this.shopTap(t.shop);
    if (t.type === 'building') {
      const b = this.buildings[t.id];
      if (this.shops[t.id] && E.shopOpen(this.cfg, this.s, t.id)) {
        // double-tap a shop to zoom into it
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

  shopTap(id) {
    const sh = this.shops[id];
    if (!sh || !E.shopOpen(this.cfg, this.s, id)) return;
    if (this.staffed(id)) { sh.b.anim = { t: 1.4 }; audio.tap(); return; }
    if (sh.ready) return this.serve(sh);
    if (!sh.brew && this.front(sh)) return this.startBrew(sh, sh.sc.serveSeconds);
    if (!sh.brew) { sh.b.anim = { t: 1.4 }; audio.tap(); }
  }

  startBrew(sh, dur) {
    sh.brew = { t: 0, dur };
    if (sh.id === 'cafe') audio.brew(); else audio.pop();
  }

  serve(sh) {
    const c = this.front(sh);
    if (!c) return;
    sh.ready = false;
    sh.readyMesh.visible = false;
    c.p.hold(sh.sc.item);
    const price = E.price(this.cfg, this.s, sh.id);
    const head = c.p.headWorld();
    this.popCoins(V(head.x, 0.9, head.z + 0.1), price, Math.min(4, Math.ceil(price / 5)));
    this.ui.floater(`+${money(price)}`, this.stage.toScreen(V(head.x, head.y + 0.6, head.z)), 'cash');
    this.fx.sparkle(head.x, head.y + 0.2, head.z, 5, 0.4);
    this.s.served++;
    if (this.s.tutorial === 'serve') { this.s.tutorial = 'done'; E.log(this.s, 'tutorial_done'); }
    this.leave(sh, c, false);
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
    const pressure = E.pressureActive(cfg, s);
    const rushRate = this.rush ? cfg.pressure.rush.customerRate : 1;
    for (const [id, sh] of Object.entries(this.shops)) {
      if (!E.shopOpen(cfg, s, id)) continue;
      const auto = this.staffed(id);
      const active = sh.customers.filter((c) => c.state !== 'leave').length;
      sh.spawnT -= dt;
      if (sh.spawnT <= 0) {
        if (active < sh.sc.maxQueue) {
          this.spawnCustomer(sh);
        } else if (pressure) {
          // queue is full: this customer walks past, and the player sees the sale they missed
          this.loseSale(sh, this.slotPos(sh, sh.sc.maxQueue));
        }
        sh.spawnT = E.customerInterval(cfg, s, id, rushRate) * (0.75 + Math.random() * 0.5);
      }
      for (let i = sh.customers.length - 1; i >= 0; i--) {
        const c = sh.customers[i];
        c.p.update(dt);
        if (c.state === 'approach' && !c.p.moving) { c.state = 'wait'; c.p.face(c.p.pos.x, c.p.pos.z - 1); }
        if (c.state === 'wait' || c.state === 'approach') {
          c.wait += dt;
          if (pressure && c.wait > cfg.pressure.patienceSeconds && !(c.slot === 0 && (sh.brew || sh.ready))) {
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
          sh.brew = null;
          sh.ready = true;
          if (auto) this.serve(sh);
          else { sh.readyMesh.visible = true; audio.ding(); }
        }
      } else if (auto && sh.ready) {
        this.serve(sh);
      } else if (auto && this.front(sh)) {
        const boost = this.time < this.helperUntil ? cfg.monetization.rushHelper.speedMultiplier : 1;
        this.startBrew(sh, E.staffSeconds(cfg, s, id) / boost);
      }
      for (const st of [...sh.staff, ...sh.helpers]) {
        st.update(dt);
        st.body.position.y = sh.brew ? Math.abs(Math.sin(this.time * 14)) * 0.03 : 0;
      }
    }
  }

  loseSale(sh, world) {
    const v = E.price(this.cfg, this.s, sh.id);
    this.s.lost += v;
    if (this.rush) this.rush.lost += v;
    this.ui.floater(`-${money(v)}`, this.stage.toScreen(world.clone().add(V(0, 0.5, 0))), 'lost');
    audio.deny();
    E.log(this.s, 'lost_sale', { shop: sh.id, value: v });
  }

  // ---------- pressure: rush hour + helpers ----------
  updatePressure() {
    const cfg = this.cfg, s = this.s;
    if (!E.pressureActive(cfg, s)) return;
    if (s.pressureStartedAt === null) {
      s.pressureStartedAt = s.playSeconds;
      E.log(s, 'pressure_start');
      this.ui.toast('BUSY STREET!', 'Customers won\'t wait forever now');
    }
    if (this.nextRushAt === null) this.nextRushAt = s.playSeconds + cfg.pressure.rush.firstAfterSeconds;
    if (!this.rush && s.playSeconds >= this.nextRushAt) {
      this.rush = { until: s.playSeconds + cfg.pressure.rush.durationSeconds, lost: 0, helped: false };
      this.nextRushAt = s.playSeconds + cfg.pressure.rush.everySeconds;
      E.log(s, 'rush_start');
      audio.fanfare();
      this.ui.toast('RUSH HOUR!', 'Serve fast or lose customers');
    }
    if (this.rush && s.playSeconds >= this.rush.until) {
      const lost = this.rush.lost;
      E.log(s, 'rush_end', { lost });
      if (lost > 0) this.ui.toast('RUSH OVER', `You lost ${money(lost)} to waiting customers`);
      else this.ui.toast('PERFECT RUSH!', 'Nobody left unhappy');
      this.rush = null;
    }
    this.renderRush();
  }

  renderRush() {
    const el = this.root.querySelector('#rush');
    if (!this.rush) { el.hidden = true; return; }
    el.hidden = false;
    const left = this.rush.until - this.s.playSeconds;
    const helper = this.cfg.monetization.rushHelper;
    const showHelper = helper.enabled && this.monetizationOn() && !this.rush.helped;
    const key = `${Math.ceil(left)}|${this.rush.lost}|${showHelper}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = `
      <div class="rush-pill">${icon('clock')}<span>RUSH ${clock(left)}</span>${this.rush.lost ? `<b class="rush-lost">-${money(this.rush.lost)}</b>` : ''}</div>
      ${showHelper ? `<button class="rush-help" data-act="helper">${icon('barista')}<span>Helpers</span><b>${helper.priceLabel}</b></button>` : ''}`;
  }

  hireHelpers() {
    if (!this.rush) return;
    this.fakeDoor('helper', 'rush_helper', () => {
      this.rush.helped = true;
      this.helperUntil = this.time + (this.rush.until - this.s.playSeconds);
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
    if (!this.s.done.cafe) {
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
    this.popCoins(V(pos.x, 0.3, pos.z), this.cfg.trash.rewardPerPile, 2);
    this.ui.floater(`+${money(this.cfg.trash.rewardPerPile)}`, this.stage.toScreen(V(pos.x, 0.9, pos.z)), 'cash');
    if (this.s.trashCleared.length >= this.street.trash.length && !this.s.done.trash) {
      const p = this.cfg.projects.find((q) => q.id === 'trash');
      if (p) this.completeProject(p);
    }
  }

  // ---------- projects ----------
  buyProject(p) {
    const s = this.s;
    if (s.done[p.id] || E.isBuilding(s, 'project', p.id) || p.type === 'task') return;
    if (s.cash < p.cost) {
      audio.deny();
      this.ui.floater(`Need ${money(p.cost - s.cash)} more`, this.anchorScreen(p), 'warn');
      return;
    }
    this.spend(p.cost);
    E.log(s, 'buy_project', { id: p.id, cost: p.cost });
    if (p.hook) E.log(s, 'hook_bought', { id: p.id });
    audio.tap();
    if (p.choice) this.openChoice(p, (choiceId) => { s.choices[p.choice] = choiceId; E.log(s, 'choice', { id: p.choice, value: choiceId }); this.startProjectBuild(p); });
    else this.startProjectBuild(p);
    if (s.tutorial === 'mow') s.tutorial = 'serve';
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
    E.log(s, 'complete_project', { id: p.id });
    const titles = { cafe: ['CAFÉ OPEN!', 'Tap the café to serve'], trash: ['SPOTLESS!', 'The street is clean'], flowershop: ['FLOWER SHOP OPEN!', 'Run two shops at once'], bakery: ['BAKERY OPEN!', 'Fresh croissants every morning'], boutique: ['BOUTIQUE OPEN!', ''] };
    const [t, sub] = titles[p.id] || [`${p.title.toUpperCase()}!`, ''];
    this.ui.toast(t, sub);
    this.updateWalkers();
    if (p.shop && this.shops[p.shop]) this.shops[p.shop].spawnT = 0.6;
    if (p.hook) setTimeout(() => this.openMilestone(p), 1600);
    this.ui.setCash(s.cash, E.incomePerSecond(this.cfg, s));
    this.applyZoom(false);
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
    if (p.id === 'trash') {
      this.street.trash.forEach((_, i) => this.street.clearTrash(i));
    } else if (p.id === 'sidewalk') {
      this.street.setPaving(s.choices.pavement || 'brick');
    } else if (p.id === 'landscaping') {
      const opt = this.cfg.choices.flowers.options.find((o) => o.id === s.choices.flowers) || this.cfg.choices.flowers.options[0];
      this.street.setLandscaping(opt.color);
    } else if (p.id === 'streetlights') {
      this.street.setLights(true);
    } else if (p.id === 'repave') {
      this.street.setRoad(true);
    }
  }

  projectSpot(p) {
    if (p.type === 'building') return this.buildings[p.building].anchor(1.4);
    return (PROJECT_SPOTS[p.id] || V(0, 0.5, 0)).clone();
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
    if (s.cash < u.cost) { audio.deny(); return; }
    this.spend(u.cost);
    E.log(s, 'buy_upgrade', { id: key, cost: u.cost });
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
    this.ui.toast(u.title.toUpperCase(), u.effectLabel || '');
    E.log(s, 'complete_upgrade', { id: E.upKey(shop, u.id) });
    this.ui.setCash(s.cash, E.incomePerSecond(this.cfg, s));
    this.persist();
    this.renderShopSheet();
  }

  applyUpgrade(shop, u, animate) {
    const e = u.effect || {};
    const sh = this.shops[shop];
    const b = this.buildings[shop];
    if (sh && (e.autoServe || e.staffSpeed)) {
      const shirts = { cafe: '#2fb5a8', flowershop: '#3f8a5a', bakery: '#f2a03a' };
      const p = new Person(this.stage.scene, { shirt: shirts[shop] || '#2fb5a8', apron: true, scale: 1 }).place(b.style.x - 0.75 + sh.staff.length * 0.5, 0.12, FACADE_Z + 0.22);
      sh.staff.push(p);
    }
    if (e.decor) {
      b.setDecor(e.decor, true);
      if (e.decor === 'seating' || e.decor === 'tables') {
        const x0 = b.style.x + (e.decor === 'seating' ? -1.2 : 1.12);
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
    const pc = this.cfg.pedestrians;
    const done = Object.keys(this.s.done).length;
    this.walkers.setCount(Math.min(pc.max, pc.base + pc.perCompletedProject * done));
  }

  // ---------- fake-door monetization ----------
  fakeDoor(kind, item, onGrant) {
    const m = this.cfg.monetization;
    if (m.mode === 'off') return;
    E.log(this.s, 'fake_door_open', { kind, item });
    const art = kind === 'cash' ? `${icon('coin', 'xl')}<div class="fd-amt">+${money(m.cashOffer.amount)}</div>` : icon(kind === 'helper' ? 'barista' : 'bolt', 'xl');
    const title = { cash: 'Cash boost', helper: 'Hire rush helpers', skip: 'Finish now' }[kind];
    const sub = { helper: 'Every shop serves itself until the rush is over.' }[kind];
    const priceLabel = kind === 'cash' ? m.cashOffer.priceLabel : kind === 'helper' ? m.rushHelper.priceLabel : m.skipPriceLabel;
    const el = this.ui.openModal(`
      <div class="fd">
        <div class="fd-art">${art}</div>
        <div class="modal-title">${title}</div>
        ${sub ? `<p class="fineprint">${sub}</p>` : ''}
        <button class="btn btn-gold big" data-act="pay">${priceLabel}</button>
        <button class="btn-link" data-act="no">Not now</button>
      </div>`);
    const dismiss = () => { E.log(this.s, 'fake_door_dismiss', { kind, item }); this.ui.closeModal(); };
    el.querySelector('[data-act="no"]').addEventListener('click', dismiss);
    el.querySelector('.modal-scrim').addEventListener('click', dismiss);
    el.querySelector('[data-act="pay"]').addEventListener('click', () => {
      E.log(this.s, 'fake_door_tap', { kind, item });
      audio.fanfare();
      el.querySelector('.modal-panel').innerHTML = `
        <div class="fd done">${icon('check', 'xl')}
          <div class="modal-title">It's yours!</div>
          <p class="fineprint">This is a test build, so nothing was charged. Your tap tells us this is worth building.</p>
          <button class="btn btn-green big" data-act="ok">Great</button>
        </div>`;
      el.querySelector('[data-act="ok"]').addEventListener('click', () => this.ui.closeModal());
      onGrant();
      this.persist();
    });
  }

  skipBuild(b) {
    if (!this.monetizationOn()) {
      this.ui.floater('Building…', this.stage.toScreen(b.kind === 'upgrade' ? this.buildings[b.shop].anchor() : this.projectSpot(this.cfg.projects.find((p) => p.id === b.id))), 'warn');
      return;
    }
    this.fakeDoor('skip', b.shop ? E.upKey(b.shop, b.id) : b.id, () => this.finishBuild(b));
  }

  // ---------- UI: HUD, tiles, anchors, sheets ----------
  bindHud() {
    const r = this.root;
    r.querySelector('#settings-btn').addEventListener('click', () => this.openSettings());
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

  onTile(id) {
    const p = this.cfg.projects.find((q) => q.id === id);
    if (!p) return;
    const build = this.s.builds.find((b) => b.kind === 'project' && b.id === p.id);
    if (build) return this.skipBuild(build);
    if (p.type === 'task') {
      this.ui.floater('Tap the trash bags', this.anchorScreen(p), 'warn');
      return;
    }
    if (this.zoom.level && p.type !== 'building') this.zoomTo(0);
    this.buyProject(p);
  }

  cashOffer() {
    const m = this.cfg.monetization;
    const hook = E.availableProjects(this.cfg, this.s).find((p) => p.hook);
    this.fakeDoor('cash', `${hook?.id || 'cash'}_${m.cashOffer.amount}`, () => {
      const amt = m.cashOffer.amount;
      const from = { x: this.stage.width / 2, y: this.stage.height * 0.55 };
      for (let i = 0; i < 10; i++) this.flyCoin({ x: from.x + (Math.random() - 0.5) * 120, y: from.y + (Math.random() - 0.5) * 80 }, amt / 10, i * 40);
    });
  }

  openChoice(p, onPick) {
    const c = this.cfg.choices[p.choice];
    const html = `
      <div class="modal-title">${c.title}</div>
      <div class="choices">${c.options.map((o) => `
        <button class="choice" data-id="${o.id}">
          <span class="swatch sw-${p.choice} sw-${o.id}" style="${o.color ? `--c:${o.color}` : ''}"></span>
          <span class="choice-label">${o.label}</span>
        </button>`).join('')}
      </div>`;
    const el = this.ui.openModal(html);
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
        <p class="fineprint">You turned a forgotten street into a place people want to be. There's more to restore.</p>
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
      if (b.dataset.armed) { clear(); this.s = null; location.reload(); return; }
      b.dataset.armed = '1';
      b.querySelector('span').textContent = 'Tap again to erase progress';
    });
  }

  statsSummary() {
    const s = this.s, ev = s.events;
    const find = (type, id) => ev.find((e) => e.type === type && (!id || e.id === id));
    const fmt = (t) => (t === undefined ? '—' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
    const hookSeen = find('hook_seen'), hookBought = find('hook_bought');
    const taps = ev.filter((e) => e.type === 'fake_door_tap');
    return {
      playTime: fmt(s.playSeconds),
      earned: Math.floor(s.earned),
      lost: Math.floor(s.lost || 0),
      served: s.served,
      cafeBoughtAt: fmt(find('buy_project', 'cafe')?.t),
      pressureAt: fmt(find('pressure_start')?.t),
      rushes: ev.filter((e) => e.type === 'rush_start').length,
      bakeryCardAt: fmt(hookSeen?.t),
      bakeryBoughtAt: fmt(hookBought?.t),
      waitedForBakery: hookSeen && hookBought ? fmt(hookBought.t - hookSeen.t) : '—',
      firstPaidTapAt: fmt(taps[0]?.t),
      paidTaps: taps.length,
      paidDismissed: ev.filter((e) => e.type === 'fake_door_dismiss').length,
      paidTapItems: taps.map((e) => `${e.kind}:${e.item}`),
    };
  }

  openStats() {
    const st = this.statsSummary();
    const rows = [
      ['Play time', st.playTime], ['Earned', money(st.earned)], ['Lost to waiting', money(st.lost)], ['Cups & bouquets sold', st.served],
      ['Bought café at', st.cafeBoughtAt], ['Pressure started at', st.pressureAt], ['Rush hours', st.rushes],
      ['Bakery appeared at', st.bakeryCardAt], ['Bought bakery at', st.bakeryBoughtAt], ['Waited for bakery', st.waitedForBakery],
      ['First $0.99 tap at', st.firstPaidTapAt], ['$0.99 taps', st.paidTaps], ['$0.99 dismissed', st.paidDismissed],
    ];
    const el = this.ui.openSheet(`
      <div class="sheet-head"><div class="sheet-title">Playtest stats</div><button class="x" data-close aria-label="Close">${icon('close')}</button></div>
      <dl class="stats-list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <button class="btn btn-blue" data-act="copy">Copy full log</button>`);
    el.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
      const text = JSON.stringify({ summary: st, events: this.s.events }, null, 1);
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
    const canSkip = this.monetizationOn();
    list.innerHTML = sc.upgrades.map((u, i) => {
      const key = E.upKey(shop, u.id);
      const build = s.builds.find((b) => b.kind === 'upgrade' && b.id === u.id && b.shop === shop);
      let right;
      if (s.owned[key]) right = `<span class="owned">${icon('check')}</span>`;
      else if (build) right = `<button class="btn ${canSkip ? 'btn-gold' : 'btn-dim'} sm skip" data-skip="${u.id}">${icon(canSkip ? 'bolt' : 'clock')}<span class="tleft" data-tl="${u.id}">${clock((build.endsAt - Date.now()) / 1000)}</span></button>`;
      else if (i > firstOpen) right = `<span class="locked">${icon('lock')}</span>`;
      else right = `<button class="btn ${s.cash >= u.cost ? 'btn-green' : 'btn-dim'} sm" data-buy="${u.id}">${icon('coin')}<span>${money(u.cost)}</span></button>`;
      return `<div class="up-row ${s.owned[key] ? 'is-owned' : ''}">
        <div class="up-icon">${icon(u.icon)}</div>
        <div class="up-text"><div class="up-title">${u.title}</div><div class="up-effect">${u.effectLabel || ''}${u.buildSeconds ? ` · ${clock(u.buildSeconds)}` : ''}</div></div>
        ${right}</div>`;
    }).join('');
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => this.buyUpgrade(shop, sc.upgrades.find((u) => u.id === b.dataset.buy))));
    list.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => {
      const bd = s.builds.find((x) => x.kind === 'upgrade' && x.id === b.dataset.skip && x.shop === shop);
      if (bd) this.skipBuild(bd);
    }));
    const chips = this.ui.sheet.querySelector('.chips');
    if (chips) chips.innerHTML = `<span class="chip">${icon(sc.icon)}${money(E.price(cfg, s, shop))}</span><span class="chip">${icon('clock')}${E.customerInterval(cfg, s, shop).toFixed(1)}s</span>`;
    this.sheetKey = this.shopSheetKey();
  }

  shopSheetKey() {
    const shop = this.sheetShop;
    if (!shop) return '';
    return this.cfg.shops[shop].upgrades.map((u) => (this.s.cash >= u.cost ? 1 : 0)).join('') + this.s.builds.length + Object.keys(this.s.owned).length + this.monetizationOn();
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
    const s = this.s, cfg = this.cfg;
    const cafe = cfg.projects.find((p) => p.id === 'cafe');
    if (!s.done.cafe && cafe && s.cash < cafe.cost && !E.isBuilding(s, 'project', 'cafe')) {
      this.ui.setCard('mow', `
        <div class="card-inner">
          <div class="card-icon">${icon('coin')}</div>
          <div class="card-body"><div class="card-title">Mow the lawn</div><div class="bar"><i></i></div></div>
          <div class="count"></div>
        </div>`);
      this.ui.updateCard({ '.bar i': (el) => { el.style.width = `${Math.min(100, (100 * s.cash) / cafe.cost)}%`; }, '.count': (el) => { el.textContent = `${money(s.cash)}/${money(cafe.cost)}`; } });
      return;
    }
    const list = E.availableProjects(cfg, s).slice(0, 4);
    const hook = list.find((p) => p.hook);
    if (hook && !s.events.some((e) => e.type === 'hook_seen')) E.log(s, 'hook_seen', { id: hook.id });
    if (!list.length) {
      this.ui.setCard('done', `<div class="card-inner"><div class="card-icon">${icon('check')}</div><div class="card-body"><div class="card-title">More of the street is coming</div></div></div>`);
      return;
    }
    const canSkip = this.monetizationOn();
    const m = cfg.monetization;
    const offer = hook && canSkip && m.cashOffer.enabled && s.cash < hook.cost && s.cash >= hook.cost * m.cashOffer.showWhenCashFraction;
    const state = (p) => {
      if (s.builds.some((b) => b.kind === 'project' && b.id === p.id)) return 'build';
      if (p.type === 'task') return 'task';
      return s.cash >= p.cost ? 'ready' : 'save';
    };
    const key = list.map((p) => `${p.id}:${state(p)}`).join(',') + `|${offer ? 1 : 0}|${canSkip ? 1 : 0}`;
    this.ui.setCard(key, `
      ${offer ? `<button class="offer" data-act="offer">${icon('coin')}<span>+${money(m.cashOffer.amount)}</span><b>${m.cashOffer.priceLabel}</b></button>` : ''}
      <div class="tiles">${list.map((p) => {
        const st = state(p);
        return `<button class="tile ${st} ${p.hook ? 'hook' : ''}" data-tile="${p.id}" aria-label="${p.title}">
          <span class="tile-fill"></span>
          <span class="tile-icon">${icon(p.icon)}</span>
          <span class="tile-name">${p.title}</span>
          <span class="tile-foot">${st === 'build' ? `${icon(canSkip ? 'bolt' : 'clock')}<span class="tl"></span>` : st === 'task' ? '<span class="tl"></span>' : `${icon('coin')}<span>${money(p.cost)}</span>`}</span>
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
      } else pct = Math.min(100, (100 * s.cash) / p.cost);
      el.style.setProperty('--p', `${pct}%`);
    }
  }

  updateAnchors() {
    const s = this.s, cfg = this.cfg, ui = this.ui;
    ui.beginAnchors();
    const avail = E.availableProjects(cfg, s);
    const canSkip = this.monetizationOn();

    // price tags over every building that's for sale
    for (const b of Object.values(this.buildings)) b.setHighlight(false);
    for (const p of avail) {
      if (p.type !== 'building' || E.isBuilding(s, 'project', p.id)) continue;
      const b = this.buildings[p.building];
      const afford = s.cash >= p.cost;
      b.setHighlight(p.hook || afford);
      ui.anchor(`tag:${p.id}`, `<div class="tag ${afford ? 'go' : ''} ${p.hook ? 'gold' : ''}">${afford ? '<b>BUY</b>' : icon('lock')}<span>${money(p.cost)}</span></div>`,
        () => b.anchor(), { onTap: () => this.buyProject(p), cls: 'center-bottom' });
    }

    // upgrade buttons / upgrade timers over each open shop
    for (const [id, sh] of Object.entries(this.shops)) {
      if (!E.shopOpen(cfg, s, id)) continue;
      const u = E.nextUpgrade(cfg, s, id);
      const ub = s.builds.find((b) => b.kind === 'upgrade' && b.shop === id);
      if (ub) {
        const left = (ub.endsAt - Date.now()) / 1000;
        ui.anchor(`up:${id}`, `<div class="timer">${icon('clock')}<span>${clock(left)}</span>${canSkip ? `<b class="skip">${icon('bolt')}</b>` : ''}</div>`,
          () => sh.b.anchor(), { onTap: () => this.skipBuild(ub), cls: 'center-bottom' });
      } else if (u) {
        const afford = s.cash >= u.cost;
        ui.anchor(`up:${id}`, `<div class="upbtn ${afford ? 'ready' : ''}">${icon('up')}${afford ? '<i class="dot"></i>' : ''}</div>`,
          () => sh.b.anchor(), { onTap: () => this.openShopSheet(id), cls: 'center-bottom' });
      }
      // customers' order bubbles, with a patience ring once the street gets busy
      const pressure = E.pressureActive(cfg, s);
      for (const c of sh.customers) {
        if (c.state === 'wait' || (c.state === 'approach' && c.slot === 0)) {
          const ready = c.slot === 0 && sh.ready;
          const pat = pressure ? Math.max(0, 1 - c.wait / cfg.pressure.patienceSeconds) : 1;
          const urgent = pressure && pat < 0.35;
          ui.anchor(`cust:${c.p.root.id}`, `<div class="bubble ${ready ? 'ready' : ''} ${urgent ? 'urgent' : ''}" style="--pat:${pressure ? pat.toFixed(2) : 1}">${icon(sh.sc.icon)}</div>`,
            () => c.p.headWorld().add(V(0, 0.42, 0)), { onTap: () => this.shopTap(id), cls: 'center-bottom' });
        }
        if (c.state === 'leave' && c.mood && c.moodT < 1.2) {
          ui.anchor(`mood:${c.p.root.id}`, `<div class="${c.mood === 'angry' ? 'angry' : 'heart'}"></div>`, () => c.p.headWorld().add(V(0, 0.4 + c.moodT * 0.6, 0)), { cls: 'center-bottom' });
        }
      }
      if (sh.brew) {
        ui.anchor(`brew:${id}`, `<div class="ring" style="--p:${(sh.brew.t / sh.brew.dur).toFixed(2)}">${icon(sh.sc.icon)}</div>`,
          () => sh.b.machineTop(), { cls: 'center-bottom' });
      }
    }

    // street project build timers
    for (const b of s.builds) {
      if (b.kind !== 'project') continue;
      const proj = cfg.projects.find((q) => q.id === b.id);
      if (!proj) continue;
      const left = (b.endsAt - Date.now()) / 1000;
      ui.anchor(`build:${b.id}`, `<div class="timer">${icon('clock')}<span>${clock(left)}</span>${canSkip ? `<b class="skip">${icon('bolt')}</b>` : ''}</div>`,
        () => this.projectSpot(proj), { onTap: () => this.skipBuild(b), cls: 'center-bottom' });
    }
    ui.placeAnchors(this.stage);

    // tutorial hand
    const L = ZONES.lawn;
    const cafeP = cfg.projects.find((p) => p.id === 'cafe');
    const cafe = this.shops.cafe;
    if (this.zoom.level === 0 && !s.done.cafe && s.cash < cafeP.cost && this.cutsThisSession < 10 && !s.lawn?.includes('1')) {
      const zm = (L.z0 + L.z1) / 2 + 0.6;
      ui.hand('swipe', this.stage.toScreen(V(L.x0 + 0.6, 0, zm)), this.stage.toScreen(V(L.x1 - 0.6, 0, zm - 0.6)));
    } else if (!s.done.cafe && s.cash >= cafeP.cost && !E.isBuilding(s, 'project', 'cafe')) {
      const xy = this.stage.toScreen(this.buildings.cafe.anchor());
      ui.hand('tap', { x: xy.x + 30, y: xy.y + 4 });
    } else if (s.tutorial === 'serve' && s.done.cafe && cafe && this.front(cafe) && !cafe.brew) {
      const xy = this.stage.toScreen(this.buildings.cafe.machineTop());
      ui.hand('tap', { x: xy.x + 18, y: xy.y + 26 });
    } else ui.hand(null);
  }

  // ---------- loop ----------
  update(dtReal) {
    const dt = dtReal * this.timeScale;
    const s = this.s;
    s.playSeconds += dt;
    this.time += dt;
    this.stage.update(dtReal);
    this.grass.update(dt, this.cfg.grass.regrowSeconds);
    this.street.update(dt);
    for (const b of Object.values(this.buildings)) b.update(dt, this.time);
    this.fx.update(dt);
    this.mower.update(dt);
    this.walkers.update(dt);
    this.updatePressure();
    this.updateHelpers();
    this.updateShops(dt);
    this.updateBuilds();
    this.updatePassive(dt);
    this.updateTiles();
    this.updateAnchors();
    this.ui.tickCash(dtReal);
    if (this.sheetShop) {
      const key = this.shopSheetKey();
      if (key !== this.sheetKey) this.renderShopSheet();
      this.ui.sheet.querySelectorAll('[data-tl]').forEach((el) => {
        const b = s.builds.find((x) => x.kind === 'upgrade' && x.id === el.dataset.tl && x.shop === this.sheetShop);
        if (b) el.textContent = clock((b.endsAt - Date.now()) / 1000);
      });
    }
    if (!this.zoomHintShown && this.openShops().length >= 1 && s.served >= 3 && this.zoom.level === 0) {
      this.zoomHintShown = true;
      this.root.querySelector('#zoom-in').classList.add('hint');
      setTimeout(() => this.root.querySelector('#zoom-in').classList.remove('hint'), 6000);
    }
    this.saveT += dtReal;
    if (this.saveT > 3) { this.saveT = 0; this.persist(); }
  }

  render() { this.stage.render(); }
}
