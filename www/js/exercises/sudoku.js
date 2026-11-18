import { shuffle, sleep, confetti } from '../ui.js';
import { sfx, haptic } from '../audio.js';

// ---- generator: full grid by backtracking, then remove cells keeping a unique solution ----
function candidates(g, i) {
  const r = Math.floor(i / 9), c = i % 9, used = new Set();
  for (let k = 0; k < 9; k++) { used.add(g[r * 9 + k]); used.add(g[k * 9 + c]); }
  const br = r - r % 3, bc = c - c % 3;
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) used.add(g[(br + y) * 9 + bc + x]);
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !used.has(n));
}
function fill(g) {
  const i = g.indexOf(0); if (i < 0) return true;
  for (const n of shuffle(candidates(g, i))) { g[i] = n; if (fill(g)) return true; }
  g[i] = 0; return false;
}
function countSolutions(g, limit = 2) {
  let best = -1, bestC = null;
  for (let i = 0; i < 81; i++) if (!g[i]) { const c = candidates(g, i); if (best < 0 || c.length < bestC.length) { best = i; bestC = c; if (!c.length) return 0; } }
  if (best < 0) return 1;
  let total = 0;
  for (const n of bestC) { g[best] = n; total += countSolutions(g, limit); if (total >= limit) break; }
  g[best] = 0; return total;
}
export function generate(clues) {
  const sol = Array(81).fill(0); fill(sol);
  const puz = sol.slice();
  for (const i of shuffle([...Array(81).keys()])) {
    if (puz.filter(Boolean).length <= clues) break;
    const keep = puz[i]; puz[i] = 0;
    if (countSolutions(puz.slice()) !== 1) puz[i] = keep;
  }
  return { sol, puz };
}

const LEVELS = [{ name: 'Easy', clues: 40 }, { name: 'Medium', clues: 32 }, { name: 'Hard', clues: 27 }];
const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export default {
  id: 'sudoku', name: 'Number Place', icon: '🧩', color: '#4d7cfe', unlock: 1,
  desc: 'Relaxing 9×9 number puzzles', how: 'Fill the grid so every row, column and 3×3 box has the numbers 1 to 9 once each. Tap a square, then tap a number. Take your time!',
  better: 'lower',
  format: s => fmt(s),
  medal: s => s < 300 ? 4 : s < 600 ? 3 : s < 900 ? 2 : s < 1500 ? 1 : 0,
  skipCountdown: true,
  async run(ctx) {
    // choose difficulty
    ctx.top.innerHTML = '<div class="title">Pick a level</div>';
    ctx.bottom.innerHTML = `<div class="col" style="margin:auto 0;width:100%">${LEVELS.map((l, i) => `<button class="btn ${['teal', '', 'pink'][i]}" data-l="${i}">${l.name}</button>`).join('')}</div>`;
    const lvl = await ctx.race(new Promise(r => ctx.bottom.querySelector('.col').onclick = e => { const b = e.target.closest('[data-l]'); if (b) { sfx.tap(); r(LEVELS[+b.dataset.l]); } }));
    ctx.bottom.innerHTML = '<div class="center muted" style="margin:auto;font-weight:800">Making your puzzle…</div>';
    await sleep(30);
    const { sol, puz } = generate(lvl.clues);
    const cur = puz.slice();
    let sel = -1, mistakes = 0;

    // layout: board takes the top panel, number pad at bottom
    ctx.topPanel.style.flexBasis = '58%';
    ctx.topPanel.style.padding = '10px';
    ctx.top.innerHTML = `<div data-b style="display:grid;grid-template-columns:repeat(9,1fr);width:min(100%,46vh);aspect-ratio:1;border:3px solid var(--ink);border-radius:10px;overflow:hidden;background:var(--ink);gap:1px"></div>`;
    const board = ctx.top.querySelector('[data-b]');
    board.innerHTML = cur.map((v, i) => {
      const r = Math.floor(i / 9), c = i % 9;
      const bt = r % 3 === 0 && r ? 'margin-top:2px;' : '', bl = c % 3 === 0 && c ? 'margin-left:2px;' : '';
      return `<button data-i="${i}" style="${bt}${bl}background:#fff;font-weight:${puz[i] ? 900 : 700};font-size:min(5vw,22px);color:${puz[i] ? 'var(--ink)' : 'var(--blue)'};transition:background .15s">${v || ''}</button>`;
    }).join('');
    const cells = [...board.children];
    ctx.bottom.innerHTML = `<div class="row" style="justify-content:space-between;font-weight:900;margin-bottom:8px"><span data-t>0:00</span><span class="muted">${lvl.name}</span><span data-m>0 slips</span></div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;flex:1">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="btn ghost" style="min-height:0;padding:0;font-size:24px" data-n="${n}">${n}</button>`).join('')}<button class="btn ghost" style="min-height:0;padding:0;font-size:20px" data-n="0">⌫</button></div>`;
    const tEl = ctx.bottom.querySelector('[data-t]'), mEl = ctx.bottom.querySelector('[data-m]');
    const start = performance.now();
    const iv = setInterval(() => tEl.textContent = fmt((performance.now() - start) / 1000), 500);
    ctx.onCleanup(() => clearInterval(iv));

    const paint = () => cells.forEach((c, i) => {
      const r = Math.floor(i / 9), col = i % 9, sr = Math.floor(sel / 9), sc = sel % 9;
      const same = sel >= 0 && cur[sel] && cur[i] === cur[sel];
      const peer = sel >= 0 && (r === sr || col === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(col / 3) === Math.floor(sc / 3)));
      c.style.background = i === sel ? '#ffd9b8' : same ? '#ffe9a8' : peer ? '#f4ecdc' : '#fff';
    });
    board.addEventListener('pointerdown', e => { const b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault(); sel = +b.dataset.i; sfx.tap(); paint(); });
    await ctx.race(new Promise(done => {
      ctx.bottom.addEventListener('pointerdown', e => {
        const b = e.target.closest('[data-n]'); if (!b || sel < 0 || puz[sel]) return; e.preventDefault();
        const n = +b.dataset.n;
        if (!n) { cur[sel] = 0; cells[sel].textContent = ''; sfx.soft(); paint(); return; }
        cur[sel] = n; cells[sel].textContent = n;
        if (n !== sol[sel]) { mistakes++; mEl.textContent = `${mistakes} slip${mistakes === 1 ? '' : 's'}`; cells[sel].style.color = 'var(--red)'; sfx.wrong(); haptic([15, 30, 15]); }
        else { cells[sel].style.color = 'var(--blue)'; sfx.note(n); }
        paint();
        if (cur.every((v, i) => v === sol[i])) done();
      });
    }));
    clearInterval(iv);
    sfx.fanfare(); confetti(160);
    await sleep(1600);
    ctx.topPanel.style.flexBasis = ''; ctx.topPanel.style.padding = '';
    const secs = Math.round((performance.now() - start) / 1000);
    return { score: secs, stats: { Level: lvl.name, Slips: mistakes } };
  },
};
