// Pure economy rules. No DOM, no three.js — shared by the game and tools/sim.mjs.
//
// `g`  = global save (wallet, play time, quests, events) shared by every street.
// `s`  = one street's save (what's built and owned there).
// `cfg` = the global config merged with the current street's shops and projects (see streetConfig).

export function createGlobal(cfg) {
  return {
    v: 3,
    cash: cfg.startCash,
    earned: 0,
    lost: 0,
    playSeconds: 0,
    served: 0,
    tutorial: 'mow',  // mow → serve → done
    pressureStartedAt: null,
    stats: { mow: 0, litter: 0, vip: 0, collect: 0, served: 0 },
    quests: [],
    questTier: {},
    currentStreet: cfg.cities[0].streets[0].id,
    streets: {},
    events: [],
  };
}

export function createStreet() {
  return {
    done: {},         // projects finished on this street
    owned: {},        // shop upgrades finished, keyed "shop:upgrade"
    choices: {},      // { pavement: 'brick', flowers: 'pink' }
    builds: [],       // [{ kind: 'upgrade'|'project', id, shop?, endsAt, total }]
    trashCleared: [],
    lawn: null,
    registers: {},    // shop id → cash waiting to be collected
    lastSeen: Date.now(),
  };
}

export function allStreets(cfg) {
  return cfg.cities.flatMap((c) => (c.streets || []).map((s) => ({ ...s, city: c.id })));
}

export function streetConfig(cfg, streetId) {
  const st = allStreets(cfg).find((s) => s.id === streetId) || allStreets(cfg)[0];
  return { ...cfg, street: st, shops: st.shops, projects: st.projects };
}

export const upKey = (shop, id) => `${shop}:${id}`;

export const shopIds = (cfg) => Object.keys(cfg.shops);

export function shopOpen(cfg, s, shop) {
  return cfg.projects.some((p) => p.shop === shop && s.done[p.id]);
}

const shopEffects = (cfg, s, shop) => cfg.shops[shop].upgrades.filter((u) => s.owned[upKey(shop, u.id)]).map((u) => u.effect || {});
const streetEffects = (cfg, s) => cfg.projects.filter((p) => s.done[p.id]).map((p) => p.effect || {});

export function price(cfg, s, shop) {
  let p = cfg.shops[shop].basePrice;
  for (const e of shopEffects(cfg, s, shop)) if (e.price) p = Math.max(p, e.price);
  return p;
}

export function autoServe(cfg, s, shop) {
  return shopEffects(cfg, s, shop).some((e) => e.autoServe);
}

export function staffSeconds(cfg, s, shop) {
  let speed = 1;
  for (const e of shopEffects(cfg, s, shop)) if (e.staffSpeed) speed *= e.staffSpeed;
  return cfg.shops[shop].staffSeconds / speed;
}

export function customerInterval(cfg, s, shop, rush = 1) {
  let r = rush;
  for (const e of shopEffects(cfg, s, shop)) if (e.customerRate) r *= e.customerRate;
  for (const e of streetEffects(cfg, s)) if (e.customerRate) r *= e.customerRate;
  return cfg.shops[shop].customerIntervalSeconds / r;
}

export function passivePerSecond(cfg, s) {
  let p = 0;
  for (const e of streetEffects(cfg, s)) if (e.passivePerSecond) p += e.passivePerSecond;
  return p;
}

// What a staffed shop earns per second when nobody is watching.
export function staffRate(cfg, s, shop) {
  if (!shopOpen(cfg, s, shop) || !autoServe(cfg, s, shop)) return 0;
  return price(cfg, s, shop) / Math.max(customerInterval(cfg, s, shop), staffSeconds(cfg, s, shop));
}

export function registerCap(cfg, s, shop) {
  return Math.max(cfg.register.minCap, Math.round(staffRate(cfg, s, shop) * cfg.register.capSeconds));
}

export function isBuilding(s, kind, id, shop) {
  return s.builds.some((b) => b.kind === kind && b.id === id && (!shop || b.shop === shop));
}

export function buildersBusy(s) {
  return s.builds.filter((b) => b.kind === 'project').length;
}

// Every project whose requirements are met and that isn't finished yet — several can be open at once.
export function availableProjects(cfg, s) {
  return cfg.projects.filter((p) => !s.done[p.id] && (p.requires || []).every((r) => s.done[r]));
}

export function nextUpgrade(cfg, s, shop) {
  return cfg.shops[shop].upgrades.find((u) => !s.owned[upKey(shop, u.id)]) || null;
}

// Staffed and passive income for one street, per second.
export function incomePerSecond(cfg, s) {
  let r = passivePerSecond(cfg, s);
  for (const id of shopIds(cfg)) r += staffRate(cfg, s, id);
  return r;
}

// The pinch point: once it has started it stays on, on every street.
export function pressureActive(cfg, g, s) {
  if (g.pressureStartedAt !== null) return true;
  const p = cfg.pressure;
  if (!p) return false;
  return g.playSeconds >= p.startsAfterSeconds && (!p.startsAfterProject || !!s.done[p.startsAfterProject]);
}

export function log(g, type, data = {}) {
  g.events.push({ t: Math.round(g.playSeconds * 10) / 10, type, ...data });
  if (g.events.length > 600) g.events.shift();
}
