// Economy pacing simulator. Plays a "reasonable player" against config/game.json
// and prints when each purchase happens, so pacing can be tuned without playing.
//   node tools/sim.mjs
import { readFileSync } from 'node:fs';
import * as E from '../src/economy.js';

const cfg = JSON.parse(readFileSync(new URL('../config/game.json', import.meta.url)));
const s = E.createState(cfg);

const LAWN_TUFTS = 99;           // keep in sync with the lawn size in src/scene/grass.js
const MOW_RATE = 5;              // tufts/sec while actively swiping
const ATTENTION = 0.8;           // share of customers a manual player actually serves
const MANUAL_SERVE_SECONDS = 2;  // brew + two taps
const TRASH_PILES = 8;

let lawnLeft = LAWN_TUFTS, nextCustomer = 2, queue = 0, serveCooldown = 0;
let regrowBank = 0, trashLeft = TRASH_PILES;
const timeline = [];
let hookSeen = null, at4720 = null;

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const earn = (v) => { s.cash += v; s.earned += v; };

function tryBuy() {
  const p = E.nextProject(cfg, s), u = s.done.cafe ? E.nextUpgrade(cfg, s) : null;
  const options = [];
  if (p && p.type !== 'task' && !E.isBuilding(s, 'project', p.id)) options.push({ kind: 'project', item: p });
  if (u && !E.isBuilding(s, 'upgrade', u.id)) options.push({ kind: 'upgrade', item: u });
  options.sort((a, b) => a.item.cost - b.item.cost);
  for (const o of options) {
    if (s.cash >= o.item.cost) {
      s.cash -= o.item.cost;
      s.builds.push({ kind: o.kind, id: o.item.id, endsAt: s.playSeconds + (o.item.buildSeconds || 0) });
      timeline.push(`${fmt(s.playSeconds)}  buy ${o.item.id.padEnd(12)} $${o.item.cost}`);
      return true;
    }
  }
  return false;
}

for (let t = 0; t < 40 * 60; t++) {
  s.playSeconds = t;
  for (const b of [...s.builds]) {
    if (b.endsAt <= t) {
      (b.kind === 'upgrade' ? s.owned : s.done)[b.id] = true;
      s.builds.splice(s.builds.indexOf(b), 1);
    }
  }
  if (!s.done.cafe) {
    const cut = Math.min(MOW_RATE, lawnLeft);
    lawnLeft -= cut;
    earn(cut * cfg.grass.coinValue * (1 + cfg.grass.weedChance * (cfg.grass.weedCoins - 1)));
    if (!lawnLeft) earn(LAWN_TUFTS / cfg.grass.regrowSeconds * 0.8);
  } else {
    // customers
    nextCustomer -= 1;
    if (nextCustomer <= 0) { queue = Math.min(cfg.cafe.maxQueue, queue + 1); nextCustomer = E.customerInterval(cfg, s); }
    serveCooldown -= 1;
    const auto = E.autoServe(cfg, s);
    const serveTime = auto ? E.baristaBrewSeconds(cfg, s) : MANUAL_SERVE_SECONDS;
    while (queue > 0 && serveCooldown <= 0) {
      if (auto || Math.random() < ATTENTION) earn(E.cupPrice(cfg, s));
      queue--; serveCooldown += serveTime;
    }
    earn(E.passivePerSecond(cfg, s));
    // idle mowing of regrown lawn — the player's hands are free once a barista is hired
    regrowBank += LAWN_TUFTS / cfg.grass.regrowSeconds * (auto ? 0.35 : 0.1);
    if (regrowBank >= 1) { earn(Math.floor(regrowBank)); regrowBank -= Math.floor(regrowBank); }
    if (E.nextProject(cfg, s)?.type === 'task' && trashLeft > 0) {
      earn(cfg.trash.rewardPerPile); trashLeft--;
      if (!trashLeft) { s.done.trash = true; timeline.push(`${fmt(t)}  done trash`); }
    }
  }
  while (tryBuy());
  const np = E.nextProject(cfg, s);
  if (np?.hook && hookSeen === null) { hookSeen = t; timeline.push(`${fmt(t)}  ** ${np.id} card appears ($${np.cost}) **`); }
  if (np?.hook && at4720 === null && s.cash >= np.cost - 280) { at4720 = t; timeline.push(`${fmt(t)}  ** $${Math.floor(s.cash)} of $${np.cost} **`); }
  if (s.done.bakery) break;
}

console.log(timeline.join('\n'));
console.log(`\nincome at end: $${E.incomePerSecond(cfg, s).toFixed(1)}/s   cup $${E.cupPrice(cfg, s)}   customer every ${E.customerInterval(cfg, s).toFixed(1)}s`);
