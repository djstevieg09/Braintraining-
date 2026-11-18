const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const sizeOf = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const RES = process.argv[2];
const face = `<defs><radialGradient id="lg" cx="35%" cy="30%"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff8a3d"/></radialGradient></defs>
  <circle cx="60" cy="62" r="50" fill="url(#lg)"/>
  <path d="M56 40 Q48 22 38 24 Q48 28 50 40 Z M62 38 Q62 20 52 16 Q58 24 57 38 Z" fill="#2b2540"/>
  <path d="M28 84 Q14 92 12 102 Q24 98 36 90 Z" fill="#2b2540"/>
  <ellipse cx="58" cy="66" rx="32" ry="30" fill="#fffaf0"/>
  <path d="M40 60 Q36 84 62 90 Q50 76 56 60 Z" fill="#ffb547"/>
  <path d="M40 60 Q44 74 58 80" stroke="#e8913a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="68" cy="54" r="6" fill="#2b2540"/><circle cx="70" cy="52" r="2.2" fill="#fff"/>
  <path d="M84 58 L100 62 L84 67 Z" fill="#2b2540"/>
  <circle cx="74" cy="68" r="4" fill="#ff8a8a" opacity=".55"/>
  <path d="M52 95 v8 M64 95 v8" stroke="#2b2540" stroke-width="3.5" stroke-linecap="round"/>`;
const page = (w, h, body, bg = 'transparent') => `<html><body style="margin:0;width:${w}px;height:${h}px;background:${bg};display:grid;place-items:center;overflow:hidden">${body}</body></html>`;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const shot = async (file, w, h, html) => { await pg.setViewportSize({ width: w, height: h }); await pg.setContent(html); await pg.screenshot({ path: file, omitBackground: true }); };
  for (const d of fs.readdirSync(RES)) {
    for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'splash.png']) {
      const fp = path.join(RES, d, f); if (!fs.existsSync(fp)) continue;
      const [w, h] = sizeOf(fp);
      if (f === 'splash.png') {
        const s = Math.min(w, h) * 0.32;
        await shot(fp, w, h, page(w, h, `<div style="text-align:center"><svg width="${s}" height="${s}" viewBox="0 0 120 120">${face}</svg></div>`, '#1d1b3a'));
      } else if (f === 'ic_launcher_foreground.png') {
        const s = w * 0.62; await shot(fp, w, h, page(w, h, `<svg width="${s}" height="${s}" viewBox="0 0 120 120">${face}</svg>`));
      } else {
        const round = f.includes('round');
        await shot(fp, w, h, page(w, h, `<div style="width:${w}px;height:${h}px;border-radius:${round ? '50%' : '22%'};background:#1d1b3a;display:grid;place-items:center"><svg width="${w * .8}" height="${w * .8}" viewBox="0 0 120 120">${face}</svg></div>`));
      }
    }
  }
  await pg.setViewportSize({ width: 512, height: 512 });
  await pg.setContent(page(512, 512, `<svg width="420" height="420" viewBox="0 0 120 120">${face}</svg>`, '#1d1b3a'));
  await pg.screenshot({ path: RES + '/../../../../../store-icon-512.png' });
  await b.close();
})();
