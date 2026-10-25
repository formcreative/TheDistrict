const KEY = 'streetstory.save.v3';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
