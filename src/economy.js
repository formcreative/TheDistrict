// Pure economy rules. No DOM, no three.js — shared by the game and tools/sim.mjs.

export function createState(cfg) {
  return {
    v: 2,
    cash: cfg.startCash,
    earned: 0,
    lost: 0,
    playSeconds: 0,
    owned: {},        // shop upgrades finished, keyed "shop:upgrade"
    done: {},         // street projects finished
    choices: {},      // { pavement: 'brick', flowers: 'pink' }
    builds: [],       // [{ kind: 'upgrade'|'project', id, shop?, endsAt, total }]
    trashCleared: [],
    lawn: null,       // string of 0/1 per tuft: has been restored
    tutorial: 'mow',  // mow → serve → done
    served: 0,
    pressureStartedAt: null,
    events: [],
  };
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

export function isBuilding(s, kind, id, shop) {
  return s.builds.some((b) => b.kind === kind && b.id === id && (!shop || b.shop === shop));
}

// Every project whose requirements are met and that isn't finished yet — several can be open at once.
export function availableProjects(cfg, s) {
  return cfg.projects.filter((p) => !s.done[p.id] && (p.requires || []).every((r) => s.done[r]));
}

export function nextUpgrade(cfg, s, shop) {
  return cfg.shops[shop].upgrades.find((u) => !s.owned[upKey(shop, u.id)]) || null;
}

// Income from staffed shops and passive sources, per second (manual serving not included).
export function incomePerSecond(cfg, s) {
  let r = passivePerSecond(cfg, s);
  for (const id of shopIds(cfg)) {
    if (shopOpen(cfg, s, id) && autoServe(cfg, s, id)) {
      r += price(cfg, s, id) / Math.max(customerInterval(cfg, s, id), staffSeconds(cfg, s, id));
    }
  }
  return r;
}

// The pinch point: pressure and paid offers only switch on once the player is hooked.
export function pressureActive(cfg, s) {
  const p = cfg.pressure;
  if (!p) return false;
  return s.playSeconds >= p.startsAfterSeconds && (!p.startsAfterProject || !!s.done[p.startsAfterProject]);
}

export function log(s, type, data = {}) {
  s.events.push({ t: Math.round(s.playSeconds * 10) / 10, type, ...data });
  if (s.events.length > 500) s.events.shift();
}
