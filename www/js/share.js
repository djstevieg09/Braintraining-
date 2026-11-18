// Shareable result cards: draws a picture and opens the phone's share menu.
export const STORE_URL = 'https://play.google.com/store/apps/details?id=com.brainlark.app';

function loadSvg(svg) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
  });
}

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// opts: { label, big, bigColor, line, sub, mascotSvg }
export async function makeCard({ label, big, line, sub, mascotSvg, accent = '#ff8a3d' }) {
  await Promise.all([document.fonts.load('900 100px Nunito'), document.fonts.load('800 40px Nunito')]).catch(() => {});
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(W / 2, 0, 50, W / 2, 200, 1300);
  bg.addColorStop(0, '#4a3a92'); bg.addColorStop(0.6, '#1d1b3a'); bg.addColorStop(1, '#151330');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // confetti dots
  const cols = ['#ff8a3d', '#20b8a8', '#ff5d8f', '#ffc93c', '#4d7cfe', '#8d5cf6'];
  for (let i = 0; i < 70; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.35 + (i % 5) * 0.1; const x = (i * 397) % W, y = (i * 211) % H; g.save(); g.translate(x, y); g.rotate(i); g.fillRect(-7, -12, 14, 24); g.restore(); }
  g.globalAlpha = 1;
  // header: mascot + wordmark
  const m = mascotSvg ? await loadSvg(mascotSvg) : null;
  if (m) g.drawImage(m, W / 2 - 110, 70, 220, 220);
  g.textAlign = 'center'; g.font = '900 96px Nunito';
  const t1 = 'Brain', t2 = 'lark';
  const w1 = g.measureText(t1).width, w2 = g.measureText(t2).width, x0 = W / 2 - (w1 + w2) / 2;
  g.textAlign = 'left';
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillText(t1, x0, 392); g.fillText(t2, x0 + w1, 392);
  g.fillStyle = '#fff'; g.fillText(t1, x0, 384); g.fillStyle = '#ffc93c'; g.fillText(t2, x0 + w1, 384);
  // panel
  g.fillStyle = '#fffaf0'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 40; g.shadowOffsetY = 16;
  rr(g, 90, 450, W - 180, 640, 56); g.fill();
  g.shadowColor = 'transparent';
  g.textAlign = 'center';
  g.fillStyle = '#6c6485'; g.font = '900 46px Nunito'; g.fillText(label.toUpperCase(), W / 2, 560);
  g.fillStyle = accent; g.font = `900 ${String(big).length > 6 ? 150 : 250}px Nunito`; g.fillText(big, W / 2, String(big).length > 6 ? 790 : 830);
  g.fillStyle = '#2b2540'; g.font = '900 62px Nunito'; g.fillText(line, W / 2, 960);
  if (sub) { g.fillStyle = '#6c6485'; g.font = '800 40px Nunito'; g.fillText(sub, W / 2, 1035); }
  // footer
  g.fillStyle = '#fff'; g.font = '900 52px Nunito'; g.fillText('Can you beat it?', W / 2, 1190);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '800 36px Nunito'; g.fillText('Train your brain in minutes a day with Brainlark', W / 2, 1260);
  return c.toDataURL('image/png');
}

// Opens the share sheet with the image and text. Returns true if something was shared or saved.
export async function shareImage(dataUrl, text) {
  const P = window.Capacitor?.Plugins;
  const full = `${text}\n${STORE_URL}`;
  if (window.Capacitor?.isNativePlatform?.() && P?.Share && P?.Filesystem) {
    try {
      const { uri } = await P.Filesystem.writeFile({ path: `brainlark-result-${Date.now()}.png`, data: dataUrl.split(',')[1], directory: 'CACHE' });
      await P.Share.share({ title: 'My Brainlark result', text: full, files: [uri], dialogTitle: 'Share your result' });
      return true;
    } catch (e) { if (/cancel/i.test(String(e?.message))) return false; }
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'brainlark-result.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: full }); return true; }
  } catch (e) { if (e?.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = dataUrl; a.download = 'brainlark-result.png'; document.body.appendChild(a); a.click(); a.remove();
  return true;
}
