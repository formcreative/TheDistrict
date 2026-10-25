import { icon, ICONS } from './icons.js';

// DOM overlay: HUD, bottom card, world-anchored bubbles, sheets, modals, toasts, coin flights.

const $ = (sel, root = document) => root.querySelector(sel);
export const money = (n) => '$' + Math.floor(n).toLocaleString('en-US');
const clock = (s) => {
  s = Math.max(0, Math.ceil(s));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};
export { clock };

export class UI {
  constructor(root) {
    this.root = root;
    this.world = $('#world-ui', root);
    this.fly = $('#fly-layer', root);
    this.cashEl = $('#cash', root);
    this.rateEl = $('#rate', root);
    this.cashPill = $('#cash-pill', root);
    this.card = $('#card', root);
    this.sheet = $('#sheet', root);
    this.modal = $('#modal', root);
    this.toastEl = $('#toast', root);
    this.handEl = $('#hand', root);
    this.handEl.innerHTML = ICONS.hand;
    $('#cash-pill .coin', root).innerHTML = ICONS.coin;
    this.anchors = new Map();
    this.cardKey = '';
    this.shown = 0;
    this.target = 0;
  }

  // ---- cash ----
  setCash(n, rate) {
    this.target = n;
    if (rate !== undefined) this.rateEl.textContent = rate >= 0.1 ? `+${money(rate)}/s` : '';
    this.rateEl.hidden = !(rate >= 0.1);
  }

  tickCash(dt) {
    const d = this.target - this.shown;
    if (Math.abs(d) < 0.5) this.shown = this.target;
    else this.shown += d * Math.min(1, dt * 12) + Math.sign(d) * 0.4;
    this.cashEl.textContent = money(this.shown);
  }

  bumpCash() {
    this.cashPill.classList.remove('bump');
    void this.cashPill.offsetWidth;
    this.cashPill.classList.add('bump');
  }

  coinTarget() {
    const r = $('#cash-pill .coin', this.root).getBoundingClientRect();
    const o = this.root.getBoundingClientRect();
    return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
  }

  // A DOM coin arcs from a screen point into the cash pill.
  flyCoin(from, onArrive, delay = 0) {
    const el = document.createElement('div');
    el.className = 'fly-coin';
    el.innerHTML = ICONS.coin;
    this.fly.appendChild(el);
    const to = this.coinTarget();
    const side = (Math.random() - 0.5) * 140;
    const dur = 520 + Math.random() * 140;
    const start = performance.now() + delay;
    el.style.transform = `translate(${from.x}px, ${from.y}px) translate(-50%, -50%)`;
    el.style.opacity = delay > 0 ? '0' : '1';
    const step = (now) => {
      if (now < start) { requestAnimationFrame(step); return; }
      el.style.opacity = '1';
      const k = Math.min(1, Math.max(0, (now - start) / dur));
      const e = k * k * (0.35 + 0.65 * k), u = 1 - e;
      const qx = from.x + side, qy = Math.min(from.y, to.y) + (from.y - to.y) * 0.25;
      const x = u * u * from.x + 2 * u * e * qx + e * e * to.x;
      const y = u * u * from.y + 2 * u * e * qy + e * e * to.y;
      const s = 1 + 0.5 * Math.sin(k * Math.PI) - 0.25 * k;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
      if (k < 1) requestAnimationFrame(step);
      else { el.remove(); onArrive(); }
    };
    requestAnimationFrame(step);
  }

  floater(text, xy, cls = '') {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${xy.x}px`;
    el.style.top = `${xy.y}px`;
    this.fly.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  // ---- world-anchored widgets ----
  // `vars` are CSS custom properties that change every frame (progress rings); setting them
  // separately keeps the HTML stable so entrance animations don't restart.
  anchor(id, html, getWorld, { onTap, cls = '', offsetY = 0, vars } = {}) {
    let a = this.anchors.get(id);
    if (!a) {
      const el = document.createElement('div');
      el.className = `anchor ${cls}`;
      this.world.appendChild(el);
      a = { el, html: null };
      // click (not pointerdown) so a modal opened by this tap doesn't receive the same tap and close
      el.addEventListener('click', (e) => { e.stopPropagation(); a.onTap?.(e); });
      this.anchors.set(id, a);
    }
    a.getWorld = getWorld;
    a.onTap = onTap;
    a.offsetY = offsetY;
    if (a.html !== html) { a.el.innerHTML = html; a.html = html; }
    if (vars) for (const [k, v] of Object.entries(vars)) a.el.firstElementChild?.style.setProperty(k, v);
    if (a.cls !== cls) { a.el.className = `anchor ${cls}`; a.cls = cls; }
    a.seen = true;
    return a.el;
  }

  // Call before re-declaring anchors each frame; unseen anchors are removed in placeAnchors.
  beginAnchors() { for (const a of this.anchors.values()) a.seen = false; }

  placeAnchors(stage) {
    for (const [id, a] of this.anchors) {
      if (!a.seen) { a.el.remove(); this.anchors.delete(id); continue; }
      const p = stage.toScreen(a.getWorld());
      // keep badges fully on screen when their shop sits at the edge
      const half = (a.el.firstElementChild?.offsetWidth || 0) / 2 + 6;
      const x = half && half * 2 < stage.width ? Math.min(stage.width - half, Math.max(half, p.x)) : p.x;
      a.el.style.transform = `translate(${x}px, ${p.y + a.offsetY}px)`;
    }
  }

  // ---- bottom card ----
  setCard(key, html, handlers = {}) {
    if (key !== this.cardKey) {
      this.cardKey = key;
      this.card.innerHTML = html;
      this.card.classList.remove('in');
      void this.card.offsetWidth;
      this.card.classList.add('in');
      for (const [sel, fn] of Object.entries(handlers)) {
        const el = this.card.querySelector(sel);
        if (el) el.addEventListener('click', fn);
      }
    }
  }

  updateCard(updates) {
    for (const [sel, fn] of Object.entries(updates)) {
      const el = this.card.querySelector(sel);
      if (el) fn(el);
    }
  }

  // ---- sheets & modals ----
  openSheet(html, onClose) {
    this.sheet.innerHTML = `<div class="sheet-scrim"></div><div class="sheet-panel">${html}</div>`;
    this.sheet.hidden = false;
    requestAnimationFrame(() => this.sheet.classList.add('open'));
    const close = () => this.closeSheet(onClose);
    this.sheet.querySelector('.sheet-scrim').addEventListener('click', close);
    this.sheet.querySelector('[data-close]')?.addEventListener('click', close);
    return this.sheet;
  }

  closeSheet(onClose) {
    this.sheet.classList.remove('open');
    setTimeout(() => { if (!this.sheet.classList.contains('open')) { this.sheet.hidden = true; this.sheet.innerHTML = ''; } }, 220);
    onClose?.();
  }

  get sheetOpen() { return !this.sheet.hidden; }

  openModal(html) {
    this.modal.innerHTML = `<div class="modal-scrim"></div><div class="modal-panel">${html}</div>`;
    this.modal.hidden = false;
    requestAnimationFrame(() => this.modal.classList.add('open'));
    return this.modal;
  }

  closeModal() {
    this.modal.classList.remove('open');
    setTimeout(() => { if (!this.modal.classList.contains('open')) { this.modal.hidden = true; this.modal.innerHTML = ''; } }, 200);
  }

  get modalOpen() { return !this.modal.hidden; }

  toast(title, sub = '') {
    this.toastEl.innerHTML = `<div class="ribbon"><span>${title}</span></div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}`;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  // ---- tutorial hand ----
  hand(mode, a, b) {
    const h = this.handEl;
    if (!mode) { h.hidden = true; h.dataset.mode = ''; return; }
    h.hidden = false;
    h.dataset.mode = mode;
    h.style.setProperty('--ax', `${a.x}px`);
    h.style.setProperty('--ay', `${a.y}px`);
    if (b) { h.style.setProperty('--bx', `${b.x}px`); h.style.setProperty('--by', `${b.y}px`); }
  }
}

export { icon };
