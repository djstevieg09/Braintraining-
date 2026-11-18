import { rand, pick } from '../ui.js';
import { sprint } from './sprint.js';

const COINS = [
  { v: 1, label: '1p', bg: '#c8743c', size: 40 }, { v: 2, label: '2p', bg: '#c8743c', size: 48 },
  { v: 5, label: '5p', bg: '#d6dbe1', size: 36 }, { v: 10, label: '10p', bg: '#d6dbe1', size: 50 },
  { v: 20, label: '20p', bg: '#d6dbe1', size: 44 }, { v: 50, label: '50p', bg: '#d6dbe1', size: 54 },
  { v: 100, label: '£1', bg: '#f0c64a', size: 48 }, { v: 200, label: '£2', bg: '#e8c25a', size: 56, ring: '#cfd5dc' },
];
const coinHtml = c => `<div style="width:${c.size}px;height:${c.size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,transparent 60%),${c.bg};${c.ring ? `box-shadow:0 0 0 5px ${c.ring} inset,` : 'box-shadow:'}0 3px 0 rgba(0,0,0,.18);display:grid;place-items:center;font-weight:900;font-size:${c.size > 45 ? 15 : 12}px;color:#3a2f22;animation:popIn .35s var(--spring) both">${c.label}</div>`;

function makeQ(level) {
  const n = rand(3, 5 + level);
  const pool = level < 3 ? COINS.slice(0, 6) : COINS;
  const coins = Array.from({ length: n }, () => pick(pool)).sort((a, b) => b.v - a.v);
  const total = coins.reduce((s, c) => s + c.v, 0);
  return {
    html: `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;max-width:340px">${coins.map((c, i) => coinHtml(c).replace('both"', `both;animation-delay:${i * 40}ms"`)).join('')}</div>
      <div class="subtitle" style="margin-top:14px;font-size:18px">How much is that in pence?</div>`,
    ans: String(total),
  };
}

export default {
  free: true, id: 'change', name: 'Coin Counter', icon: '🪙', color: '#e0a800', unlock: 1,
  desc: 'Add up a handful of coins', how: 'Add up the coins and write the total in pence. For example £1 and 20p is 120.',
  better: 'lower',
  format: s => `${s.toFixed(1)} s`,
  medal: s => s < 40 ? 4 : s < 60 ? 3 : s < 85 ? 2 : s < 120 ? 1 : 0,
  async run(ctx) {
    const qs = Array.from({ length: 10 }, (_, i) => makeQ(Math.floor(i / 2)));
    const r = await sprint(ctx, qs, { penalty: 5 });
    return { score: r.secs, stats: { Correct: `${r.count - r.wrong} / ${r.count}`, Penalty: `+${r.wrong * 5} s` } };
  },
};
