import { rand } from '../ui.js';
import { sprint } from './sprint.js';

function clockSvg(h, m) {
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
  const ticks = Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; const r1 = 74, r2 = i % 3 ? 80 : 70; return `<line x1="${100 + r1 * Math.sin(a)}" y1="${100 - r1 * Math.cos(a)}" x2="${100 + r2 * Math.sin(a)}" y2="${100 - r2 * Math.cos(a)}" stroke="#2b2540" stroke-width="${i % 3 ? 3 : 6}" stroke-linecap="round"/>`; }).join('');
  return `<svg viewBox="0 0 200 200" style="width:min(56vw,190px);height:auto;animation:popIn .4s var(--spring) both">
    <circle cx="100" cy="100" r="92" fill="#fff" stroke="#20b8a8" stroke-width="8"/>${ticks}
    <line x1="100" y1="100" x2="${100 + 46 * Math.sin(ha * Math.PI / 180)}" y2="${100 - 46 * Math.cos(ha * Math.PI / 180)}" stroke="#2b2540" stroke-width="9" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="${100 + 68 * Math.sin(ma * Math.PI / 180)}" y2="${100 - 68 * Math.cos(ma * Math.PI / 180)}" stroke="#ff8a3d" stroke-width="6" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="7" fill="#2b2540"/></svg>`;
}

function makeQ(i) {
  const h = rand(1, 12), m = i < 4 ? rand(0, 11) * 5 : rand(0, 59);
  return {
    html: `${clockSvg(h, m)}<div class="subtitle" style="margin-top:6px;font-size:17px">What time is it? (7:25 → 725)</div>`,
    ans: `${h}${String(m).padStart(2, '0')}`,
  };
}

export default {
  id: 'clock', name: 'Clock Reader', icon: '🕒', color: '#20b8a8', unlock: 2,
  desc: 'Read the time on a clock face', how: 'Read the clock and write the time without the colon. 7:25 is written 725, and 12:05 is 1205.',
  better: 'lower',
  format: s => `${s.toFixed(1)} s`,
  medal: s => s < 35 ? 4 : s < 50 ? 3 : s < 70 ? 2 : s < 100 ? 1 : 0,
  async run(ctx) {
    const qs = Array.from({ length: 10 }, (_, i) => makeQ(i));
    const r = await sprint(ctx, qs, { penalty: 5 });
    return { score: r.secs, stats: { Correct: `${r.count - r.wrong} / ${r.count}`, Penalty: `+${r.wrong * 5} s` } };
  },
};
