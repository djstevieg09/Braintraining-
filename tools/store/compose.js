const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const DIR = process.argv[2]; const LARK = fs.readFileSync(process.argv[3], 'utf8');
const font = f => 'data:font/woff2;base64,' + fs.readFileSync('/home/user/braintraining-/www/fonts/' + f).toString('base64');
const css = `@font-face{font-family:N;font-weight:900;src:url(${font('nunito-latin-900-normal.woff2')})}@font-face{font-family:N;font-weight:800;src:url(${font('nunito-latin-800-normal.woff2')})}
body{margin:0;font-family:N}`;
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, 'raw', f)).toString('base64');
const SHOTS = [
  ['home.png', 'How young is<br>your brain?', 'Find your Brain Age in 3 minutes'],
  ['maths.png', 'Just write<br>your answer', 'Smart handwriting reader, or use the keypad'],
  ['train.png', '15 brain<br>workouts', 'Memory, maths, focus, speed and more'],
  ['progress.png', 'Watch your<br>brain get younger', 'Charts, stamps and daily streaks'],
  ['count.png', 'Fun, fresh<br>and calming', 'Smooth animations and warm, natural sounds'],
  ['card.png', 'Challenge<br>your friends', 'Share your score in one tap'],
];
const BG = ['#ff8a3d', '#20b8a8', '#8d5cf6', '#4d7cfe', '#ff5d8f', '#ffb547'];
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  fs.mkdirSync(path.join(DIR, 'screenshots'), { recursive: true });
  for (const [i, [f, t, s]] of SHOTS.entries()) {
    const isCard = f === 'card.png';
    await pg.setContent(`<style>${css}</style><body style="width:1080px;height:1920px;overflow:hidden;background:radial-gradient(120% 70% at 50% 0%,${BG[i]},#1d1b3a 75%);color:#fff;text-align:center">
      <div style="padding-top:110px;font-weight:900;font-size:104px;line-height:1.02;letter-spacing:-2px;text-shadow:0 6px 0 rgba(0,0,0,.2)">${t}</div>
      <div style="margin-top:28px;font-weight:800;font-size:44px;opacity:.85">${s}</div>
      <img src="${img(f)}" style="margin-top:70px;width:${isCard ? 760 : 700}px;border-radius:${isCard ? 40 : 56}px;box-shadow:0 30px 80px rgba(0,0,0,.5);border:${isCard ? 0 : 10}px solid #0f0d24">
    </body>`);
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(DIR, 'screenshots', `${i + 1}-${f}`) });
  }
  // feature graphic 1024x500
  await pg.setViewportSize({ width: 1024, height: 500 });
  await pg.setContent(`<style>${css}</style><body style="width:1024px;height:500px;overflow:hidden;background:radial-gradient(90% 120% at 30% 0%,#4a3a92,#1d1b3a 70%);display:flex;align-items:center;gap:40px;padding:0 70px;box-sizing:border-box;color:#fff">
    <svg width="300" height="300" viewBox="0 0 120 120">${LARK}</svg>
    <div><div style="font-weight:900;font-size:110px;letter-spacing:-3px;line-height:1">Brain<span style="color:#ffc93c">lark</span></div>
    <div style="font-weight:800;font-size:38px;margin-top:14px;opacity:.9">Daily brain training</div>
    <div style="display:inline-block;margin-top:22px;background:#ff8a3d;border-radius:99px;padding:10px 26px;font-weight:900;font-size:30px">No ads · Pay once</div></div></body>`);
  await pg.screenshot({ path: path.join(DIR, 'feature-graphic-1024x500.png') });
  // store icon 512
  await pg.setViewportSize({ width: 512, height: 512 });
  await pg.setContent(`<body style="margin:0;width:512px;height:512px;background:#1d1b3a;display:grid;place-items:center"><svg width="440" height="440" viewBox="0 0 120 120">${LARK}</svg></body>`);
  await pg.screenshot({ path: path.join(DIR, 'icon-512.png') });
  await b.close();
})();
