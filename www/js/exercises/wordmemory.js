import { shuffle, sleep, h } from '../ui.js';
import { sfx } from '../audio.js';
import { WORDS } from './words.js';

export default {
  free: true, id: 'words', name: 'Word Memory', icon: '📝', color: '#20b8a8', unlock: 0,
  desc: 'Study a list, then spot the words', how: 'You get time to study a list of words. Then pick out every word you saw from a bigger list. Wrong picks cost a point.',
  better: 'higher',
  format: s => `${s} pts`,
  medal: (s, o = {}) => { const k = (o.count || 15) / 15; return s >= 15 * k ? 4 : s >= 12 * k ? 3 : s >= 9 * k ? 2 : s >= 6 * k ? 1 : 0; },
  ageFrom: (s, o = {}) => 20 + Math.max(0, Math.min(60, (1 - s / (o.count || 15)) * 75)),

  async run(ctx, opts = {}) {
    const count = opts.count || 15, studySecs = opts.study || 45;
    const pool = shuffle(WORDS);
    const target = pool.slice(0, count), decoys = pool.slice(count, count * 2);

    // Study phase: hide the top panel so the whole list fits on short or
    // landscape screens; timer and ready button share one row underneath.
    const tp = ctx.topPanel, oldDisplay = tp.style.display;
    tp.style.display = 'none'; ctx.onCleanup(() => { tp.style.display = oldDisplay; });
    ctx.bottom.innerHTML = `<div class="muted" style="font-weight:800;text-align:center;margin-bottom:8px">Memorise these ${count} words</div>
      <div class="scroll grow"><div class="word-grid compact">${target.map(w => `<div class="w">${w}</div>`).join('')}</div></div>
      <div class="row" style="margin-top:10px;gap:10px;align-items:center">
        <div class="big" data-t style="font-size:40px;min-width:64px;text-align:center">${studySecs}</div>
        <button class="btn teal grow" data-done>I'm ready</button></div>`;
    const tEl = ctx.bottom.querySelector('[data-t]');
    await ctx.race(new Promise(resolve => {
      let left = studySecs;
      const iv = setInterval(() => { left--; tEl.textContent = left; if (left <= 5 && left > 0) sfx.tick(); if (left <= 0) { clearInterval(iv); resolve(); } }, 1000);
      ctx.bottom.querySelector('[data-done]').onclick = () => { sfx.tap(); clearInterval(iv); resolve(); };
      ctx.onCleanup(() => clearInterval(iv));
    }));

    // Recall phase
    const all = shuffle([...target, ...decoys]);
    const chosen = new Set();
    ctx.bottom.innerHTML = `<div data-head style="text-align:center;margin-bottom:8px"><div class="title" style="font-size:22px">Which words did you see?</div>
      <div class="subtitle">Pick up to ${count}. <b data-n>0</b> picked</div></div>
      <div class="scroll grow"><div class="word-grid compact">${all.map(w => `<button class="w" data-w="${w}">${w}</button>`).join('')}</div></div>
      <button class="btn" data-fin style="margin-top:10px">Finished</button>`;
    const nEl = ctx.bottom.querySelector('[data-n]');
    ctx.bottom.querySelector('.word-grid').onclick = e => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      const w = b.dataset.w;
      if (chosen.has(w)) { chosen.delete(w); b.classList.remove('sel'); sfx.soft(); }
      else if (chosen.size < count) { chosen.add(w); b.classList.add('sel'); sfx.pop(); }
      nEl.textContent = chosen.size;
    };
    await ctx.race(new Promise(r => ctx.bottom.querySelector('[data-fin]').onclick = () => { sfx.tap(); r(); }));

    // Reveal
    let good = 0, bad = 0;
    ctx.bottom.querySelectorAll('[data-w]').forEach(b => {
      const w = b.dataset.w, isT = target.includes(w);
      b.disabled = true; b.classList.remove('sel');
      if (chosen.has(w)) { if (isT) { good++; b.classList.add('good'); } else { bad++; b.classList.add('bad'); } }
      else if (isT) b.classList.add('miss');
    });
    ctx.bottom.querySelector('[data-fin]').remove();
    sfx.sparkle();
    ctx.bottom.querySelector('[data-head]').innerHTML = `<div class="big" style="font-size:44px">${good} / ${count}</div><div class="subtitle">${bad ? `${bad} wrong pick${bad > 1 ? 's' : ''}` : 'No wrong picks!'}</div>`;
    await ctx.race(sleep(2400));
    return { score: Math.max(0, good - bad), stats: { Remembered: `${good} / ${count}`, 'Wrong picks': bad }, opts: { count } };
  },
};
