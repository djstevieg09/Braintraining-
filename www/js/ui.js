import { sfx, haptic } from './audio.js';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// ---------- screen manager with animated transitions ----------
const app = () => document.getElementById('app');
let currentScreen = null, cleanup = null;

export function show(html, { back = false, onLeave } = {}) {
  const el = typeof html === 'string' ? h(`<div class="screen">${html}</div>`) : html;
  el.classList.add('screen', 'enter'); if (back) el.classList.add('back');
  const old = currentScreen;
  if (cleanup) { try { cleanup(); } catch {} }
  cleanup = onLeave || null;
  if (old) {
    old.classList.remove('enter'); old.classList.add('leave'); if (back) old.classList.add('back'); else old.classList.remove('back');
    setTimeout(() => old.remove(), 340);
  }
  app().appendChild(el);
  currentScreen = el;
  sfx.whoosh();
  setTimeout(() => el.classList.remove('enter'), 450);
  return el;
}
export const screen = () => currentScreen;
export function setCleanup(fn) { cleanup = fn; }

// Exercise screens use a two-panel layout.
export function dualScreen({ title = '', left = '', right = '' } = {}) {
  return show(`
    <div class="topbar"><button class="icon-btn" data-quit aria-label="Quit">✕</button><h2>${esc(title)}</h2></div>
    <div class="panel top lined"><span class="corner l">${left}</span><span class="corner r">${right}</span><div class="slot-top col" style="align-items:center;width:100%"></div></div>
    <div class="panel bottom"><div class="slot-bottom" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div>`);
}

export async function countdown(host) {
  for (const n of [3, 2, 1]) {
    host.innerHTML = `<div class="countdown">${n}</div>`; sfx.tick(); await sleep(700);
  }
  host.innerHTML = `<div class="countdown" style="color:var(--teal)">Go!</div>`; sfx.go(); await sleep(450);
  host.innerHTML = '';
}

const TICK = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#ff5d8f" stroke-width="10" opacity=".9"/></svg>';
const CROSS = '<svg viewBox="0 0 100 100"><path d="M20 20 L80 80 M80 20 L20 80" stroke="#4d7cfe" stroke-width="12" stroke-linecap="round" opacity=".9"/></svg>';

// Big circle / cross marking over a panel.
export async function mark(panel, correct, hold = 380) {
  if (correct) { sfx.correct(); haptic(10); } else { sfx.wrong(); haptic([20, 40, 20]); panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake'); }
  const m = h(`<div class="mark">${correct ? TICK : CROSS}</div>`);
  panel.appendChild(m);
  await sleep(hold);
  m.classList.add('out'); setTimeout(() => m.remove(), 260);
}

export function toast(msg, ms = 2200) {
  const t = h(`<div class="toast">${esc(msg)}</div>`); document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 320); }, ms);
}

// Escapable wait: rejects when the player taps quit.
export class Quit extends Error {}
export function quitWatcher(scr) {
  let rejectFn; const p = new Promise((_, rej) => { rejectFn = rej; });
  p.catch(() => {});
  scr.querySelector('[data-quit]')?.addEventListener('click', () => { sfx.tap(); rejectFn(new Quit()); });
  return { race: x => Promise.race([x, p]), promise: p };
}

// ---------- confetti (canvas, 60fps) ----------
export function confetti(count = 120) {
  const c = document.getElementById('fx'); const g = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#ff8a3d', '#20b8a8', '#ff5d8f', '#ffc93c', '#4d7cfe', '#8d5cf6'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35,
    vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  (function frame(t) {
    const life = (t - start) / 2600;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - life); g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); g.restore();
    }
    if (life < 1) requestAnimationFrame(frame); else g.clearRect(0, 0, innerWidth, innerHeight);
  })(start);
}

// Animated number count-up.
export function countUp(el, to, { ms = 900, decimals = 0, suffix = '' } = {}) {
  const from = 0, start = performance.now();
  return new Promise(res => {
    (function f(t) {
      const k = Math.max(0, Math.min(1, (t - start) / ms)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (from + (to - from) * e).toFixed(decimals) + suffix;
      if (k < 1) requestAnimationFrame(f); else res();
    })(start);
  });
}

// Simple animated SVG line chart.
export function lineChart(values, { labels = [], min, max, invert = false, height = 180 } = {}) {
  if (!values.length) return '<div class="muted center" style="padding:30px 0;font-weight:800">No results yet. Play to see your chart!</div>';
  const W = 320, H = height, P = 26;
  const lo = min ?? Math.min(...values), hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const xs = i => values.length === 1 ? W / 2 : P + (W - P * 2) * i / (values.length - 1);
  const ys = v => { const k = (v - lo) / span; return invert ? P / 2 + (H - P * 1.5) * k : H - P - (H - P * 1.5) * k; };
  const pts = values.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  const grid = [0, .5, 1].map(k => { const v = lo + span * k; const y = ys(v); return `<line class="grid" x1="${P}" x2="${W - 6}" y1="${y}" y2="${y}"/><text x="2" y="${y + 4}">${Math.round(v)}</text>`; }).join('');
  const dots = values.map((v, i) => `<circle class="dot" cx="${xs(i)}" cy="${ys(v)}" r="4.5"/>`).join('');
  const lab = labels.length ? `<text x="${P}" y="${H - 4}">${esc(labels[0])}</text><text x="${W - 6}" y="${H - 4}" text-anchor="end">${esc(labels[labels.length - 1])}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${grid}<polyline class="lineA" points="${pts}"/>${dots}${lab}</svg>`;
}
