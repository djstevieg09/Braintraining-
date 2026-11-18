import { mark, sleep } from '../ui.js';

// Shared runner for "answer N questions as fast as you can" exercises.
// questions: [{ html, ans }]; returns { secs, wrong }.
export async function sprint(ctx, questions, { penalty = 3, onShow } = {}) {
  let i = 0, wrong = 0;
  const count = questions.length;
  const start = performance.now();
  const render = () => {
    ctx.setCorners(`${i + 1} / ${count}`, '');
    ctx.top.innerHTML = questions[i].html;
    onShow && onShow(i);
  };
  render();
  await ctx.race(new Promise(resolve => {
    let busy = false;
    ctx.input({
      onAnswer: (text, final, fits) => {
        if (busy || i >= count) return false;
        const q = questions[i];
        const right = text === q.ans || !!(fits && fits(q.ans));
        if (!right && !final && text.length < q.ans.length) return false;
        busy = true;
        if (!right) wrong++;
        mark(ctx.topPanel, right, 280).then(() => {
          i++; busy = false;
          if (i >= count) resolve(); else render();
        });
        return true;
      },
    });
  }));
  await sleep(150);
  const secs = Math.round(((performance.now() - start) / 1000 + wrong * penalty) * 10) / 10;
  return { secs, wrong, count };
}

export const timeMedal = (base, count, refCount) => s => {
  const k = count / refCount; const t = base.map(x => x * k);
  return s < t[0] ? 4 : s < t[1] ? 3 : s < t[2] ? 2 : s < t[3] ? 1 : 0;
};
