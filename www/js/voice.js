// Optional voice answers (Android speech recognition through a Capacitor plugin).
const SR = () => window.Capacitor?.Plugins?.SpeechRecognition;

export async function voiceAvailable() {
  try { const sr = SR(); if (!sr) return false; const { available } = await sr.available(); return !!available; } catch { return false; }
}

export async function ensurePermission() {
  const sr = SR(); if (!sr) return false;
  try {
    let st = await sr.checkPermissions();
    if (st.speechRecognition !== 'granted') st = await sr.requestPermissions();
    return st.speechRecognition === 'granted';
  } catch { return false; }
}

// Keeps listening (restarting after pauses) and calls onWords(lowercase string) for each partial result.
export async function listen(onWords) {
  const sr = SR(); if (!sr) return () => {};
  let active = true;
  const h1 = await sr.addListener('partialResults', d => { if (active && d.matches && d.matches[0]) onWords(String(d.matches[0]).toLowerCase()); });
  const h2 = await sr.addListener('listeningState', d => { if (active && d.status === 'stopped') setTimeout(start, 80); });
  async function start() { if (!active) return; try { await sr.start({ language: 'en-GB', maxResults: 3, partialResults: true, popup: false }); } catch {} }
  start();
  return async () => { active = false; try { await sr.stop(); } catch {} h1?.remove?.(); h2?.remove?.(); };
}
