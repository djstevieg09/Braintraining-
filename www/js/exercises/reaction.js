import { sleep, rand } from '../ui.js';
import { sfx, haptic } from '../audio.js';

export default {
  id: 'reaction', name: 'Reaction Speed', icon: '⚡', color: '#ffc93c', unlock: 1,
  desc: 'Tap the moment the light turns green', how: 'Wait for the light to turn green, then tap the bottom panel as fast as you can. Tapping too early costs you that try.',
  better: 'lower',
  format: s => `${Math.round(s)} ms`,
  medal: s => s < 260 ? 4 : s < 300 ? 3 : s < 350 ? 2 : s < 420 ? 1 : 0,
  ageFrom: s => 20 + Math.max(0, Math.min(60, (s - 250) / 270 * 60)),

  async run(ctx, opts = {}) {
    const trials = opts.trials || 5;
    const times = [];
    let early = 0;
    ctx.top.innerHTML = '<div class="lamp" data-lamp></div><div class="title" data-msg style="font-size:24px;margin-top:16px">Wait for green…</div>';
    ctx.bottom.innerHTML = '<button data-pad style="flex:1;border-radius:16px;background:var(--panel-2);font-weight:900;font-size:26px;color:var(--ink-soft)">TAP HERE</button>';
    const lamp = ctx.top.querySelector('[data-lamp]'), msg = ctx.top.querySelector('[data-msg]'), pad = ctx.bottom.querySelector('[data-pad]');
    let state = 'idle', goAt = 0, onTap = null;
    pad.addEventListener('pointerdown', e => { e.preventDefault(); onTap && onTap(performance.now()); });

    while (times.length < trials) {
      ctx.setCorners(`Try ${times.length + 1} / ${trials}`, early ? `${early} early` : '');
      lamp.className = 'lamp ready'; msg.textContent = 'Wait for green…'; state = 'wait';
      const result = await ctx.race(new Promise(resolve => {
        const timer = setTimeout(() => {
          state = 'go'; lamp.className = 'lamp go'; msg.textContent = 'TAP!'; sfx.pop(); goAt = performance.now();
        }, rand(1300, 3600));
        onTap = t => {
          if (state === 'wait') { clearTimeout(timer); resolve(-1); }
          else if (state === 'go') resolve(t - goAt);
        };
        ctx.onCleanup(() => clearTimeout(timer));
      }));
      onTap = null; state = 'idle';
      if (result < 0) {
        early++; lamp.className = 'lamp'; msg.textContent = 'Too soon!'; sfx.wrong(); haptic([20, 30, 20]);
      } else {
        times.push(result); lamp.className = 'lamp'; msg.innerHTML = `<span style="color:var(--teal)">${Math.round(result)} ms</span>`; sfx.correct();
      }
      await ctx.race(sleep(900));
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length + early * 40;
    return { score: Math.round(avg), stats: { Fastest: `${Math.round(Math.min(...times))} ms`, 'Too soon': early } };
  },
};
