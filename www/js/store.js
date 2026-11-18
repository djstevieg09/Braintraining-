// Local persistence (works offline inside the Android app).
const KEY = 'brainblitz.v1';
const COLORS = ['#ff8a3d', '#20b8a8', '#ff5d8f', '#4d7cfe'];

function blank() {
  return { profiles: [], current: null, settings: { sound: true, music: true, unlockAll: false } };
}

let data = load();

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.profiles) return { ...blank(), ...d, settings: { ...blank().settings, ...d.settings } }; } catch {}
  return blank();
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }

export const today = (d = new Date()) => {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const settings = () => data.settings;
export function setSetting(k, v) { data.settings[k] = v; save(); }

export const profiles = () => data.profiles;
export const current = () => data.profiles.find(p => p.id === data.current) || null;
export function select(id) { data.current = id; save(); }

export function createProfile(name, birthYear) {
  const p = {
    id: 'p' + Date.now().toString(36),
    name: name.trim().slice(0, 12) || 'Player',
    birthYear: birthYear || null,
    color: COLORS[data.profiles.length % COLORS.length],
    created: today(),
    input: 'ink',
    history: {}, best: {}, brainAge: [], days: {}, inkSamples: {},
  };
  data.profiles.push(p); data.current = p.id; save();
  return p;
}

export function deleteProfile(id) {
  data.profiles = data.profiles.filter(p => p.id !== id);
  if (data.current === id) data.current = null;
  save();
}

export function updateProfile(fn) { const p = current(); if (p) { fn(p); save(); } }

// Record a finished exercise. Returns { isBest, firstToday }.
export function record(exId, result, better) {
  const p = current(); if (!p) return {};
  const d = today();
  const day = p.days[d] || (p.days[d] = { done: [] });
  const firstToday = !day.done.includes(exId);
  if (firstToday) day.done.push(exId);
  (p.history[exId] || (p.history[exId] = [])).push({ date: d, score: result.score, t: Date.now() });
  const prev = p.best[exId];
  const isBest = prev == null || (better === 'lower' ? result.score < prev : result.score > prev);
  if (isBest) p.best[exId] = result.score;
  save();
  return { isBest: isBest && prev != null, firstEver: prev == null, firstToday };
}

export function recordBrainAge(age, parts) {
  const p = current(); if (!p) return;
  const d = today();
  const existing = p.brainAge.find(b => b.date === d);
  if (existing) Object.assign(existing, { age, parts });
  else p.brainAge.push({ date: d, age, parts });
  const day = p.days[d] || (p.days[d] = { done: [] });
  day.check = true;
  save();
}

export function daysTrained(p = current()) {
  return p ? Object.keys(p.days).filter(k => p.days[k].done.length || p.days[k].check).length : 0;
}

export function streak(p = current()) {
  if (!p) return 0;
  let s = 0; const d = new Date();
  if (!p.days[today(d)]) d.setDate(d.getDate() - 1); // today not yet played doesn't break streak
  while (p.days[today(d)]) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

export function exportData() { return JSON.stringify(data); }
