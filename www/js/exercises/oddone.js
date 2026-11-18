import { rand, sleep } from '../ui.js';
import { sfx, haptic } from '../audio.js';

export default {
  id: 'odd', name: 'Odd One Out', icon: '🟪', color: '#8d5cf6', unlock: 4,
  desc: 'Spot the tile that is a different shade', how: 'One tile is a slightly different shade. Tap it! Each find makes the grid bigger and the difference smaller. You have 40 seconds.',
  better: 'higher',
  format: s => `${s} found`,
  medal: s => s >= 24 ? 4 : s >= 19 ? 3 : s >= 14 ? 2 : s >= 9 ? 1 : 0,
  async run(ctx) {
    const LIMIT = 40;
    let found = 0, misses = 0;
    const start = performance.now();
    ctx.top.innerHTML = '<div class="huge" data-t>40</div><div class="subtitle">seconds left</div><div class="title" data-f style="margin-top:10px;font-size:24px">0 found</div>';
    const tEl = ctx.top.querySelector('[data-t]'), fEl = ctx.top.querySelector('[data-f]');
    const grid = document.createElement('div');
    grid.style.cssText = 'flex:1;display:grid;gap:6px;min-height:0';
    ctx.bottom.innerHTML = ''; ctx.bottom.appendChild(grid);
    let odd = -1;
    function build() {
      const n = Math.min(7, 2 + Math.floor(found / 3) + 1);
      const diff = Math.max(4, 26 - found * 0.9);
      const hue = rand(0, 359), sat = rand(55, 80), light = rand(45, 62);
      odd = rand(0, n * n - 1);
      const dir = light > 52 ? -1 : 1;
      grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      grid.innerHTML = Array.from({ length: n * n }, (_, i) => `<button data-i="${i}" style="border-radius:${n > 5 ? 8 : 12}px;background:hsl(${hue} ${sat}% ${i === odd ? light + dir * diff : light}%);transition:transform .12s;animation:popIn .3s var(--spring) both;animation-delay:${i * 6}ms"></button>`).join('');
    }
    build();
    grid.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault();
      if (+b.dataset.i === odd) { found++; sfx.correct(); haptic(8); fEl.textContent = `${found} found`; fEl.classList.remove('bump'); void fEl.offsetWidth; fEl.classList.add('bump'); build(); }
      else { misses++; sfx.wrong(); b.style.transform = 'scale(.85)'; setTimeout(() => b.style.transform = '', 150); }
    });
    await ctx.race(new Promise(res => {
      const iv = setInterval(() => {
        const left = Math.max(0, LIMIT - Math.floor((performance.now() - start) / 1000));
        if (tEl.textContent !== String(left)) { tEl.textContent = left; if (left <= 5 && left > 0) sfx.tick(); }
        if (left <= 0) { clearInterval(iv); res(); }
      }, 100);
      ctx.onCleanup(() => clearInterval(iv));
    }));
    grid.style.pointerEvents = 'none';
    grid.children[odd].style.outline = '4px solid var(--ink)';
    await ctx.race(sleep(1000));
    return { score: found, stats: { Found: found, 'Wrong taps': misses } };
  },
};
