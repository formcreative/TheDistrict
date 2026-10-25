import * as THREE from 'three';
import * as E from './economy.js';
import { audio } from './audio.js';
import { load, save, clear } from './save.js';
import { Stage } from './scene/stage.js';
import { Street, ZONES } from './scene/street.js';
import { Building, framingBuildings, FACADE_Z, STYLES } from './scene/buildings.js';
import { Grass, TALL, LUSH } from './scene/grass.js';
import { Person, Walkers } from './scene/people.js';
import { FX3D } from './scene/fx.js';
import { Mower } from './scene/mower.js';
import { UI, money, clock, icon } from './ui/ui.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CAFE_X = STYLES.cafe.x;
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
    this.customers = [];
    this.spawnT = 1.2;
    this.brew = null;
    this.cupReady = false;
    this.baristas = [];
    this.passive = {};
    this.streak = 0;
    this.lastCoin = 0;
    this.time = 0;
    this.timeScale = 1;
    this.pointer = null;
    this.saveT = 0;
    this.cutsThisSession = 0;

    this.counterCup = this.makeCounterCup(scene);

    this.restoreWorld();
    this.bindInput(canvas);
    this.bindHud();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(); });
    window.addEventListener('pagehide', () => this.persist());
    E.log(this.s, 'session_start');
  }

  makeCounterCup(scene) {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.12, 12), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.035, 12), new THREE.MeshLambertMaterial({ color: '#ff6a4a' }));
    band.position.y = 0.02;
    g.add(cup, band);
    g.position.set(CAFE_X - 0.75, 0.86, FACADE_Z + 0.55);
    g.visible = false;
    scene.add(g);
    return g;
  }

  // ---------- layout / persistence ----------
  layout() {
    const top = this.root.querySelector('#topbar').getBoundingClientRect().height + 8;
    const bottom = Math.max(this.root.querySelector('#card').getBoundingClientRect().height, 96) + 18;
    this.stage.resize(top, bottom);
  }

  persist() {
    this.s.lawn = this.grass.serialize();
    save(this.s);
  }

  restoreWorld() {
    const s = this.s;
    this.grass.restore(s.lawn);
    for (const p of this.cfg.projects) if (s.done[p.id]) this.applyProject(p, false);
    for (const u of this.cfg.cafeUpgrades) if (s.owned[u.id]) this.applyUpgrade(u, false);
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

  // ---------- input ----------
  bindInput(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      audio.unlock();
      if (this.ui.modalOpen || this.ui.sheetOpen) return;
      const gp = this.stage.groundPoint(e.clientX, e.clientY);
      this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, mowing: false, last: gp };
      if (gp && this.inLawn(gp)) this.startMow(gp);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointer;
      if (!p || p.id !== e.pointerId) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        p.moved += Math.hypot(ev.clientX - p.x, ev.clientY - p.y);
        p.x = ev.clientX; p.y = ev.clientY;
        const gp = this.stage.groundPoint(ev.clientX, ev.clientY);
        if (!gp) continue;
        if (!p.mowing && p.moved > 10 && this.inLawn(gp)) this.startMow(gp);
        if (p.mowing && p.last) {
          this.grass.cutSegment(p.last.x, p.last.z, gp.x, gp.z, this.cfg.grass.cutRadius, (t, weed) => this.onCut(t, weed));
          this.mower.moveTo(gp);
          audio.mower();
        }
        p.last = gp;
      }
    });
    const end = (e) => {
      const p = this.pointer;
      if (!p || p.id !== e.pointerId) return;
      if (!p.mowing && p.moved < 14) this.tap(e.clientX, e.clientY);
      this.mower.stop();
      this.pointer = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
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

  onCut(t, weed) {
    this.fx.clippings(t.x, t.z, t.lush ? LUSH : TALL);
    const n = weed ? this.cfg.grass.weedCoins : 1;
    for (let i = 0; i < n; i++) this.fx.coin(t.x, 0.2, t.z, this.cfg.grass.coinValue, (xy, v) => this.flyCoin(xy, v), i * 0.05);
    if (weed) this.fx.sparkle(t.x, 0.5, t.z, 4, 0.3);
    audio.snip();
    this.cutsThisSession++;
    this.strokeCuts = (this.strokeCuts || 0) + 1;
    const praise = { 12: 'Nice!', 24: 'Great!', 40: 'Amazing!' }[this.strokeCuts];
    if (praise && this.pointer) {
      this.ui.floater(praise, { x: this.pointer.x, y: this.pointer.y - 60 }, 'praise');
      audio.praise();
    }
    if (this.cutsThisSession % 4 === 0) { try { navigator.vibrate?.(5); } catch { /* unsupported */ } }
  }

  tap(cx, cy) {
    const targets = [...Object.values(this.buildings).map((b) => b.root), ...this.street.tapTargets, ...this.customers.map((c) => c.p.root)];
    const hit = this.stage.pick(cx, cy, targets);
    if (!hit) return;
    const t = hit.userData.tap;
    if (t.type === 'trash') return this.tapTrash(t.id, hit);
    if (t.type === 'customer') return this.cafeTap();
    if (t.type === 'building') {
      const b = this.buildings[t.id];
      if (t.id === 'cafe' && this.s.done.cafe) return this.cafeTap();
      const p = E.nextProject(this.cfg, this.s);
      if (p && p.building === t.id && !E.isBuilding(this.s, 'project', p.id)) return this.buyProject(p);
      if (b.state === 'open') { b.anim = { t: 1.2 }; audio.tap(); }
    }
  }

  // ---------- café service ----------
  slotPos(i) { return V(CAFE_X - 0.5 + i * 0.62, 0.12, FACADE_Z + 1.08); }

  frontCustomer() { return this.customers.find((c) => c.slot === 0 && c.state === 'wait'); }

  cafeTap() {
    if (!this.s.done.cafe) return;
    const b = this.buildings.cafe;
    if (E.autoServe(this.cfg, this.s)) { b.anim = { t: 1.4 }; audio.tap(); return; }
    if (this.cupReady) return this.serveFront();
    if (!this.brew && this.frontCustomer()) return this.startBrew(this.cfg.cafe.brewSeconds);
    if (!this.brew) { b.anim = { t: 1.4 }; audio.tap(); }
  }

  startBrew(dur) {
    this.brew = { t: 0, dur };
    audio.brew();
  }

  serveFront() {
    const c = this.frontCustomer();
    if (!c) return;
    this.cupReady = false;
    this.counterCup.visible = false;
    c.p.cup.visible = true;
    const price = E.cupPrice(this.cfg, this.s);
    const head = c.p.headWorld();
    this.popCoins(V(head.x, 0.9, head.z + 0.1), price, Math.min(4, Math.ceil(price / 4)));
    this.ui.floater(`+${money(price)}`, this.stage.toScreen(V(head.x, head.y + 0.6, head.z)), 'cash');
    this.fx.sparkle(head.x, head.y + 0.2, head.z, 5, 0.4);
    this.s.served++;
    if (this.s.tutorial === 'serve') { this.s.tutorial = 'done'; E.log(this.s, 'tutorial_done'); }
    c.state = 'leave';
    c.heart = 0;
    const edge = Math.random() < 0.5 ? -7 : 7;
    c.p.goTo([V(c.p.pos.x + 0.2, 0.12, WALK_Z + 0.05), V(edge, 0.12, WALK_Z + 0.05)]);
    for (const o of this.customers) {
      if (o.state !== 'leave' && o.slot > 0) {
        o.slot--;
        o.state = 'approach';
        o.p.goTo([this.slotPos(o.slot)]);
      }
    }
  }

  spawnCustomer() {
    const fromLeft = Math.random() < 0.5;
    const queued = this.customers.filter((c) => c.state !== 'leave').length;
    const p = new Person(this.stage.scene, { speed: 1.5 + Math.random() * 0.3 }).place(fromLeft ? -6.5 : 6.5, 0.12, WALK_Z);
    p.root.userData.tap = { type: 'customer' };
    const slot = queued;
    const sp = this.slotPos(slot);
    p.goTo([V(sp.x + (fromLeft ? -0.3 : 0.3), 0.12, WALK_Z), sp]);
    this.customers.push({ p, slot, state: 'approach', heart: -1 });
  }

  updateCafe(dt) {
    if (!this.s.done.cafe) return;
    const cfg = this.cfg, s = this.s;
    const auto = E.autoServe(cfg, s);
    const active = this.customers.filter((c) => c.state !== 'leave').length;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      if (active < cfg.cafe.maxQueue) {
        this.spawnCustomer();
        this.spawnT = E.customerInterval(cfg, s) * (0.75 + Math.random() * 0.5);
      } else this.spawnT = 0.4;
    }
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.p.update(dt);
      if (c.state === 'approach' && !c.p.moving) { c.state = 'wait'; c.p.face(c.p.pos.x, c.p.pos.z - 1); }
      if (c.heart >= 0) c.heart += dt;
      if (c.state === 'leave' && !c.p.moving) { c.p.dispose(); this.customers.splice(i, 1); }
    }
    if (this.brew) {
      this.brew.t += dt;
      const m = this.buildings.cafe.machine;
      if (m) m.position.x = 0.12 + Math.sin(this.brew.t * 60) * 0.008;
      if (this.brew.t >= this.brew.dur) {
        this.brew = null;
        if (auto) this.serveFront();
        else { this.cupReady = true; this.counterCup.visible = true; audio.ding(); }
      }
    } else if (auto && this.frontCustomer() && !this.cupReady) {
      this.startBrew(E.baristaBrewSeconds(cfg, s));
    } else if (auto && this.cupReady) {
      this.serveFront();
    }
    for (const b of this.baristas) {
      b.update(dt);
      b.body.position.y = this.brew ? Math.abs(Math.sin(this.time * 14)) * 0.03 : 0;
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
    if (s.tutorial === 'mow' || s.tutorial === 'buy') s.tutorial = 'serve';
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
    const titles = { cafe: ['CAFÉ OPEN!', 'Customers are on the way'], trash: ['SPOTLESS!', 'The street is clean'], flowershop: ['FLOWERS!', 'The flower shop is open'], bakery: ['BAKERY OPEN!', 'Fresh croissants every morning'], boutique: ['BOUTIQUE OPEN!', ''] };
    const [t, sub] = titles[p.id] || [`${p.title.toUpperCase()}!`, ''];
    this.ui.toast(t, sub);
    this.updateWalkers();
    if (p.id === 'cafe') this.spawnT = 0.6;
    if (p.hook) setTimeout(() => this.openMilestone(p), 1600);
    this.ui.setCash(s.cash, E.incomePerSecond(this.cfg, s));
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

  // ---------- café upgrades ----------
  buyUpgrade(u) {
    const s = this.s;
    if (s.owned[u.id] || E.isBuilding(s, 'upgrade', u.id)) return;
    if (s.cash < u.cost) { audio.deny(); return; }
    this.spend(u.cost);
    E.log(s, 'buy_upgrade', { id: u.id, cost: u.cost });
    audio.tap();
    if (u.buildSeconds > 0) {
      s.builds.push({ kind: 'upgrade', id: u.id, endsAt: Date.now() + u.buildSeconds * 1000, total: u.buildSeconds });
      this.fx.dust(CAFE_X, 0.4, FACADE_Z + 0.8, 8, 0.6);
    } else this.completeUpgrade(u);
    this.persist();
    this.renderCafeSheet();
  }

  completeUpgrade(u) {
    const s = this.s;
    s.owned[u.id] = true;
    s.builds = s.builds.filter((b) => !(b.kind === 'upgrade' && b.id === u.id));
    this.applyUpgrade(u, true);
    const a = this.buildings.cafe.anchor(1.2);
    this.fx.sparkle(a.x, a.y, a.z, 14, 1.4);
    this.fx.confetti(a.x, a.y + 0.6, a.z, 40);
    audio.fanfare();
    this.ui.toast(u.title.toUpperCase(), u.effectLabel || '');
    E.log(s, 'complete_upgrade', { id: u.id });
    this.ui.setCash(s.cash, E.incomePerSecond(this.cfg, s));
    this.persist();
    this.renderCafeSheet();
  }

  applyUpgrade(u, animate) {
    const e = u.effect || {};
    if (e.autoServe || e.baristaSpeed) this.spawnBarista(this.baristas.length);
    if (u.id === 'seating') {
      this.buildings.cafe.setSeating(true);
      for (const [x, z, face] of [[CAFE_X - 1.85, FACADE_Z + 0.72, 1], [CAFE_X - 0.65, FACADE_Z + 1.1, -1]]) {
        const p = new Person(this.stage.scene).place(x, 0.2, z);
        p.root.rotation.y = (face * Math.PI) / 2;
        p.legL.rotation.x = p.legR.rotation.x = -1.3;
        p.cup.visible = true;
        p.armR.rotation.x = -0.9;
      }
    }
    if (animate && this.buildings.cafe.machine) this.buildings.cafe.anim = { t: 0.8 };
  }

  spawnBarista(i) {
    const p = new Person(this.stage.scene, { shirt: '#2fb5a8', apron: true, scale: 1 }).place(CAFE_X - 0.75 + i * 0.5, 0.12, FACADE_Z + 0.22);
    p.root.rotation.y = 0;
    this.baristas.push(p);
  }

  // ---------- builds, passive income ----------
  updateBuilds() {
    const now = Date.now();
    for (const b of [...this.s.builds]) {
      if (now >= b.endsAt) this.finishBuild(b);
    }
  }

  finishBuild(b) {
    if (b.kind === 'project') {
      const p = this.cfg.projects.find((q) => q.id === b.id);
      if (p) this.completeProject(p); else this.s.builds.splice(this.s.builds.indexOf(b), 1);
    } else {
      const u = this.cfg.cafeUpgrades.find((q) => q.id === b.id);
      if (u) this.completeUpgrade(u); else this.s.builds.splice(this.s.builds.indexOf(b), 1);
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
    const isCash = kind === 'cash';
    const html = `
      <div class="fd">
        <div class="fd-art">${isCash ? `${icon('coin', 'xl')}<div class="fd-amt">+${money(m.cashOffer.amount)}</div>` : icon('bolt', 'xl')}</div>
        <div class="modal-title">${isCash ? 'Cash boost' : 'Finish now'}</div>
        <button class="btn btn-gold big" data-act="pay">${isCash ? m.cashOffer.priceLabel : m.skipPriceLabel}</button>
        <button class="btn-link" data-act="no">Not now</button>
      </div>`;
    const el = this.ui.openModal(html);
    el.querySelector('[data-act="no"]').addEventListener('click', () => { E.log(this.s, 'fake_door_dismiss', { kind, item }); this.ui.closeModal(); });
    el.querySelector('.modal-scrim').addEventListener('click', () => { E.log(this.s, 'fake_door_dismiss', { kind, item }); this.ui.closeModal(); });
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
    const label = b.kind === 'upgrade' ? this.cfg.cafeUpgrades.find((u) => u.id === b.id)?.title : this.cfg.projects.find((p) => p.id === b.id)?.title;
    this.fakeDoor('skip', b.id || label, () => this.finishBuild(b));
  }

  // ---------- UI: HUD, card, anchors, sheets ----------
  bindHud() {
    this.root.querySelector('#settings-btn').addEventListener('click', () => this.openSettings());
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
    return {
      playTime: fmt(s.playSeconds),
      earned: Math.floor(s.earned),
      served: s.served,
      cafeBoughtAt: fmt(find('buy_project', 'cafe')?.t),
      bakeryCardAt: fmt(hookSeen?.t),
      bakeryBoughtAt: fmt(hookBought?.t),
      waitedForBakery: hookSeen && hookBought ? fmt(hookBought.t - hookSeen.t) : '—',
      paidTaps: ev.filter((e) => e.type === 'fake_door_tap').length,
      paidDismissed: ev.filter((e) => e.type === 'fake_door_dismiss').length,
      paidTapItems: ev.filter((e) => e.type === 'fake_door_tap').map((e) => e.item),
    };
  }

  openStats() {
    const st = this.statsSummary();
    const rows = [
      ['Play time', st.playTime], ['Earned', money(st.earned)], ['Cups served', st.served],
      ['Bought café at', st.cafeBoughtAt], ['Bakery appeared at', st.bakeryCardAt], ['Bought bakery at', st.bakeryBoughtAt],
      ['Waited for bakery', st.waitedForBakery], ['$0.99 taps', st.paidTaps], ['$0.99 dismissed', st.paidDismissed],
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

  renderCafeSheet() {
    if (!this.cafeSheetOpen) return;
    const s = this.s, cfg = this.cfg;
    const list = this.ui.sheet.querySelector('.up-list');
    if (!list) return;
    const firstOpen = cfg.cafeUpgrades.findIndex((u) => !s.owned[u.id]);
    list.innerHTML = cfg.cafeUpgrades.map((u, i) => {
      const build = s.builds.find((b) => b.kind === 'upgrade' && b.id === u.id);
      let right;
      if (s.owned[u.id]) right = `<span class="owned">${icon('check')}</span>`;
      else if (build) right = `<button class="btn btn-gold sm skip" data-skip="${u.id}">${icon('bolt')}<span class="tleft" data-tl="${u.id}">${clock((build.endsAt - Date.now()) / 1000)}</span></button>`;
      else if (i > firstOpen) right = `<span class="locked">${icon('lock')}</span>`;
      else right = `<button class="btn ${s.cash >= u.cost ? 'btn-green' : 'btn-dim'} sm" data-buy="${u.id}">${icon('coin')}<span>${money(u.cost)}</span></button>`;
      return `<div class="up-row ${s.owned[u.id] ? 'is-owned' : ''}">
        <div class="up-icon">${icon(u.icon)}</div>
        <div class="up-text"><div class="up-title">${u.title}</div><div class="up-effect">${u.effectLabel || ''}${u.buildSeconds ? ` · ${clock(u.buildSeconds)}` : ''}</div></div>
        ${right}</div>`;
    }).join('');
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => this.buyUpgrade(cfg.cafeUpgrades.find((u) => u.id === b.dataset.buy))));
    list.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => {
      const bd = s.builds.find((x) => x.kind === 'upgrade' && x.id === b.dataset.skip);
      if (bd) this.skipBuild(bd);
    }));
    const chips = this.ui.sheet.querySelector('.chips');
    if (chips) chips.innerHTML = `<span class="chip">${icon('cup')}${money(E.cupPrice(cfg, s))}</span><span class="chip">${icon('clock')}${E.customerInterval(cfg, s).toFixed(1)}s</span>`;
    this.sheetAffordKey = this.upgradeAffordKey();
  }

  upgradeAffordKey() {
    return this.cfg.cafeUpgrades.map((u) => (this.s.cash >= u.cost ? 1 : 0)).join('') + this.s.builds.length + Object.keys(this.s.owned).length;
  }

  openCafeSheet() {
    audio.tap();
    this.cafeSheetOpen = true;
    this.ui.openSheet(`
      <div class="sheet-head"><div class="sheet-title">${icon('cup')} Café</div><button class="x" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="chips"></div>
      <div class="up-list"></div>`, () => { this.cafeSheetOpen = false; });
    this.renderCafeSheet();
  }

  updateCard() {
    const s = this.s, cfg = this.cfg;
    const p = E.nextProject(cfg, s);
    const build = p && s.builds.find((b) => b.kind === 'project' && b.id === p.id);
    if (p?.hook && !s.events.some((e) => e.type === 'hook_seen')) E.log(s, 'hook_seen', { id: p.id });
    if (!p) {
      this.ui.setCard('done', `<div class="card-inner"><div class="card-icon">${icon('check')}</div><div class="card-body"><div class="card-title">More of the street is coming</div></div></div>`);
      return;
    }
    if (build) {
      this.ui.setCard(`build:${p.id}`, `
        <div class="card-inner">
          <div class="card-icon">${icon(p.icon)}</div>
          <div class="card-body"><div class="card-title">${p.title}</div><div class="bar build"><i></i></div></div>
          <button class="btn btn-gold" data-act="skip">${icon('bolt')}<span class="tleft"></span></button>
        </div>`, { '[data-act="skip"]': () => this.skipBuild(build) });
      const left = (build.endsAt - Date.now()) / 1000;
      this.ui.updateCard({
        '.bar i': (el) => { el.style.width = `${100 * (1 - left / build.total)}%`; },
        '.tleft': (el) => { const t = clock(left); if (el.textContent !== t) el.textContent = t; },
      });
      return;
    }
    if (p.type === 'task') {
      const total = this.street.trash.length, n = s.trashCleared.length;
      this.ui.setCard(`task:${p.id}`, `
        <div class="card-inner">
          <div class="card-icon">${icon(p.icon)}</div>
          <div class="card-body"><div class="card-title">${p.title}</div><div class="bar"><i></i></div></div>
          <div class="count"></div>
        </div>`);
      this.ui.updateCard({ '.bar i': (el) => { el.style.width = `${(100 * n) / total}%`; }, '.count': (el) => { el.textContent = `${n}/${total}`; } });
      return;
    }
    if (!s.done.cafe && p.id === 'cafe' && s.cash < p.cost) {
      this.ui.setCard('mow', `
        <div class="card-inner">
          <div class="card-icon">${icon('coin')}</div>
          <div class="card-body"><div class="card-title">Mow the lawn</div><div class="bar"><i></i></div></div>
          <div class="count"></div>
        </div>`);
      this.ui.updateCard({ '.bar i': (el) => { el.style.width = `${Math.min(100, (100 * s.cash) / p.cost)}%`; }, '.count': (el) => { el.textContent = `${money(s.cash)}/${money(p.cost)}`; } });
      return;
    }
    const afford = s.cash >= p.cost;
    const offer = cfg.monetization.mode !== 'off' && cfg.monetization.cashOffer.enabled && (!cfg.monetization.cashOffer.onlyForHook || p.hook) && !afford && s.cash >= p.cost * cfg.monetization.cashOffer.showWhenCashFraction;
    const effect = p.effect?.passivePerSecond ? `+${money(p.effect.passivePerSecond)}/s` : '';
    this.ui.setCard(`buy:${p.id}:${offer ? 1 : 0}`, `
      <div class="card-inner ${p.hook ? 'hook' : ''}">
        <div class="card-icon">${icon(p.icon)}</div>
        <div class="card-body"><div class="card-title">${p.title}</div>${effect ? `<span class="chip sm">${effect}</span>` : ''}<div class="bar"><i></i></div></div>
        <button class="btn btn-buy" data-act="buy">${icon('coin')}<span>${money(p.cost)}</span></button>
      </div>
      ${offer ? `<button class="offer" data-act="offer">${icon('coin')}<span>+${money(cfg.monetization.cashOffer.amount)}</span><b>${cfg.monetization.cashOffer.priceLabel}</b></button>` : ''}`,
    {
      '[data-act="buy"]': () => this.buyProject(p),
      '[data-act="offer"]': () => this.fakeDoor('cash', `${p.id}_cash_${cfg.monetization.cashOffer.amount}`, () => {
        const amt = cfg.monetization.cashOffer.amount;
        const from = { x: this.stage.width / 2, y: this.stage.height * 0.55 };
        for (let i = 0; i < 10; i++) this.flyCoin({ x: from.x + (Math.random() - 0.5) * 120, y: from.y + (Math.random() - 0.5) * 80 }, amt / 10, i * 40);
      }),
    });
    this.ui.updateCard({
      '.bar i': (el) => { el.style.width = `${Math.min(100, (100 * s.cash) / p.cost)}%`; },
      '.btn-buy': (el) => el.classList.toggle('ready', afford),
    });
  }

  updateAnchors() {
    const s = this.s, cfg = this.cfg, ui = this.ui;
    ui.beginAnchors();
    const p = E.nextProject(cfg, s);
    const building = p && E.isBuilding(s, 'project', p.id);

    // price tag over the building that's for sale
    for (const id of Object.keys(this.buildings)) this.buildings[id].setHighlight(false);
    if (p && p.type === 'building' && !building) {
      const b = this.buildings[p.building];
      const afford = s.cash >= p.cost;
      b.setHighlight(p.hook || afford);
      ui.anchor(`tag:${p.id}`, `<div class="tag ${afford ? 'go' : ''} ${p.hook ? 'gold' : ''}">${afford ? '<b>BUY</b>' : icon('lock')}<span>${money(p.cost)}</span></div>`,
        () => b.anchor(), { onTap: () => this.buyProject(p), cls: 'center-bottom' });
    }

    // café upgrade button
    if (s.done.cafe) {
      const u = E.nextUpgrade(cfg, s);
      const ub = s.builds.find((b) => b.kind === 'upgrade');
      const cafe = this.buildings.cafe;
      if (ub) {
        const left = (ub.endsAt - Date.now()) / 1000;
        ui.anchor('cafe-up', `<div class="timer">${icon('clock')}<span>${clock(left)}</span><b class="skip">${icon('bolt')}</b></div>`,
          () => cafe.anchor(), { onTap: () => this.skipBuild(ub), cls: 'center-bottom' });
      } else if (u) {
        const afford = s.cash >= u.cost;
        ui.anchor('cafe-up', `<div class="upbtn ${afford ? 'ready' : ''}">${icon('up')}${afford ? '<i class="dot"></i>' : ''}</div>`,
          () => cafe.anchor(), { onTap: () => this.openCafeSheet(), cls: 'center-bottom' });
      }
    }

    // project build timers
    for (const b of s.builds) {
      if (b.kind !== 'project') continue;
      const proj = cfg.projects.find((q) => q.id === b.id);
      if (!proj) continue;
      const left = (b.endsAt - Date.now()) / 1000;
      ui.anchor(`build:${b.id}`, `<div class="timer">${icon('clock')}<span>${clock(left)}</span><b class="skip">${icon('bolt')}</b></div>`,
        () => this.projectSpot(proj), { onTap: () => this.skipBuild(b), cls: 'center-bottom' });
    }

    // customer order bubbles
    for (const c of this.customers) {
      if (c.state === 'wait' || (c.state === 'approach' && c.slot === 0)) {
        const ready = c.slot === 0 && this.cupReady;
        ui.anchor(`cust:${c.p.root.id}`, `<div class="bubble ${ready ? 'ready' : ''}">${icon('cup')}</div>`,
          () => c.p.headWorld().add(V(0, 0.42, 0)), { onTap: () => this.cafeTap(), cls: 'center-bottom' });
      }
      if (c.state === 'leave' && c.heart >= 0 && c.heart < 1.2) {
        ui.anchor(`heart:${c.p.root.id}`, `<div class="heart"></div>`, () => c.p.headWorld().add(V(0, 0.4 + c.heart * 0.6, 0)), { cls: 'center-bottom' });
      }
    }

    // brew progress
    if (this.brew) {
      ui.anchor('brew', `<div class="ring" style="--p:${(this.brew.t / this.brew.dur).toFixed(2)}">${icon('cup')}</div>`,
        () => this.buildings.cafe.machineTop(), { cls: 'center-bottom' });
    }
    ui.placeAnchors(this.stage);

    // tutorial hand
    const L = ZONES.lawn;
    if (!s.done.cafe && s.cash < cfg.projects[0].cost && this.cutsThisSession < 8 && !s.lawn?.includes('1')) {
      const zm = (L.z0 + L.z1) / 2 + 0.6;
      ui.hand('swipe', this.stage.toScreen(V(L.x0 + 0.6, 0, zm)), this.stage.toScreen(V(L.x1 - 0.6, 0, zm - 0.6)));
    } else if (p && p.id === 'cafe' && s.cash >= p.cost && !building) {
      const xy = this.stage.toScreen(this.buildings.cafe.anchor());
      ui.hand('tap', { x: xy.x + 30, y: xy.y + 4 });
    } else if (s.tutorial === 'serve' && s.done.cafe && this.frontCustomer() && !this.brew) {
      const xy = this.stage.toScreen(this.buildings.cafe.machineTop());
      ui.hand('tap', { x: xy.x + 18, y: xy.y + 26 });
    } else ui.hand(null);
  }

  // ---------- loop ----------
  update(dtReal) {
    const dt = dtReal * this.timeScale;
    const s = this.s;
    s.playSeconds += dtReal;
    this.time += dt;
    this.grass.update(dt, this.cfg.grass.regrowSeconds);
    this.street.update(dt);
    for (const b of Object.values(this.buildings)) b.update(dt, this.time);
    this.fx.update(dt);
    this.mower.update(dt);
    this.walkers.update(dt);
    this.updateCafe(dt);
    this.updateBuilds();
    this.updatePassive(dt);
    this.updateCard();
    this.updateAnchors();
    this.ui.tickCash(dtReal);
    if (this.cafeSheetOpen) {
      const key = this.upgradeAffordKey();
      if (key !== this.sheetAffordKey) this.renderCafeSheet();
      this.ui.sheet.querySelectorAll('[data-tl]').forEach((el) => {
        const b = s.builds.find((x) => x.kind === 'upgrade' && x.id === el.dataset.tl);
        if (b) el.textContent = clock((b.endsAt - Date.now()) / 1000);
      });
    }
    this.saveT += dtReal;
    if (this.saveT > 3) { this.saveT = 0; this.persist(); }
  }

  render() { this.stage.render(); }
}
