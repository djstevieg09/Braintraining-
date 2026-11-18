import { rand, sleep, mark, pick } from '../ui.js';
import { sfx } from '../audio.js';

const BODY = ['#ff8a3d', '#20b8a8', '#ff5d8f', '#4d7cfe', '#8d5cf6', '#ffc93c'];

function plan(round) {
  const startIn = rand(1, 3) + Math.floor(round / 2);
  const moves = 5 + round * 3;
  const gap = Math.max(380, 1000 - round * 150);
  const walk = Math.max(900, 1500 - round * 140);
  const ev = []; let inside = 0, t = 300;
  for (let i = 0; i < startIn; i++) { ev.push({ dir: 'in', side: pick(['l', 'r']), t }); inside++; t += 420; }
  t += 600;
  for (let i = 0; i < moves; i++) {
    const dir = inside > 0 && Math.random() < 0.48 ? 'out' : 'in';
    inside += dir === 'in' ? 1 : -1;
    ev.push({ dir, side: pick(['l', 'r']), t });
    t += gap * (0.6 + Math.random() * 0.8);
  }
  return { ev, inside, end: t + walk + 400, walk };
}

function animate(canvas, { ev, end, walk }, quitP) {
  const g = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  const W = r.width, H = r.height;
  const ground = H * 0.82, doorX = W / 2;
  const walkers = ev.map((e, i) => ({ ...e, color: BODY[i % BODY.length], played: false }));
  return new Promise(resolve => {
    const t0 = performance.now(); let stop = false;
    quitP.catch(() => { stop = true; });
    function drawHouse() {
      const hw = Math.min(150, W * 0.38), hh = hw * 0.72, x = doorX - hw / 2, y = ground - hh;
      g.fillStyle = '#ffe9c7'; g.fillRect(x, y, hw, hh);
      g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(x - 14, y + 2); g.lineTo(doorX, y - hh * 0.62); g.lineTo(x + hw + 14, y + 2); g.closePath(); g.fill();
      g.fillStyle = '#8c5a3c'; const dw = hw * 0.26; g.beginPath(); g.roundRect(doorX - dw / 2, ground - hh * 0.58, dw, hh * 0.58, [dw / 2, dw / 2, 0, 0]); g.fill();
      g.fillStyle = '#9fd8ff'; const ws = hw * 0.18; g.fillRect(x + hw * 0.1, y + hh * 0.22, ws, ws); g.fillRect(x + hw * 0.72, y + hh * 0.22, ws, ws);
    }
    function drawGuy(x, y, color, flip, phase) {
      const s = Math.min(26, H * 0.11); const bob = Math.abs(Math.sin(phase)) * s * 0.25;
      g.save(); g.translate(x, y - bob);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(0, bob, s * 0.7, s * 0.18, 0, 0, 7); g.fill();
      g.fillStyle = color; g.beginPath(); g.ellipse(0, -s, s * 0.75, s, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; const ex = flip ? -1 : 1;
      g.beginPath(); g.arc(ex * s * 0.22, -s * 1.25, s * 0.2, 0, 7); g.arc(ex * s * 0.55, -s * 1.25, s * 0.2, 0, 7); g.fill();
      g.fillStyle = '#2b2540'; g.beginPath(); g.arc(ex * s * 0.27, -s * 1.25, s * 0.09, 0, 7); g.arc(ex * s * 0.6, -s * 1.25, s * 0.09, 0, 7); g.fill();
      g.restore();
    }
    function frame(now) {
      if (stop) return;
      const t = now - t0;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.fillStyle = '#d9f2d0'; g.fillRect(0, ground, W, H - ground);
      const behind = [], front = [];
      for (const w of walkers) {
        const k = (t - w.t) / walk; if (k < 0 || k > 1) continue;
        if (!w.played) { w.played = true; sfx.soft(); }
        const edge = w.side === 'l' ? -30 : W + 30;
        const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = w.dir === 'in' ? edge + (doorX - edge) * e : doorX + (edge - doorX) * e;
        const near = Math.abs(x - doorX) < 24;
        (near ? behind : front).push({ x, w, k });
      }
      behind.forEach(({ x, w, k }) => drawGuy(x, ground, w.color, (w.dir === 'in') === (w.side === 'r'), k * 18));
      drawHouse();
      front.forEach(({ x, w, k }) => drawGuy(x, ground, w.color, (w.dir === 'in') === (w.side === 'r'), k * 18));
      if (t < end) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

export default {
  id: 'count', name: 'Head Count', icon: '🏠', color: '#8d5cf6', unlock: 2,
  desc: 'Who is still inside the house?', how: 'Little friends walk in and out of the house. Keep count, then say how many are inside at the end.',
  better: 'higher',
  format: (s, o = {}) => `${s} / ${o.rounds || 5}`,
  medal: (s, o = {}) => { const f = s / (o.rounds || 5); return f >= 1 ? 4 : f >= .8 ? 3 : f >= .6 ? 2 : f >= .4 ? 1 : 0; },
  ageFrom: (s, o = {}) => 20 + (1 - s / (o.rounds || 5)) * 60,

  async run(ctx, opts = {}) {
    const rounds = opts.rounds || 5;
    let right = 0;
    for (let r = 0; r < rounds; r++) {
      ctx.setCorners(`Round ${r + 1} / ${rounds}`, '');
      ctx.top.innerHTML = '<canvas class="stage" style="height:100%;width:100%"></canvas>';
      ctx.top.style.height = '100%';
      ctx.bottom.innerHTML = '<div class="center" style="margin:auto"><div class="title" style="font-size:26px">Keep count!</div><div class="subtitle">Watch the house closely</div></div>';
      const p = plan(r);
      await ctx.race(sleep(300));
      await ctx.race(animate(ctx.top.querySelector('canvas'), p, ctx.quitPromise));
      ctx.top.innerHTML = '<div class="title">How many are inside?</div>';
      const ans = await ctx.race(new Promise(resolve => ctx.input({ onAnswer: (t, final, fits) => { if (fits && fits(String(p.inside))) { resolve(String(p.inside)); return true; } if (!final && t.length < String(p.inside).length) return false; resolve(t); return true; } })));
      const ok = ans === String(p.inside);
      if (ok) right++;
      ctx.top.innerHTML = `<div class="big">${p.inside}</div><div class="subtitle">${ok ? 'Spot on!' : `You said ${ans}`}</div>`;
      await mark(ctx.topPanel, ok, 700);
    }
    ctx.top.style.height = '';
    return { score: right, stats: { Correct: `${right} / ${rounds}` }, opts: { rounds } };
  },
};
