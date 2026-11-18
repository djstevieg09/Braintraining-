import { pick, sleep, mark } from '../ui.js';
import { listen } from '../voice.js';

const SOUNDS = { red: 'RED', read: 'RED', bread: 'RED', blue: 'BLUE', blew: 'BLUE', green: 'GREEN', yellow: 'YELLOW', jello: 'YELLOW' };

const COLS = [
  { name: 'RED', css: '#e53935' }, { name: 'BLUE', css: '#2f6cf6' },
  { name: 'GREEN', css: '#22a559' }, { name: 'YELLOW', css: '#f2b705' },
];

export default {
  id: 'colour', name: 'Colour Clash', icon: '🎨', color: '#ff5d8f', unlock: 0,
  desc: 'Name the ink, not the word', how: 'A colour word appears in a different colour of ink. Tap the colour of the INK, not what the word says.',
  better: 'lower',
  format: s => `${s.toFixed(1)} s`,
  medal: (s, o = {}) => { const k = (o.count || 20) / 20; return s < 20 * k ? 4 : s < 27 * k ? 3 : s < 36 * k ? 2 : s < 48 * k ? 1 : 0; },
  ageFrom: (s, o = {}) => { const per20 = s / (o.count || 20) * 20; return 20 + Math.max(0, Math.min(60, (per20 - 17) / 33 * 60)); },

  async run(ctx, opts = {}) {
    const count = opts.count || 20;
    let i = 0, wrong = 0, last = null;
    const items = Array.from({ length: count }, () => {
      let word, ink;
      do { word = pick(COLS); ink = pick(COLS); } while (word === ink || (last && ink === last.ink));
      return (last = { word, ink });
    });
    const start = performance.now();
    ctx.bottom.innerHTML = `<div class="swatches">${COLS.map(c => `<button class="btn ghost" data-c="${c.name}">${c.name.toLowerCase()}</button>`).join('')}</div>`;
    const render = () => {
      ctx.setCorners(`${i + 1} / ${count}`, ctx.voice ? '🎤 Say the colour' : '');
      ctx.top.innerHTML = `<div class="huge bump" style="font-size:72px;color:${items[i].ink.css}">${items[i].word.name}</div>`;
    };
    render();
    let stopVoice = null;
    if (ctx.voice) {
            ctx.setCorners(`1 / ${count}`, '🎤 Say the colour');
    }
    await ctx.race(new Promise(resolve => {
      let busy = false;
      const answer = async name => {
        if (busy || i >= count) return; busy = true;
        const right = name === items[i].ink.name;
        if (!right) wrong++;
        await mark(ctx.topPanel, right, 200);
        i++; busy = false;
        if (i >= count) resolve(); else render();
      };
      ctx.bottom.querySelector('.swatches').addEventListener('pointerdown', e => {
        const b = e.target.closest('[data-c]'); if (!b) return; e.preventDefault(); answer(b.dataset.c);
      });
      if (ctx.voice) {
        let seen = 0;
        listen(text => {
          const words = text.split(/\s+/).filter(Boolean);
          if (words.length < seen) seen = 0;
          for (; seen < words.length; seen++) { const c = SOUNDS[words[seen]]; if (c) { seen = words.length; answer(c); break; } }
        }).then(stop => { stopVoice = stop; ctx.onCleanup(stop); });
      }
    }));
    if (stopVoice) stopVoice();
    const secs = (performance.now() - start) / 1000 + wrong * 3;
    await sleep(150);
    return { score: Math.round(secs * 10) / 10, stats: { Correct: `${count - wrong} / ${count}`, Penalty: `+${wrong * 3} s` }, opts: { count } };
  },
};
