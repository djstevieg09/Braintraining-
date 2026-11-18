import { rand, sleep, mark } from '../ui.js';
import { sfx } from '../audio.js';

export default {
  id: 'numbers', name: 'Number Memory', icon: '🔢', color: '#4d7cfe', unlock: 3,
  desc: 'Remember longer and longer numbers', how: 'A number flashes up. Remember it, then write it down once it disappears. Each correct answer makes the next one longer. Two misses and you are done.',
  better: 'higher',
  format: s => `${s} digits`,
  medal: s => s >= 9 ? 4 : s >= 8 ? 3 : s >= 7 ? 2 : s >= 5 ? 1 : 0,
  ageFrom: s => 20 + Math.max(0, Math.min(60, (9 - s) / 6 * 60)),

  async run(ctx) {
    let len = 3, misses = 0, best = 0, round = 0;
    while (misses < 2 && len <= 12) {
      round++;
      let num = String(rand(1, 9)); while (num.length < len) num += rand(0, 9);
      ctx.setCorners(`Round ${round}`, `${'●'.repeat(2 - misses)}${'○'.repeat(misses)}`);
      ctx.bottom.innerHTML = '<div class="center muted" style="margin:auto;font-weight:800;font-size:20px">Remember this number…</div>';
      ctx.top.innerHTML = `<div class="big bump" style="letter-spacing:6px;font-size:${len > 8 ? 44 : 58}px">${num}</div>`;
      sfx.flip();
      await ctx.race(sleep(900 + len * 450));
      ctx.top.innerHTML = `<div class="big" style="letter-spacing:6px;color:var(--line)">${'?'.repeat(len)}</div><div class="muted" style="font-weight:800;margin-top:10px">Write the number</div>`;
      const right = await ctx.race(new Promise(resolve => {
        ctx.input({
          onAnswer: (text, final) => {
            if (!final && text.length < num.length && num.startsWith(text)) return false;
            if (!final && text.length < num.length) return false;
            resolve(text === num); return true;
          },
        });
      }));
      ctx.top.innerHTML = `<div class="big" style="letter-spacing:6px;font-size:${len > 8 ? 44 : 58}px">${num}</div>`;
      await mark(ctx.topPanel, right, 600);
      if (right) { best = len; len++; } else misses++;
    }
    return { score: best, stats: { 'Longest number': `${best} digits`, Rounds: round } };
  },
};
