import { pick, shuffle, sleep, mark } from '../ui.js';
import { sfx } from '../audio.js';

const PASSAGES = [
  { text: 'Every spring, a small fishing town on the coast holds a kite festival. Families bring kites shaped like whales, dragons and even teapots. The wind off the sea is strong and steady, so the kites climb high above the harbour. At sunset, the fishermen tie lanterns to their boats and sail out together, and the whole bay glows orange while the last kites drift down onto the sand.', q: 'What do the fishermen tie to their boats?', a: 'Lanterns', wrong: ['Kites', 'Flags'] },
  { text: 'Maya decided to grow tomatoes on her balcony. She bought three pots, a bag of soil and a packet of seeds. For weeks nothing happened, and she almost gave up. Then one morning she spotted tiny green shoots pushing through the soil. By late summer the plants were taller than her, and she had so many tomatoes that she started leaving bags of them on her neighbours’ doorsteps.', q: 'How many pots did Maya buy?', a: 'Three', wrong: ['Two', 'Five'] },
  { text: 'The old lighthouse keeper had a cat named Pepper who refused to go outside. Pepper spent every day curled on the warm lamp room floor, watching ships pass by. One stormy night the power failed, and the keeper climbed the stairs with a torch. He found Pepper sitting right beside the spare fuse box, as if she had been waiting to show him where it was all along.', q: 'Where did the keeper find Pepper?', a: 'By the fuse box', wrong: ['On the stairs', 'Outside'] },
  { text: 'A bus driver in a busy city keeps a jar of sweets beside his seat. Anyone who says good morning gets to take one. At first only a few children played along, but soon office workers, students and grandparents were greeting him too. The jar needs filling twice a week now, and the driver says his route has become the friendliest one in town.', q: 'What do passengers have to say to get a sweet?', a: 'Good morning', wrong: ['Thank you', 'Hello driver'] },
  { text: 'Deep in a forest, two friends built a treehouse from leftover planks and an old red door. It took them the whole summer holiday. They added a rope ladder, a bucket on a pulley for snacks and a small window facing the river. On the last night before school started, they slept up there and counted shooting stars until they both fell asleep.', q: 'What colour was the door they used?', a: 'Red', wrong: ['Blue', 'Green'] },
  { text: 'Every Saturday, a baker at the corner of the market tries a brand new bread recipe. Some weeks it is olive and rosemary, other weeks it is honey and walnut. Customers vote on a chalkboard by the door, and the favourite joins the regular menu. Last year the winner was a cheese and onion loaf that now sells out before nine o’clock each morning.', q: 'Which loaf won last year?', a: 'Cheese and onion', wrong: ['Honey and walnut', 'Olive and rosemary'] },
];

export default {
  id: 'reading', name: 'Read Aloud', icon: '📖', color: '#ff8a3d', unlock: 6,
  desc: 'Read a short story out loud, fast and clear', how: 'Read the story OUT LOUD as quickly as you can while still saying every word clearly. Tap Done when you finish, then answer a question about it.',
  better: 'higher',
  format: s => `${s} wpm`,
  medal: s => s >= 230 ? 4 : s >= 190 ? 3 : s >= 150 ? 2 : s >= 110 ? 1 : 0,
  async run(ctx) {
    const p = pick(PASSAGES);
    const words = p.text.split(/\s+/).length;
    ctx.topPanel.style.flexBasis = '62%';
    ctx.top.innerHTML = `<div style="text-align:left;font-size:18px;line-height:1.55;font-weight:700;padding:6px 4px;overflow:auto;max-height:100%">${p.text}</div>`;
    ctx.bottom.innerHTML = `<div class="col" style="margin:auto 0;width:100%;align-items:center"><div class="big" data-t style="font-size:44px">0.0</div><button class="btn teal" data-done style="width:100%;margin-top:10px">Done!</button></div>`;
    const tEl = ctx.bottom.querySelector('[data-t]');
    const start = performance.now();
    const iv = setInterval(() => { tEl.textContent = ((performance.now() - start) / 1000).toFixed(1); }, 100);
    ctx.onCleanup(() => clearInterval(iv));
    await ctx.race(new Promise(r => ctx.bottom.querySelector('[data-done]').onclick = () => { sfx.tap(); r(); }));
    clearInterval(iv);
    const secs = (performance.now() - start) / 1000;
    ctx.topPanel.style.flexBasis = '';
    ctx.top.innerHTML = `<div class="title" style="font-size:24px">${p.q}</div>`;
    const opts = shuffle([p.a, ...p.wrong]);
    ctx.bottom.innerHTML = `<div class="col" style="margin:auto 0;width:100%">${opts.map(o => `<button class="btn ghost" data-o="${o}">${o}</button>`).join('')}</div>`;
    const right = await ctx.race(new Promise(r => ctx.bottom.querySelector('.col').onclick = e => { const b = e.target.closest('[data-o]'); if (b) r(b.dataset.o === p.a); }));
    await mark(ctx.topPanel, right, 700);
    let wpm = Math.round(words / secs * 60);
    if (wpm > 400) wpm = 400; // nobody reads aloud that fast
    if (!right) wpm = Math.round(wpm / 2);
    await sleep(100);
    return { score: wpm, stats: { Time: `${secs.toFixed(1)} s`, Question: right ? 'Correct' : 'Missed (score halved)' } };
  },
};
