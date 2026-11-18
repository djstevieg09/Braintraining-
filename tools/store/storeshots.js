const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2]; const RAW = OUT + '/raw'; fs.mkdirSync(RAW, { recursive: true });

function seed() {
  const z = n => String(n).padStart(2, '0');
  const day = k => { const d = new Date(); d.setDate(d.getDate() - k); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
  const ages = [54, 51, 49, 47, 46, 43, 41, 40, 38, 36, 35, 33, 31];
  const p = { id: 'p1', name: 'Sam', birthYear: 1979, color: '#ff8a3d', created: day(20), input: 'keys', history: {}, best: {}, brainAge: [], days: {}, inkSamples: {} };
  ages.forEach((a, i) => { const k = ages.length - i; p.brainAge.push({ date: day(k), age: a, parts: [] }); p.days[day(k)] = { done: ['maths', 'colour', 'words'], check: true }; });
  const mathsScores = [62, 58, 55, 51, 49, 46, 44, 41, 40, 37, 35, 33, 31];
  p.history.maths = mathsScores.map((s, i) => ({ date: day(ages.length - i), score: s, t: 0 }));
  Object.assign(p.best, { maths: 31.4, colour: 21.8, words: 13, reaction: 284, change: 44.2, sudoku: 412, count: 5, clock: 38.5, numbers: 8, dots: 17, chain: 47.1, odd: 21, sequence: 9, pattern: 7, reading: 196 });
  return { profiles: [p], current: 'p1', settings: { sound: false, music: false, unlockAll: true, full: true } };
}

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 400, height: 711 }, deviceScaleFactor: 2.7 });
  await pg.addInitScript(d => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('brainlark.v1', d); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(seed()));
  await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(700);
  const snap = async n => { await pg.waitForTimeout(900); await pg.screenshot({ path: `${RAW}/${n}.png` }); };
  await pg.click('.screen'); await pg.waitForTimeout(400);
  await snap('home');
  await pg.click('[data-go="train"]'); await snap('train');
  await pg.click('[data-id="maths"]'); await pg.waitForTimeout(600); await pg.click('[data-start]'); await pg.waitForTimeout(3300);
  // switch to handwriting and draw an answer for the screenshot
  await pg.click('.screen:not(.leave) .input-tools button'); await pg.waitForTimeout(400);
  const q = await pg.textContent('.screen:not(.leave) .slot-top .big'); const m = q.match(/(\d+) (.) (\d+)/);
  const ans = String(m[2] === '+' ? +m[1] + +m[3] : m[2] === '-' ? m[1] - m[3] : m[1] * m[3]);
  const box = await pg.locator('.inkpad canvas').boundingBox();
  const SH = { 0: [[[0, -1], [-.7, -.6], [-.8, .4], [0, 1], [.75, .4], [.7, -.6], [0, -1]]], 1: [[[-.3, -.6], [0, -1], [0, 1]]], 2: [[[-.7, -.5], [-.3, -1], [.4, -.95], [.7, -.5], [.4, .1], [-.7, 1], [.8, 1]]], 3: [[[-.6, -.8], [.1, -1], [.6, -.6], [0, -.05], [.7, .4], [.2, 1], [-.6, .8]]], 4: [[[.3, -1], [-.7, .4], [.8, .4]], [[.35, -.4], [.35, 1]]], 5: [[[.6, -1], [-.5, -1], [-.6, -.1], [.3, -.2], [.7, .4], [.2, 1], [-.6, .8]]], 6: [[[.5, -1], [-.4, -.3], [-.6, .5], [-.1, 1], [.5, .6], [.3, 0], [-.5, .2]]], 7: [[[-.7, -1], [.7, -1], [-.2, 1]]], 8: [[[.5, -.7], [0, -1], [-.5, -.7], [.5, .3], [0, 1], [-.5, .4], [.5, -.4], [.4, -.8]]], 9: [[[.6, -.6], [0, -1], [-.6, -.6], [0, -.1], [.6, -.6], [.5, 1]]] };
  for (const [i, ch] of [...ans].entries()) for (const st of SH[ch]) {
    const cx = box.x + 70 + i * 95, cy = box.y + box.height / 2;
    await pg.mouse.move(cx + st[0][0] * 32, cy + st[0][1] * 55); await pg.mouse.down();
    for (const pt of st.slice(1)) await pg.mouse.move(cx + pt[0] * 32, cy + pt[1] * 55, { steps: 5 });
    await pg.mouse.up();
  }
  await pg.screenshot({ path: `${RAW}/maths.png` });
  await pg.click('[data-quit]'); await pg.waitForTimeout(600);
  await pg.click('[data-id="count"]'); await pg.waitForTimeout(600); await pg.click('[data-start]'); await pg.waitForTimeout(3300 + 2600);
  await pg.screenshot({ path: `${RAW}/count.png` });
  await pg.click('[data-quit]'); await pg.waitForTimeout(600);
  await pg.click('[data-back]'); await pg.waitForTimeout(500);
  await pg.click('[data-go="progress"]'); await pg.waitForTimeout(1800); await pg.screenshot({ path: `${RAW}/progress.png` });
  // share card
  const lark = fs.readFileSync(process.argv[3], 'utf8');
  const url = await pg.evaluate(async lark => { const { makeCard } = await import('/js/share.js'); return makeCard({ label: 'My Brain Age today', big: '31', line: 'Lightning sharp! ⚡', sub: '23 years younger than day one', mascotSvg: `<svg viewBox="0 0 120 120">${lark}</svg>` }); }, lark);
  fs.writeFileSync(`${RAW}/card.png`, Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
})();
