import { rand, pick, sleep, mark } from '../ui.js';

function makeQ() {
  const op = pick(['+', '+', '-', '-', '×', '×']);
  let a, b, ans;
  if (op === '+') { a = rand(2, 49); b = rand(2, 49); ans = a + b; }
  else if (op === '-') { a = rand(10, 60); b = rand(2, a - 1); ans = a - b; }
  else { a = rand(2, 9); b = rand(2, 9); ans = a * b; }
  return { text: `${a} ${op} ${b}`, ans: String(ans) };
}

export default {
  free: true, id: 'maths', name: 'Quick Maths', icon: '➕', color: '#ff8a3d', unlock: 0,
  desc: 'Race through simple sums', how: 'Solve each sum as fast as you can. Write the answer on the pad, or switch to the keypad.',
  better: 'lower',
  format: s => `${s.toFixed(1)} s`,
  thresholds(count = 20) { const k = count / 20; return [30 * k, 45 * k, 65 * k, 90 * k]; },
  medal(s, opts = {}) { const t = this.thresholds(opts.count); return s < t[0] ? 4 : s < t[1] ? 3 : s < t[2] ? 2 : s < t[3] ? 1 : 0; },
  ageFrom(s, opts = {}) { const per20 = s / (opts.count || 20) * 20; return 20 + Math.max(0, Math.min(60, (per20 - 26) / 64 * 60)); },

  async run(ctx, opts = {}) {
    const count = opts.count || 20;
    const qs = Array.from({ length: count }, makeQ);
    let i = 0, wrong = 0;
    const start = performance.now();
    const render = () => {
      ctx.setCorners(`${i + 1} / ${count}`, '');
      ctx.top.innerHTML = `<div class="big bump" style="font-size:68px">${qs[i].text} = ?</div>
        ${qs[i + 1] ? `<div class="muted" style="font-weight:800;font-size:22px;margin-top:14px;opacity:.6">next: ${qs[i + 1].text}</div>` : ''}`;
    };
    render();
    await ctx.race(new Promise(resolve => {
      let busy = false;
      ctx.input({
        onAnswer: (text, final, fits) => {
          if (busy || i >= count) return false;
          const q = qs[i];
          const right = text === q.ans || !!(fits && fits(q.ans));
          if (!right && !final && text.length < q.ans.length) return false;
          busy = true;
          if (!right) wrong++;
          mark(ctx.topPanel, right, 260).then(() => {
            i++; busy = false;
            if (i >= count) resolve(); else render();
          });
          return true;
        },
      });
    }));
    const secs = (performance.now() - start) / 1000 + wrong * 3;
    await sleep(200);
    return { score: Math.round(secs * 10) / 10, stats: { Correct: `${count - wrong} / ${count}`, Penalty: `+${wrong * 3} s` }, opts: { count } };
  },
};
