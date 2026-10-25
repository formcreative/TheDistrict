// Economy pacing simulator. Plays a "reasonable player" against config/game.json
// and prints when each purchase happens, so pacing can be tuned without playing.
//   node tools/sim.mjs            (buys every upgrade it can afford)
//   SAVER=1 node tools/sim.mjs    (saves for the bakery once it unlocks)
import { readFileSync } from 'node:fs';
import * as E from '../src/economy.js';

const cfg = JSON.parse(readFileSync(new URL('../config/game.json', import.meta.url)));
const s = E.createState(cfg);

const LAWN_TUFTS = 99;           // keep in sync with the lawn size in src/scene/grass.js
const HITS_PER_SECOND = 5;       // tuft hits per second while swiping
const MANUAL_SERVE_SECONDS = 2;  // brew + serve taps, across all unstaffed shops
const ATTENTION = 0.85;          // share of the time the player is actually serving
const TRASH_PILES = 8;

const shops = Object.fromEntries(E.shopIds(cfg).map((id) => [id, { queue: [], next: 2, cool: 0 }]));
let lawnHits = LAWN_TUFTS * cfg.grass.passes, regrowBank = 0, trashLeft = TRASH_PILES, manualCool = 0;
let rushUntil = -1, nextRush = null;
const timeline = [];
let hookSeen = null, near = null;

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const earn = (v) => { s.cash += v; s.earned += v; };

function tryBuy() {
  const options = [];
  for (const p of E.availableProjects(cfg, s)) if (p.type !== 'task' && !E.isBuilding(s, 'project', p.id)) options.push({ kind: 'project', item: p });
  for (const id of E.shopIds(cfg)) {
    if (!E.shopOpen(cfg, s, id)) continue;
    const u = E.nextUpgrade(cfg, s, id);
    if (u && !E.isBuilding(s, 'upgrade', u.id, id)) options.push({ kind: 'upgrade', item: u, shop: id });
  }
  // SAVER=1: once the hook unlocks, stop upgrading and save for it
  if (process.env.SAVER && E.availableProjects(cfg, s).some((p) => p.hook)) options.splice(0, options.length, ...options.filter((o) => o.item.hook));
  options.sort((a, b) => a.item.cost - b.item.cost);
  const o = options.find((x) => s.cash >= x.item.cost);
  if (!o) return false;
  s.cash -= o.item.cost;
  s.builds.push({ kind: o.kind, id: o.item.id, shop: o.shop, endsAt: s.playSeconds + (o.item.buildSeconds || 0) });
  timeline.push(`${fmt(s.playSeconds)}  buy ${(o.shop ? `${o.shop}:` : '') + o.item.id}`.padEnd(36) + `$${o.item.cost}`);
  return true;
}

for (let t = 0; t < 45 * 60; t++) {
  s.playSeconds = t;
  for (const b of [...s.builds]) {
    if (b.endsAt <= t) {
      if (b.kind === 'upgrade') s.owned[E.upKey(b.shop, b.id)] = true; else s.done[b.id] = true;
      s.builds.splice(s.builds.indexOf(b), 1);
    }
  }
  const pressure = E.pressureActive(cfg, s);
  if (pressure && s.pressureStartedAt === null) { s.pressureStartedAt = t; nextRush = t + cfg.pressure.rush.firstAfterSeconds; timeline.push(`${fmt(t)}  -- pressure starts --`); }
  if (nextRush !== null && t >= nextRush) { rushUntil = t + cfg.pressure.rush.durationSeconds; nextRush = t + cfg.pressure.rush.everySeconds; }
  const rush = t < rushUntil ? cfg.pressure.rush.customerRate : 1;

  if (!s.done.cafe) {
    const hits = Math.min(HITS_PER_SECOND, lawnHits);
    lawnHits -= hits;
    earn((hits / cfg.grass.passes) * cfg.grass.coinValue * (1 + cfg.grass.weedChance * (cfg.grass.weedCoins - 1)));
  } else {
    let anyStaff = false;
    manualCool -= 1;
    for (const id of E.shopIds(cfg)) {
      if (!E.shopOpen(cfg, s, id)) continue;
      const sh = shops[id];
      sh.next -= 1;
      if (sh.next <= 0) {
        if (sh.queue.length < cfg.shops[id].maxQueue) sh.queue.push(0);
        else if (pressure) s.lost += E.price(cfg, s, id);
        sh.next = E.customerInterval(cfg, s, id, rush);
      }
      sh.queue = sh.queue.map((w) => w + 1);
      if (pressure) {
        const before = sh.queue.length;
        sh.queue = sh.queue.filter((w) => w <= cfg.pressure.patienceSeconds);
        s.lost += (before - sh.queue.length) * E.price(cfg, s, id);
      }
      if (E.autoServe(cfg, s, id)) {
        anyStaff = true;
        sh.cool -= 1;
        while (sh.queue.length && sh.cool <= 0) { sh.queue.shift(); earn(E.price(cfg, s, id)); sh.cool += E.staffSeconds(cfg, s, id); }
        if (!sh.queue.length) sh.cool = Math.max(sh.cool, 0); // staff can't bank idle time
      }
    }
    // the player serves the best-paying unstaffed shop
    while (manualCool <= 0) {
      const open = E.shopIds(cfg).filter((id) => E.shopOpen(cfg, s, id) && !E.autoServe(cfg, s, id) && shops[id].queue.length);
      if (!open.length) { manualCool = 0; break; }
      open.sort((a, b) => E.price(cfg, s, b) - E.price(cfg, s, a));
      shops[open[0]].queue.shift();
      if (Math.random() < ATTENTION) earn(E.price(cfg, s, open[0]));
      manualCool += MANUAL_SERVE_SECONDS;
    }
    regrowBank += (LAWN_TUFTS / cfg.grass.regrowSeconds) * cfg.grass.regrownValue * (anyStaff ? 0.4 : 0.1);
    if (regrowBank >= 1) { earn(Math.floor(regrowBank)); regrowBank -= Math.floor(regrowBank); }
    if (E.availableProjects(cfg, s).some((p) => p.type === 'task') && trashLeft > 0) {
      earn(cfg.trash.rewardPerPile); trashLeft--;
      if (!trashLeft) s.done.trash = true;
    }
    earn(E.passivePerSecond(cfg, s));
  }
  while (tryBuy());
  const hook = E.availableProjects(cfg, s).find((p) => p.hook);
  if (hook && hookSeen === null) { hookSeen = t; timeline.push(`${fmt(t)}  ** ${hook.id} unlocks ($${hook.cost}) **`); }
  if (hook && near === null && s.cash >= hook.cost - 280) { near = t; timeline.push(`${fmt(t)}  ** $${Math.floor(s.cash)} of $${hook.cost} **`); }
  if (s.done.bakery) break;
}

console.log(timeline.join('\n'));
console.log(`\nlost to impatient customers: $${Math.floor(s.lost)}   income from staff: $${E.incomePerSecond(cfg, s).toFixed(1)}/s`);
