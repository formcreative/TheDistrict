import { Game } from './game.js';

const root = document.getElementById('app');
const canvas = document.getElementById('scene');
const params = new URLSearchParams(location.search);
const debug = params.has('debug');

async function loadConfig() {
  const res = await fetch('config/game.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`config/game.json: ${res.status}`);
  return res.json();
}

const loader = document.getElementById('loader');
const t0 = performance.now();
const progress = (k) => { const bar = loader?.querySelector('i'); if (bar) bar.style.width = `${Math.round(k * 100)}%`; };

async function boot() {
  progress(0.15);
  const fonts = ['40px "Lilita One"', '40px "Pacifico"', '24px "Alfa Slab One"'];
  const fontReady = document.fonts?.load ? Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => {}) : Promise.resolve();
  const [cfg] = await Promise.all([loadConfig(), Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))])]);
  progress(0.55);
  await new Promise((r) => setTimeout(r, 30)); // let the bar paint before the 3D street is built
  const game = new Game(cfg, root, canvas, { debug });
  progress(0.9);
  window.__game = game;
  if (debug) mountDebug(game);

  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame((t) => { last = t; loop(t); });
  root.classList.add('ready');
  // keep the loading screen up long enough to read, then reveal the map
  const wait = Math.max(0, 2200 - (performance.now() - t0));
  setTimeout(() => { progress(1); setTimeout(() => { loader?.classList.add('done'); setTimeout(() => loader?.remove(), 500); }, 350); }, wait);
}

function mountDebug(game) {
  const el = document.createElement('div');
  el.className = 'debug';
  el.innerHTML = `
    <button data-a="500">+$500</button>
    <button data-a="5000">+$5k</button>
    <button data-a="speed">×1</button>
    <button data-a="finish">Finish builds</button>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    const a = e.target.dataset.a;
    if (!a) return;
    if (a === 'speed') { game.timeScale = game.timeScale === 1 ? 5 : 1; e.target.textContent = `×${game.timeScale}`; }
    else if (a === 'finish') [...game.s.builds].forEach((b) => game.finishBuild(b));
    else game.addCash(Number(a));
  });
}

boot().catch((err) => {
  console.error(err);
  loader?.remove();
  root.querySelector('#boot-error').hidden = false;
  root.querySelector('#boot-error').textContent = `Couldn't start the game. ${err.message}`;
});
