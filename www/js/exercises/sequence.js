import { rand, sleep } from '../ui.js';
import { sfx, haptic } from '../audio.js';

const PADS = ['#ff8a3d', '#20b8a8', '#ff5d8f', '#4d7cfe', '#ffc93c', '#8d5cf6'];

export default {
  id: 'sequence', name: 'Light Trail', icon: '🎵', color: '#ff8a3d', unlock: 5,
  desc: 'Repeat a growing pattern of lights and notes', how: 'Watch the pads light up and listen to the notes. Then tap them back in the same order. Each round adds one more. Two slips and the game ends.',
  better: 'higher',
  format: s => `${s} long`,
  medal: s => s >= 12 ? 4 : s >= 9 ? 3 : s >= 7 ? 2 : s >= 5 ? 1 : 0,
  async run(ctx) {
    ctx.top.innerHTML = '<div class="title" data-msg>Watch…</div><div class="big" data-len style="margin-top:8px">3</div><div class="subtitle">steps</div>';
    const msg = ctx.top.querySelector('[data-msg]'), lenEl = ctx.top.querySelector('[data-len]');
    ctx.bottom.innerHTML = `<div style="flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-content:center">${PADS.map((c, i) => `<button data-p="${i}" style="aspect-ratio:1;border-radius:24px;background:${c};opacity:.45;transition:opacity .12s,transform .12s;box-shadow:0 6px 0 rgba(0,0,0,.15)"></button>`).join('')}</div>`;
    const pads = [...ctx.bottom.querySelectorAll('[data-p]')];
    const flash = async (i, ms = 380) => {
      pads[i].style.opacity = 1; pads[i].style.transform = 'scale(1.06)'; sfx.note(i * 2);
      await sleep(ms); pads[i].style.opacity = .45; pads[i].style.transform = '';
    };
    let seq = [rand(0, 5), rand(0, 5)], best = 0, slips = 0, accept = null;
    ctx.bottom.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-p]'); if (!b || !accept) return; e.preventDefault();
      const i = +b.dataset.p; flash(i, 200); haptic(6); accept(i);
    });
    while (slips < 2) {
      seq.push(rand(0, 5));
      ctx.setCorners(`Best ${best}`, `${'●'.repeat(2 - slips)}${'○'.repeat(slips)}`);
      lenEl.textContent = seq.length; msg.textContent = 'Watch…';
      await ctx.race(sleep(700));
      const speed = Math.max(220, 480 - seq.length * 20);
      for (const s of seq) { await ctx.race(flash(s, speed)); await ctx.race(sleep(120)); }
      msg.textContent = 'Your turn!';
      const ok = await ctx.race(new Promise(res => {
        let k = 0;
        accept = i => { if (i !== seq[k]) { accept = null; res(false); return; } k++; if (k === seq.length) { accept = null; res(true); } };
      }));
      await ctx.race(sleep(250));
      if (ok) { best = seq.length; sfx.correct(); msg.textContent = 'Perfect!'; }
      else { slips++; sfx.wrong(); msg.textContent = 'Oops!'; seq = seq.slice(0, -1); }
      await ctx.race(sleep(700));
    }
    return { score: best, stats: { 'Longest trail': best } };
  },
};
