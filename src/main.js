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

async function boot() {
  const fontReady = document.fonts?.load ? document.fonts.load('40px "Lilita One"').catch(() => {}) : Promise.resolve();
  const [cfg] = await Promise.all([loadConfig(), Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))])]);
  const game = new Game(cfg, root, canvas, { debug });
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
  root.querySelector('#boot-error').hidden = false;
  root.querySelector('#boot-error').textContent = `Couldn't start the game. ${err.message}`;
});
