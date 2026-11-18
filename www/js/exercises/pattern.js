import { shuffle, sleep } from '../ui.js';
import { sfx, haptic } from '../audio.js';

export default {
  id: 'pattern', name: 'Grid Recall', icon: '🔳', color: '#20b8a8', unlock: 5,
  desc: 'Remember which squares lit up', how: 'Some squares light up for a moment. Tap the same squares from memory. Each level adds more. Three slips and you are out.',
  better: 'higher',
  format: s => `Level ${s}`,
  medal: s => s >= 10 ? 4 : s >= 8 ? 3 : s >= 6 ? 2 : s >= 4 ? 1 : 0,
  async run(ctx) {
    let level = 1, lives = 3, best = 0;
    ctx.top.innerHTML = '<div class="title" data-msg>Remember the squares</div><div class="big" data-lv style="margin-top:8px">1</div><div class="subtitle">level</div>';
    const msg = ctx.top.querySelector('[data-msg]'), lv = ctx.top.querySelector('[data-lv]');
    while (lives > 0) {
      const size = level < 3 ? 3 : level < 6 ? 4 : 5;
      const n = Math.min(size * size - 2, level + 2);
      const target = new Set(shuffle([...Array(size * size).keys()]).slice(0, n));
      ctx.setCorners(`Best ${best}`, '♥'.repeat(lives));
      lv.textContent = level; msg.textContent = 'Remember the squares';
      ctx.bottom.innerHTML = `<div data-g style="flex:1;display:grid;grid-template-columns:repeat(${size},1fr);gap:8px;align-content:center">${Array.from({ length: size * size }, (_, i) => `<button data-i="${i}" style="aspect-ratio:1;border-radius:12px;background:var(--panel-2);box-shadow:0 4px 0 var(--line);transition:background .2s,transform .15s"></button>`).join('')}</div>`;
      const cells = [...ctx.bottom.querySelectorAll('[data-i]')];
      await ctx.race(sleep(500));
      target.forEach(i => { cells[i].style.background = 'var(--teal)'; cells[i].style.transform = 'scale(1.04)'; });
      sfx.sparkle();
      await ctx.race(sleep(900 + n * 120));
      target.forEach(i => { cells[i].style.background = 'var(--panel-2)'; cells[i].style.transform = ''; });
      msg.textContent = 'Your turn!';
      const ok = await ctx.race(new Promise(res => {
        const hit = new Set();
        ctx.bottom.querySelector('[data-g]').addEventListener('pointerdown', e => {
          const b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault();
          const i = +b.dataset.i; if (hit.has(i)) return;
          if (target.has(i)) { hit.add(i); b.style.background = 'var(--teal)'; sfx.note(hit.size); haptic(6); if (hit.size === target.size) res(true); }
          else { b.style.background = 'var(--red)'; res(false); }
        });
      }));
      if (ok) { best = level; level++; sfx.correct(); msg.textContent = 'Great memory!'; }
      else {
        lives--; sfx.wrong(); msg.textContent = 'Not quite!';
        target.forEach(i => { if (cells[i].style.background.includes('panel')) cells[i].style.outline = '3px dashed var(--teal)'; });
      }
      ctx.bottom.querySelector('[data-g]').style.pointerEvents = 'none';
      await ctx.race(sleep(ok ? 600 : 1300));
    }
    return { score: best, stats: { 'Highest level': best } };
  },
};
