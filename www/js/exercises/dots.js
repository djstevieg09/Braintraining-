import { rand, mark, sleep } from '../ui.js';
import { sfx } from '../audio.js';

const COLORS = ['#ff8a3d', '#20b8a8', '#ff5d8f', '#4d7cfe', '#8d5cf6'];

function drawDots(canvas, n) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const R = Math.max(9, Math.min(18, r.width / 22)), pts = [];
  let tries = 0;
  while (pts.length < n && tries++ < 5000) {
    const p = { x: R + Math.random() * (r.width - 2 * R), y: R + Math.random() * (r.height - 2 * R) };
    if (pts.every(q => Math.hypot(p.x - q.x, p.y - q.y) > R * 2.4)) pts.push(p);
  }
  const color = COLORS[rand(0, COLORS.length - 1)];
  const t0 = performance.now();
  (function f(t) {
    const k = Math.max(0, Math.min(1, (t - t0) / 220));
    g.clearRect(0, 0, r.width, r.height); g.fillStyle = color;
    pts.forEach(p => { g.beginPath(); g.arc(p.x, p.y, R * (k < 1 ? 1 - Math.pow(1 - k, 3) : 1), 0, 7); g.fill(); });
    if (k < 1) requestAnimationFrame(f);
  })(t0);
  return pts.length;
}

export default {
  id: 'dots', name: 'Dot Flash', icon: '🔵', color: '#4d7cfe', unlock: 3,
  desc: 'Count the dots in a flash', how: 'Dots flash up for a moment. Write how many you saw. An exact answer scores 2 points, one off scores 1.',
  better: 'higher',
  format: s => `${s} / 20`,
  medal: s => s >= 18 ? 4 : s >= 15 ? 3 : s >= 11 ? 2 : s >= 7 ? 1 : 0,
  async run(ctx) {
    let pts = 0, exact = 0;
    for (let i = 0; i < 10; i++) {
      ctx.setCorners(`${i + 1} / 10`, `${pts} pts`);
      ctx.top.innerHTML = '<canvas class="stage" style="width:100%;height:100%"></canvas>';
      ctx.top.style.height = '100%';
      ctx.bottom.innerHTML = '<div class="center muted" style="margin:auto;font-weight:800;font-size:20px">Look up!</div>';
      await ctx.race(sleep(500));
      const n = drawDots(ctx.top.querySelector('canvas'), rand(4 + i, 8 + i * 1.5 | 0));
      sfx.pop();
      await ctx.race(sleep(Math.max(700, 1300 - i * 50)));
      ctx.top.innerHTML = '<div class="title">How many dots?</div>';
      const ans = await ctx.race(new Promise(res => ctx.input({ onAnswer: (t, final) => { if (!final && t.length < String(n).length) return false; res(+t); return true; } })));
      const diff = Math.abs(ans - n);
      if (diff === 0) { pts += 2; exact++; } else if (diff === 1) pts += 1;
      ctx.top.innerHTML = `<div class="big">${n}</div><div class="subtitle">${diff === 0 ? 'Exactly right!' : diff === 1 ? 'So close! +1' : `You said ${ans}`}</div>`;
      await mark(ctx.topPanel, diff <= 1, 650);
    }
    ctx.top.style.height = '';
    return { score: pts, stats: { 'Exact answers': `${exact} / 10` } };
  },
};
