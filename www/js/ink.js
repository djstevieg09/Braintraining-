// Handwriting input: a smooth ink pad plus a point-cloud digit recogniser
// (based on the published $P algorithm), with optional per-player samples.
import { sfx } from './audio.js';
import { classify, render } from './digitnet.js';

const N = 32;

// ---------- $P recogniser ----------
function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}
function resample(points, n = N) {
  const pts = points.map(p => ({ ...p }));
  const I = pathLength(pts) / (n - 1);
  if (I === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  let D = 0; const out = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id !== pts[i - 1].id) continue;
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= I) {
      const t = (I - D) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y), id: pts[i].id };
      out.push(q); pts.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}
function normalize(points) {
  let pts = resample(points);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  pts = pts.map(p => ({ x: (p.x - minX) / size, y: (p.y - minY) / size, id: p.id }));
  const cx = pts.reduce((s, p) => s + p.x, 0) / n(pts), cy = pts.reduce((s, p) => s + p.y, 0) / n(pts);
  return pts.map(p => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}
const n = a => a.length;
function cloudDistance(a, b, start) {
  const matched = new Array(a.length).fill(false);
  let sum = 0, i = start;
  do {
    let index = -1, min = Infinity;
    for (let j = 0; j < matched.length; j++) if (!matched[j]) {
      const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
      if (d < min) { min = d; index = j; }
    }
    matched[index] = true;
    const weight = 1 - ((i - start + a.length) % a.length) / a.length;
    sum += weight * min;
    i = (i + 1) % a.length;
  } while (i !== start);
  return sum;
}
function greedy(a, b) {
  const step = Math.floor(Math.pow(a.length, 0.5));
  let min = Infinity;
  for (let i = 0; i < a.length; i += step) min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i));
  return min;
}

// ---------- digit templates (drawn on a 100x100 box, y down) ----------
const arc = (cx, cy, rx, ry, a0, a1, steps = 16) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = (a0 + (a1 - a0) * i / steps) * Math.PI / 180;
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
});
const seg = (...p) => p;
const fig8 = Array.from({ length: 33 }, (_, i) => { const t = i / 32 * Math.PI * 2; return [50 + 28 * Math.sin(2 * t), 50 - 45 * Math.cos(t)]; });

export const RAW = {
  0: [[arc(50, 50, 30, 45, -90, 270, 24)], [arc(50, 50, 20, 45, -90, 270, 24)], [arc(50, 50, 34, 42, -100, 250, 24)]],
  1: [[seg([50, 5], [50, 95])], [seg([34, 22], [50, 5], [50, 95])], [seg([34, 22], [50, 5], [50, 95]), seg([34, 95], [66, 95])], [seg([45, 5], [55, 95])]],
  2: [[[...arc(50, 30, 28, 25, -160, 40), [22, 95], [80, 95]]], [[...arc(50, 32, 30, 27, -170, 20), [20, 95], [82, 92]]], [[...arc(48, 28, 26, 24, -150, 60), [24, 94], [30, 88], [80, 95]]]],
  3: [[[...arc(48, 28, 26, 23, -150, 90), ...arc(48, 73, 30, 23, -90, 150)]], [[[22, 8], [75, 8], [45, 42], ...arc(48, 69, 30, 26, -90, 150)]]],
  4: [[seg([60, 5], [18, 65], [85, 65]), seg([65, 30], [65, 95])], [seg([25, 5], [22, 60], [80, 60]), seg([68, 10], [68, 95])], [seg([62, 95], [62, 5], [18, 66], [85, 66])]],
  5: [[seg([75, 8], [30, 8]), [[30, 8], [27, 45], ...arc(48, 68, 30, 26, -120, 150)]], [[[75, 8], [30, 8], [27, 45], ...arc(48, 68, 30, 26, -120, 150)]], [[[29, 8], [27, 45], ...arc(48, 68, 30, 26, -120, 150)], seg([29, 8], [76, 6])]],
  6: [[seg([70, 8], [55, 12], [40, 25], [30, 45], [27, 65], [32, 83], [45, 93], [60, 92], [72, 80], [73, 65], [63, 54], [48, 52], [35, 58], [28, 68])], [[[68, 5], [40, 35], ...arc(50, 70, 23, 24, 180, 540, 20)]]],
  7: [[seg([20, 8], [80, 8], [40, 95])], [seg([20, 8], [80, 8], [40, 95]), seg([35, 52], [70, 52])], [seg([22, 18], [22, 8], [80, 8], [45, 95])]],
  8: [[fig8], [arc(50, 27, 22, 22, 0, 360, 16), arc(50, 72, 27, 23, 0, 360, 16)], [fig8.slice().reverse()]],
  9: [[[...arc(48, 30, 25, 24, 0, -360, 20), [72, 95]]], [arc(48, 30, 25, 24, 0, 360, 20), seg([73, 26], [70, 95])], [[...arc(48, 30, 25, 24, -20, -380, 20), [68, 60], [55, 95]]]],
};

function toPoints(strokes) {
  const pts = [];
  strokes.forEach((s, id) => s.forEach(([x, y]) => pts.push({ x, y, id })));
  return pts;
}

let TEMPLATES = [];
function buildTemplates(extra = {}) {
  TEMPLATES = [];
  for (const [digit, variants] of Object.entries(RAW)) variants.forEach(strokes => TEMPLATES.push({ digit, cloud: normalize(densify(toPoints(strokes))) }));
  for (const [digit, list] of Object.entries(extra)) (list || []).forEach(pts => TEMPLATES.push({ digit, cloud: normalize(pts), user: true }));
}
// Add intermediate points so long straight segments resample correctly.
function densify(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && pts[i].id === pts[i - 1].id) {
      const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y), k = Math.ceil(d / 4);
      for (let j = 1; j < k; j++) out.push({ x: a.x + (b.x - a.x) * j / k, y: a.y + (b.y - a.y) * j / k, id: a.id });
    }
    out.push(pts[i]);
  }
  return out;
}
buildTemplates();
export function setUserSamples(samples) { buildTemplates(samples || {}); }

export function recogniseDigit(points) {
  if (points.length < 2) return { digit: '1', score: 0 };
  const cloud = normalize(points);
  // A tiny, tall mark with almost no width is a "1"
  let best = null, bestD = Infinity;
  for (const t of TEMPLATES) {
    const d = greedy(cloud, t.cloud) * (t.user ? 0.92 : 1);
    if (d < bestD) { bestD = d; best = t.digit; }
  }
  return { digit: best, score: bestD };
}

// Split strokes into digits by horizontal overlap, then read left-to-right.
export function groupStrokes(strokes) {
  const boxes = strokes.map((s, i) => {
    const xs = s.map(p => p.x), ys = s.map(p => p.y);
    return { i, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  const groups = [];
  for (const b of boxes) {
    const h = b.maxY - b.minY;
    const pad = Math.max(6, h * 0.08);
    let target = null, bestOverlap = 0;
    for (const g of groups) {
      const overlap = Math.min(b.maxX + pad, g.maxX + pad) - Math.max(b.minX - pad, g.minX - pad);
      const minW = Math.max(12, Math.min(b.maxX - b.minX, g.maxX - g.minX));
      const ratio = overlap / minW;
      if (ratio > 0.5 && ratio > bestOverlap) { bestOverlap = ratio; target = g; }
    }
    if (target) { target.items.push(b.i); target.minX = Math.min(target.minX, b.minX); target.maxX = Math.max(target.maxX, b.maxX); }
    else groups.push({ items: [b.i], minX: b.minX, maxX: b.maxX });
  }
  groups.sort((a, b) => a.minX - b.minX);
  return groups.map(g => g.items.map(i => strokes[i]));
}

// Per-player taught samples nudge the network's answer (point-cloud match).
function userScores(points) {
  const users = TEMPLATES.filter(t => t.user); if (!users.length) return null;
  const cloud = normalize(points), best = {};
  for (const t of users) { const d = greedy(cloud, t.cloud); if (best[t.digit] == null || d < best[t.digit]) best[t.digit] = d; }
  const sc = new Array(10).fill(0); let tot = 0;
  for (let k = 0; k < 10; k++) { if (best[k] == null) continue; sc[k] = Math.exp(-best[k] * 4); tot += sc[k]; }
  return tot ? sc.map(v => v / tot) : null;
}

// Returns { text, probs } where probs[i] is the probability list for digit i.
export function recogniseNumberDetailed(strokes) {
  const groups = groupStrokes(strokes).filter(g => {
    const xs = g.flat().map(p => p.x), ys = g.flat().map(p => p.y);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 6; // ignore stray dots
  });
  const probs = groups.map(g => {
    let pr = classify(render(g));
    const pts = []; g.forEach((s, id) => s.forEach(p => pts.push({ x: p.x, y: p.y, id })));
    const u = pts.length > 2 ? userScores(pts) : null;
    if (u) pr = pr.map((v, k) => 0.65 * v + 0.35 * u[k]);
    return pr;
  });
  const text = probs.map(pr => String(pr.indexOf(Math.max(...pr)))).join('');
  return { text, probs };
}
export const recogniseNumber = strokes => recogniseNumberDetailed(strokes).text;

// Forgiving check: would this answer be a reasonable reading of what was written?
export function plausible(probs, ans) {
  if (!probs || probs.length !== ans.length) return false;
  return probs.every((pr, i) => { const p = pr[+ans[i]], top = Math.max(...pr); return p >= 0.2 || p >= top * 0.35; });
}

// ---------- ink pad UI ----------
export function createInkPad(host, { onRecognise, delay = 650, hint = 'Write your answer here' } = {}) {
  host.innerHTML = `<div class="inkpad"><canvas></canvas><div class="hint">${hint}</div><div class="read"></div></div>`;
  const pad = host.querySelector('.inkpad'), canvas = pad.querySelector('canvas');
  const hintEl = pad.querySelector('.hint'), readEl = pad.querySelector('.read');
  const g = canvas.getContext('2d');
  let strokes = [], cur = null, timer = null, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = pad.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    redraw();
  }
  function drawStroke(s) {
    if (s.length < 2) { g.beginPath(); g.arc(s[0].x, s[0].y, 2.5, 0, 7); g.fill(); return; }
    g.beginPath(); g.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length - 1; i++) { const mx = (s[i].x + s[i + 1].x) / 2, my = (s[i].y + s[i + 1].y) / 2; g.quadraticCurveTo(s[i].x, s[i].y, mx, my); }
    g.lineTo(s[s.length - 1].x, s[s.length - 1].y); g.stroke();
  }
  function redraw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#2b2540'; g.fillStyle = '#2b2540';
    strokes.forEach(drawStroke); if (cur) drawStroke(cur);
  }
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let lastPen = 0;
  function down(e) {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    clearTimeout(timer); hintEl.style.opacity = 0;
    cur = [pos(e)]; redraw();
  }
  function move(e) {
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) { const p = pos(ev), l = cur[cur.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 1.5) cur.push(p); }
    const t = performance.now(); if (t - lastPen > 90) { sfx.pen(); lastPen = t; }
    redraw();
  }
  function up() {
    if (!cur) return;
    strokes.push(cur); cur = null; redraw();
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { text, probs } = recogniseNumberDetailed(strokes);
      readEl.textContent = text;
      onRecognise && onRecognise(text, strokes, probs);
    }, delay);
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const ro = new ResizeObserver(resize); ro.observe(pad);
  requestAnimationFrame(resize);

  return {
    clear() { clearTimeout(timer); strokes = []; cur = null; readEl.textContent = ''; hintEl.style.opacity = 1; redraw(); },
    strokes: () => strokes,
    destroy() { clearTimeout(timer); ro.disconnect(); },
  };
}

// ---------- unified answer input (ink or keypad) ----------
// onAnswer(text, final) -> return true when the answer was taken (input then clears).
export function createAnswerInput(host, { mode = 'ink', onAnswer, onModeChange, allowSwitch = true }) {
  let inner = null, destroyed = false;
  function build() {
    if (inner && inner.destroy) inner.destroy();
    host.innerHTML = '';
    const body = document.createElement('div'); body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0';
    host.appendChild(body);
    if (mode === 'ink') {
      inner = createInkPad(body, { onRecognise: (text, _s, probs) => { if (!destroyed && text && onAnswer(text, false, ans => plausible(probs, ans))) inner.clear(); } });
      const tools = document.createElement('div'); tools.className = 'input-tools';
      tools.innerHTML = `<button class="btn ghost small" data-a="clear">Erase</button>${allowSwitch ? '<button class="btn ghost small" data-a="keys">Keypad</button>' : ''}`;
      tools.onclick = e => {
        const a = e.target.closest('button')?.dataset.a; if (!a) return; sfx.tap();
        if (a === 'clear') inner.clear(); else { mode = 'keys'; onModeChange && onModeChange(mode); build(); }
      };
      host.appendChild(tools);
    } else {
      let val = '';
      body.innerHTML = `<div class="answer-line">&nbsp;</div><div class="keypad">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map(k => `<button class="key" data-k="${k}">${k}</button>`).join('')}<button class="key del" data-k="del">⌫</button><button class="key" data-k="0">0</button><button class="key ok" data-k="ok">OK</button></div>`;
      const line = body.querySelector('.answer-line');
      const show = () => { line.innerHTML = val || '&nbsp;'; line.style.fontSize = val.length > 8 ? '30px' : ''; };
      body.querySelector('.keypad').addEventListener('pointerdown', e => {
        const k = e.target.closest('button')?.dataset.k; if (!k) return; e.preventDefault(); sfx.tap();
        if (k === 'del') val = val.slice(0, -1);
        else if (k === 'ok') { if (val && onAnswer(val, true)) val = ''; }
        else if (val.length < 12) { val += k; if (onAnswer(val, false)) val = ''; }
        show();
      });
      inner = { clear() { val = ''; show(); } };
      if (allowSwitch) {
        const tools = document.createElement('div'); tools.className = 'input-tools';
        tools.innerHTML = '<button class="btn ghost small">Handwriting</button>';
        tools.onclick = () => { sfx.tap(); mode = 'ink'; onModeChange && onModeChange(mode); build(); };
        host.appendChild(tools);
      }
    }
  }
  build();
  return { clear: () => inner.clear(), destroy() { destroyed = true; inner && inner.destroy && inner.destroy(); } };
}
