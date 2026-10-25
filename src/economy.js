// Pure economy rules. No DOM, no three.js — shared by the game and tools/sim.mjs.

export function createState(cfg) {
  return {
    v: 1,
    cash: cfg.startCash,
    earned: 0,
    playSeconds: 0,
    owned: {},        // café upgrades finished
    done: {},         // street projects finished
    choices: {},      // { pavement: 'brick', flowers: 'pink' }
    builds: [],       // [{ kind: 'upgrade'|'project', id, endsAt }]
    trashCleared: [],
    lawn: null,       // string of 0/1 per tuft: has been restored
    tutorial: 'mow',  // mow → buy → serve → done
    served: 0,
    events: [],
  };
}

const effectsOf = (cfg, s) => [
  ...cfg.cafeUpgrades.filter((u) => s.owned[u.id]).map((u) => u.effect || {}),
  ...cfg.projects.filter((p) => s.done[p.id]).map((p) => p.effect || {}),
];

export function cupPrice(cfg, s) {
  let p = cfg.cafe.baseCupPrice;
  for (const e of effectsOf(cfg, s)) if (e.cupPrice) p = Math.max(p, e.cupPrice);
  return p;
}

export function autoServe(cfg, s) {
  return effectsOf(cfg, s).some((e) => e.autoServe);
}

export function baristaBrewSeconds(cfg, s) {
  let speed = 1;
  for (const e of effectsOf(cfg, s)) if (e.baristaSpeed) speed *= e.baristaSpeed;
  return cfg.cafe.baristaBrewSeconds / speed;
}

export function customerRate(cfg, s) {
  let r = 1;
  for (const e of effectsOf(cfg, s)) if (e.customerRate) r *= e.customerRate;
  return r;
}

export function customerInterval(cfg, s) {
  return cfg.cafe.customerIntervalSeconds / customerRate(cfg, s);
}

export function passivePerSecond(cfg, s) {
  let p = 0;
  for (const e of effectsOf(cfg, s)) if (e.passivePerSecond) p += e.passivePerSecond;
  return p;
}

export function isBuilding(s, kind, id) {
  return s.builds.some((b) => b.kind === kind && b.id === id);
}

export function nextProject(cfg, s) {
  return cfg.projects.find((p) => !s.done[p.id]) || null;
}

export function nextUpgrade(cfg, s) {
  return cfg.cafeUpgrades.find((u) => !s.owned[u.id]) || null;
}

// Rough income estimate for the HUD, per second.
export function incomePerSecond(cfg, s) {
  let r = passivePerSecond(cfg, s);
  if (s.done.cafe && autoServe(cfg, s)) {
    const perCup = Math.max(customerInterval(cfg, s), baristaBrewSeconds(cfg, s));
    r += cupPrice(cfg, s) / perCup;
  }
  return r;
}

export function log(s, type, data = {}) {
  s.events.push({ t: Math.round(s.playSeconds * 10) / 10, type, ...data });
  if (s.events.length > 400) s.events.shift();
}
