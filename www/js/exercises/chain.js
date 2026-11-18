import { rand, pick, mark, sleep } from '../ui.js';

export default {
  id: 'chain', name: 'Chain Sums', icon: '🔗', color: '#ff5d8f', unlock: 4,
  desc: 'Keep a running total in your head', how: 'Start with the number shown. Each step changes it. Write the new total each time. The old total is hidden, so keep it in your head!',
  better: 'lower',
  format: s => `${s.toFixed(1)} s`,
  medal: s => s < 40 ? 4 : s < 55 ? 3 : s < 75 ? 2 : s < 100 ? 1 : 0,
  async run(ctx) {
    const steps = 12;
    let total = rand(3, 12), wrong = 0;
    ctx.top.innerHTML = `<div class="subtitle" style="font-size:18px">Start with</div><div class="huge bump">${total}</div>`;
    ctx.bottom.innerHTML = '<div class="center muted" style="margin:auto;font-weight:800;font-size:20px">Remember it…</div>';
    await ctx.race(sleep(1800));
    const start = performance.now();
    for (let i = 0; i < steps; i++) {
      let op, n;
      do {
        op = pick(['+', '+', '-', '-', '×']);
        n = op === '×' ? rand(2, 3) : rand(2, 9);
      } while ((op === '-' && total - n < 0) || (op === '×' && total * n > 99) || (op === '+' && total + n > 99));
      total = op === '+' ? total + n : op === '-' ? total - n : total * n;
      const ans = String(total);
      ctx.setCorners(`${i + 1} / ${steps}`, '');
      ctx.top.innerHTML = `<div class="subtitle" style="font-size:18px">Your total…</div><div class="huge bump" style="color:var(--pink)">${op} ${n}</div>`;
      const right = await ctx.race(new Promise(resolve => ctx.input({
        onAnswer: (t, final) => { if (t !== ans && !final && t.length < ans.length) return false; resolve(t === ans); return true; },
      })));
      if (!right) { wrong++; ctx.top.innerHTML = `<div class="subtitle">The total is now</div><div class="huge">${total}</div>`; }
      await mark(ctx.topPanel, right, right ? 260 : 1100);
    }
    const secs = Math.round(((performance.now() - start) / 1000 + wrong * 4) * 10) / 10;
    return { score: secs, stats: { Correct: `${steps - wrong} / ${steps}`, Penalty: `+${wrong * 4} s` } };
  },
};
