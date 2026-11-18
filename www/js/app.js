import * as audio from './audio.js';
import { sfx } from './audio.js';
import * as store from './store.js';
import { show, dualScreen, countdown, sleep, esc, h, confetti, countUp, lineChart, toast, quitWatcher, Quit, shuffle } from './ui.js';
import { createAnswerInput, setUserSamples, createInkPad } from './ink.js';
import { EXERCISES, byId, CHECK_POOL } from './exercises/index.js';
import { voiceAvailable, ensurePermission } from './voice.js';
import * as pay from './purchase.js';
import { makeCard, shareImage } from './share.js';

const MEDALS = [
  { name: 'Warm-up', color: '#b9ad97', ring: '#9b8f7a' },
  { name: 'Bronze', color: '#e09a5b', ring: '#b8733a' },
  { name: 'Silver', color: '#c9d3df', ring: '#97a3b3' },
  { name: 'Gold', color: '#ffd04a', ring: '#e0a800' },
  { name: 'Soaring!', color: '#ff8a3d', ring: '#ff5d8f' },
];
const medalSvg = m => {
  const M = MEDALS[m];
  const inner = m === 4
    ? '<path d="M66 18 L38 66 H58 L50 102 L84 50 H62 Z" fill="#fff"/>'
    : `<path d="M60 30 l8.8 18 19.7 2.9 -14.3 13.9 3.4 19.6 L60 75 l-17.6 9.4 3.4-19.6 -14.3-13.9 19.7-2.9z" fill="#fff" opacity="${m ? 1 : .7}"/>`;
  return `<svg class="medal" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="${M.ring}"/><circle cx="60" cy="60" r="45" fill="${M.color}"/>${inner}</svg>`;
};

const SPARK = `<svg class="spark" viewBox="0 0 120 120" aria-hidden="true">
  <defs><radialGradient id="lg" cx="35%" cy="30%"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff8a3d"/></radialGradient></defs>
    <circle cx="60" cy="62" r="50" fill="url(#lg)"/>
    <path d="M56 40 Q48 22 38 24 Q48 28 50 40 Z M62 38 Q62 20 52 16 Q58 24 57 38 Z" fill="#2b2540"/>
    <path d="M28 84 Q14 92 12 102 Q24 98 36 90 Z" fill="#2b2540"/>
    <ellipse cx="58" cy="66" rx="32" ry="30" fill="#fffaf0"/>
    <path d="M40 60 Q36 84 62 90 Q50 76 56 60 Z" fill="#ffb547"/>
    <path d="M40 60 Q44 74 58 80" stroke="#e8913a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="68" cy="54" r="6" fill="#2b2540"/><circle cx="70" cy="52" r="2.2" fill="#fff"/>
    <path d="M84 58 L100 62 L84 67 Z" fill="#2b2540"/>
    <circle cx="74" cy="68" r="4" fill="#ff8a8a" opacity=".55"/>
    <path d="M52 95 v8 M64 95 v8" stroke="#2b2540" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;

const fmtDate = (d = new Date()) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const needsFull = ex => !ex.free && !pay.isFull();
const dayOpen = ex => store.settings().unlockAll || store.daysTrained() >= ex.unlock;
const unlocked = ex => !needsFull(ex) && dayOpen(ex);
const maxProfiles = () => pay.isFull() ? 4 : pay.FREE_PROFILES;

// ---------------- splash ----------------
function splash() {
  const s = show(`
    <div class="col center grow" style="justify-content:center;align-items:center;gap:18px">
      ${SPARK}
      <div class="logo">Brain<span class="b2">lark</span></div>
      <div class="chip">A few minutes a day keeps your brain sharp</div>
    </div>
    <div class="center pulse" style="color:#fff;font-weight:900;font-size:20px;padding-bottom:30px">Tap to start</div>`);
  s.addEventListener('click', () => {
    audio.init(); applySettings(); sfx.go(); audio.startMusic('menu');
    const p = store.current();
    if (p) { setUserSamples(p.inkSamples); home(); } else profiles();
  }, { once: true });
}

function applySettings() { const st = store.settings(); audio.setEnabled(st.sound); audio.setMusic(st.music); }

// ---------------- profiles ----------------
function profiles() {
  const list = store.profiles();
  const s = show(`
    <div class="topbar"><h2>Who's training?</h2></div>
    <div class="list stagger scroll grow">
      ${list.map(p => `<button class="card" data-id="${p.id}">
        <div class="emoji" style="background:${p.color};color:#fff;font-weight:900">${esc(p.name[0].toUpperCase())}</div>
        <div><div class="name">${esc(p.name)}</div><div class="desc">${store.streak(p)} day streak · ${p.brainAge.length ? 'Brain Age ' + p.brainAge[p.brainAge.length - 1].age : 'No check yet'}</div></div>
      </button>`).join('')}
      ${list.length < maxProfiles() ? `<button class="card" data-new><div class="emoji" style="background:var(--panel-2)">＋</div><div><div class="name">New player</div><div class="desc">${pay.isFull() ? 'Up to 4 players' : 'Add your first player'}</div></div></button>`
        : list.length < 4 ? `<button class="card locked" data-up><div class="emoji" style="background:var(--panel-2)">🔒</div><div><div class="name">Add more players</div><div class="desc">Up to 4 players with Brainlark Full</div></div></button>` : ''}
    </div>`);
  s.querySelector('.list').onclick = e => {
    const c = e.target.closest('.card'); if (!c) return; sfx.tap();
    if (c.dataset.new != null) return newProfile();
    if (c.dataset.up != null) return upgrade('players', profiles);
    store.select(c.dataset.id); setUserSamples(store.current().inkSamples); home();
  };
}

function newProfile() {
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>New player</h2></div>
    <div class="panel" style="padding:20px">
      <div class="col">
        <label class="name" style="font-weight:900">Your name</label>
        <input class="field" maxlength="12" placeholder="Name" autocomplete="off">
        <label style="font-weight:900;margin-top:8px">Year you were born <span class="muted">(optional)</span></label>
        <input class="field" type="number" inputmode="numeric" placeholder="e.g. 1990" data-year>
        <div class="muted" style="font-weight:700;font-size:14px">Used only to compare your Brain Age with your real age.</div>
      </div>
    </div>
    <div class="grow"></div>
    <button class="btn" data-go>Let's go!</button>`, {});
  const name = s.querySelector('input');
  s.querySelector('[data-back]').onclick = () => { sfx.tap(); profiles(); };
  s.querySelector('[data-go]').onclick = () => {
    if (!name.value.trim()) { name.classList.add('shake'); setTimeout(() => name.classList.remove('shake'), 400); sfx.wrong(); return; }
    const y = parseInt(s.querySelector('[data-year]').value, 10);
    store.createProfile(name.value, y > 1900 && y < 2030 ? y : null);
    setUserSamples({}); sfx.stamp(); home();
  };
}

// ---------------- home ----------------
function home(back = true) {
  const p = store.current(); if (!p) return profiles();
  audio.startMusic('menu');
  const ba = p.brainAge[p.brainAge.length - 1];
  const todayDone = p.days[store.today()];
  const checkedToday = todayDone?.check;
  const s = show(`
    <div class="topbar">
      <button class="chip" data-switch style="background:${p.color}">${esc(p.name)} ▾</button>
      <div class="grow"></div>
      <button class="icon-btn" data-settings aria-label="Settings">⚙</button>
    </div>
    <div class="panel" style="padding:18px 18px 16px">
      <div class="row">
        <div class="grow">
          <div class="muted" style="font-weight:800">${fmtDate()}</div>
          <div class="title" style="font-size:26px;margin-top:2px">${greeting()}, ${esc(p.name)}!</div>
          <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
            <span class="chip" style="background:var(--orange)">🔥 ${store.streak(p)} day streak</span>
            <span class="chip" style="background:${todayDone ? 'var(--green)' : 'var(--line)'};color:${todayDone ? '#fff' : 'var(--ink-soft)'}">${todayDone ? '✓ Stamp earned' : 'No stamp yet today'}</span>
          </div>
        </div>
        <div class="center" style="min-width:92px">
          <div class="muted" style="font-weight:900;font-size:12px">BRAIN AGE</div>
          <div class="big" style="font-size:52px;color:var(--orange)">${ba ? ba.age : '?'}</div>
        </div>
      </div>
    </div>
    <div class="list stagger grow scroll">
      <button class="card" data-go="check">
        <div class="emoji" style="background:var(--orange)">🧠</div>
        <div><div class="name">Brain Age Check</div><div class="desc">${checkedToday ? 'Done today. Play again for fun' : '3 quick tests, about 3 minutes'}</div></div>
      </button>
      <button class="card" data-go="train">
        <div class="emoji" style="background:var(--teal)">🏋️</div>
        <div><div class="name">Daily Training</div><div class="desc">${(todayDone?.done.length || 0)} done today · ${EXERCISES.filter(unlocked).length} of ${EXERCISES.length} unlocked</div></div>
      </button>
      <button class="card" data-go="progress">
        <div class="emoji" style="background:var(--blue)">📈</div>
        <div><div class="name">My Progress</div><div class="desc">Charts, stamps and best scores</div></div>
      </button>
      ${pay.isFull() ? '' : `<button class="card" data-go="upgrade" style="background:linear-gradient(135deg,#fff3d6,#ffe1c7)">
        <div class="emoji" style="background:var(--pink)">⭐</div>
        <div><div class="name">Get Brainlark Full</div><div class="desc">All 15 exercises, charts and 4 players. One payment, no ads.</div></div>
      </button>`}
    </div>`, { back });
  s.querySelector('[data-switch]').onclick = () => { sfx.tap(); profiles(); };
  s.querySelector('[data-settings]').onclick = () => { sfx.tap(); settings(); };
  s.querySelector('.list').onclick = e => {
    const g = e.target.closest('[data-go]')?.dataset.go; if (!g) return; sfx.tap();
    ({ check: brainCheckIntro, train: training, progress, upgrade: () => upgrade('home', home) })[g]();
  };
}
const greeting = () => { const hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; };

// ---------------- training list ----------------
function training(back = false) {
  const p = store.current();
  const done = p.days[store.today()]?.done || [];
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>Daily Training</h2></div>
    <div class="list stagger scroll grow">
      ${EXERCISES.map(ex => {
        const open = unlocked(ex), best = p.best[ex.id], paid = needsFull(ex);
        return `<button class="card ${open ? '' : 'locked'}" data-id="${ex.id}">
          <div class="emoji" style="background:${ex.color}">${open ? ex.icon : '🔒'}</div>
          <div class="grow"><div class="name">${ex.name}</div><div class="desc">${open ? ex.desc : paid ? ex.desc : `Unlocks after ${ex.unlock} day${ex.unlock > 1 ? 's' : ''} of training`}</div></div>
          ${paid ? '<span class="badge" style="background:var(--pink);color:#fff">Full</span>' : open ? (done.includes(ex.id) ? '<span class="badge done">✓ Today</span>' : best != null ? `<span class="badge">Best ${ex.format(best)}</span>` : '<span class="badge">New</span>') : ''}
        </button>`;
      }).join('')}
    </div>`, { back });
  s.querySelector('[data-back]').onclick = () => { sfx.tap(); home(); };
  s.querySelector('.list').onclick = e => {
    const c = e.target.closest('[data-id]'); if (!c) return;
    const ex = byId(c.dataset.id);
    if (needsFull(ex)) { sfx.tap(); upgrade('exercise', () => training(true)); return; }
    if (!unlocked(ex)) { sfx.wrong(); c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 400); toast(`Train on ${ex.unlock} different day${ex.unlock > 1 ? 's' : ''} to unlock this`); return; }
    sfx.tap(); playTraining(ex);
  };
}

async function playTraining(ex) {
  const res = await runExercise(ex, {}, { title: ex.name });
  if (!res) return training(true);
  const rec = store.record(ex.id, res, ex.better);
  results(ex, res, rec);
}

// ---------------- exercise runner ----------------
// Shows the intro, countdown, runs the exercise. Returns the result or null if quit.
async function runExercise(ex, opts, { title, step } = {}) {
  audio.stopMusic();
  const p = store.current();
  const s = dualScreen({ title, left: step || '', right: '' });
  const top = s.querySelector('.slot-top'), bottom = s.querySelector('.slot-bottom');
  const topPanel = s.querySelector('.panel.top'), bottomPanel = s.querySelector('.panel.bottom');
  const quit = quitWatcher(s);
  const cleanups = [];
  let input = null;
  const ctx = {
    top, bottom, topPanel, bottomPanel, opts,
    race: x => quit.race(x),
    quitPromise: quit.promise,
    onCleanup: fn => cleanups.push(fn),
    setCorners(l, r) { s.querySelector('.corner.l').textContent = l; s.querySelector('.corner.r').textContent = r; },
    input({ onAnswer }) {
      if (input) input.destroy();
      input = createAnswerInput(bottom, { mode: p.input, onAnswer, onModeChange: m => store.updateProfile(pp => { pp.input = m; }) });
      return input;
    },
  };
  top.innerHTML = `<div class="emoji" style="font-size:54px">${ex.icon}</div><div class="title" style="font-size:26px">${ex.name}</div>
    <div class="subtitle" style="max-width:340px;line-height:1.35">${ex.how}</div>`;
  bottom.innerHTML = `<div class="col" style="margin:auto 0;gap:12px">
    ${p.best[ex.id] != null ? `<div class="center muted" style="font-weight:800">Your best: ${ex.format(p.best[ex.id], opts)}</div>` : ''}
    <button class="btn" data-start style="min-height:64px;font-size:22px">Start</button></div>`;
  try {
    await quit.race(new Promise(r => bottom.querySelector('[data-start]').onclick = () => { sfx.tap(); r(); }));
    bottom.innerHTML = ''; top.innerHTML = '';
    if (!ex.skipCountdown) await quit.race(countdown(top));
    if (ex.id === 'colour' && store.settings().voice) ctx.voice = await ensurePermission();
    const res = await ex.run(ctx, opts);
    return res;
  } catch (e) {
    if (e instanceof Quit) return null;
    console.error(e); toast('Something went wrong'); return null;
  } finally {
    cleanups.forEach(f => { try { f(); } catch {} });
    if (input) input.destroy();
  }
}

// ---------------- results ----------------
function results(ex, res, rec) {
  const m = ex.medal(res.score, res.opts || {});
  const p = store.current();
  const best = p.best[ex.id];
  const s = show(`
    <div class="topbar"><h2>${ex.name}</h2></div>
    <div class="panel top" style="flex-basis:46%">
      ${medalSvg(m)}
      <div class="title" style="margin-top:6px">${MEDALS[m].name}</div>
      <div class="big" style="font-size:46px;margin-top:4px" data-score>${ex.format(res.score, res.opts || {})}</div>
      ${rec.isBest ? '<div class="newbest" style="margin-top:8px">New personal best!</div>' : ''}
    </div>
    <div class="panel bottom">
      <div class="stat-grid">
        ${Object.entries(res.stats || {}).map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('')}
        <div class="stat"><b>${ex.format(best, res.opts || {})}</b><span>Personal best</span></div>
        <div class="stat"><b>${(p.history[ex.id] || []).length}</b><span>Times played</span></div>
      </div>
      <div class="muted center" style="font-weight:800;margin:14px 6px;line-height:1.35">${tip(m)}</div>
      <div class="grow"></div>
      <button class="btn teal" data-a="share" style="margin-bottom:10px">📤 Share my score</button>
      <div class="row"><button class="btn ghost grow" data-a="again">Play again</button><button class="btn grow" data-a="done">Done</button></div>
    </div>`);
  if (m >= 3 || rec.isBest) { sfx.fanfare(); confetti(m === 4 ? 180 : 110); } else sfx.sparkle();
  if (rec.firstToday) stampToast();
  s.querySelector('.row').onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; sfx.tap();
    if (a === 'share') return shareResult(e.target.closest('[data-a]'), {
      label: ex.name, big: ex.format(res.score, res.opts || {}), line: `${MEDALS[m].name} ${m >= 3 ? '🏆' : ''}`.trim(),
      sub: rec.isBest ? 'A new personal best!' : '', text: `I got ${ex.format(res.score, res.opts || {})} in ${ex.name} on Brainlark. Can you beat it?`,
    });
    if (a === 'again') playTraining(ex); else training(true);
  };
}
const TIPS = [
  'Every expert started as a beginner. Come back tomorrow and watch the score move!',
  'Nice start. A little practice each day makes a big difference.',
  'Solid work! Try to beat it tomorrow.',
  'Great result! Your brain is warmed up and firing.',
  'Lightning fast! That is a top-tier score.',
];
const tip = m => TIPS[m];

let lastStampDay = null;
function stampToast() {
  const d = store.today(); if (lastStampDay === d) return; lastStampDay = d;
  const p = store.current(); const n = p.days[d]?.done.length || 0;
  if (n === 1 || p.days[d]?.check) setTimeout(() => { sfx.stamp(); toast('Today\'s stamp earned! 🔥 ' + store.streak() + ' day streak'); }, 900);
}

// ---------------- Brain Age check ----------------
function brainCheckIntro() {
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>Brain Age Check</h2></div>
    <div class="panel top">
      ${SPARK}
      <div class="title" style="font-size:24px;margin-top:8px">How young is your brain today?</div>
      <div class="subtitle" style="max-width:330px">Three quick tests. Do your best. The lower your Brain Age, the better. 20 is the top score!</div>
    </div>
    <div class="panel bottom" style="justify-content:flex-end;gap:10px">
      <div class="muted center" style="font-weight:800">Find a quiet spot and get comfy.</div>
      <button class="btn" data-go style="min-height:64px;font-size:22px">Begin the check</button>
    </div>`);
  s.querySelector('[data-back]').onclick = () => { sfx.tap(); home(); };
  s.querySelector('[data-go]').onclick = () => { sfx.tap(); brainCheck(); };
}

async function brainCheck() {
  const picks = shuffle(CHECK_POOL).slice(0, 3);
  const parts = [];
  for (let i = 0; i < picks.length; i++) {
    const ex = byId(picks[i].id);
    const res = await runExercise(ex, picks[i].opts, { title: `Test ${i + 1} of 3`, step: '' });
    if (!res) return home();
    const age = ex.ageFrom(res.score, res.opts || picks[i].opts);
    parts.push({ id: ex.id, score: res.score, age, opts: picks[i].opts });
    store.record(ex.id, { ...res, score: res.score }, ex.better);
  }
  const age = Math.round(parts.reduce((s, x) => s + x.age, 0) / parts.length);
  const prev = store.current().brainAge.slice(-1)[0];
  store.recordBrainAge(age, parts.map(p => ({ id: p.id, age: Math.round(p.age) })));
  revealAge(age, prev, parts);
}

async function revealAge(age, prev, parts) {
  const p = store.current();
  const real = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  const s = show(`
    <div class="topbar"><h2>Your result</h2></div>
    <div class="panel top" style="flex-basis:50%">
      <div class="muted" style="font-weight:900;letter-spacing:1px">YOUR BRAIN AGE IS</div>
      <div class="huge" data-age style="color:var(--orange);font-size:120px">…</div>
      <div class="subtitle" data-msg style="opacity:0;transition:opacity .5s"></div>
    </div>
    <div class="panel bottom" style="opacity:0;transition:opacity .5s" data-more>
      <div class="stat-grid">
        ${parts.map(x => `<div class="stat"><b>${Math.round(x.age)}</b><span>${byId(x.id).name}</span></div>`).join('')}
        <div class="stat"><b>${prev ? prev.age : '–'}</b><span>Last time</span></div>
      </div>
      <div class="grow"></div>
      <div class="row"><button class="btn teal grow" data-share>📤 Share</button><button class="btn grow" data-done>Continue</button></div>
    </div>`);
  sfx.drumroll(1.8);
  await sleep(1900);
  sfx.reveal();
  const ageEl = s.querySelector('[data-age]'); ageEl.classList.add('bump');
  await countUp(ageEl, age, { ms: 700 });
  confetti(age <= 30 ? 200 : 110); if (age <= 35) sfx.fanfare();
  const msg = s.querySelector('[data-msg]');
  let text = age <= 25 ? 'Wow! Lightning sharp!' : age <= 35 ? 'Excellent! Your brain is in great shape.' : age <= 50 ? 'Good work! Daily training will bring that down.' : 'A great starting point. Train daily and watch it drop!';
  if (prev) text += prev.age > age ? ` That's ${prev.age - age} younger than last time!` : prev.age === age ? ' Same as last time.' : '';
  if (real) text += age < real ? ` That's ${real - age} years younger than you!` : '';
  msg.textContent = text; msg.style.opacity = 1;
  s.querySelector('[data-more]').style.opacity = 1;
  stampToast();
  s.querySelector('[data-done]').onclick = () => { sfx.tap(); home(); };
  s.querySelector('[data-share]').onclick = e => shareResult(e.currentTarget, {
    label: 'My Brain Age today', big: String(age), line: age <= 25 ? 'Lightning sharp! ⚡' : age <= 35 ? 'In great shape!' : 'Training every day!',
    sub: prev && prev.age > age ? `${prev.age - age} years younger than last time` : '', text: `My Brain Age today is ${age}! Can you beat it? Try Brainlark.`,
  });
}

// ---------------- progress ----------------
function progress() {
  const p = store.current();
  const ba = p.brainAge.slice(-20);
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>My Progress</h2></div>
    <div class="scroll grow col" style="gap:12px">
      <div class="panel" style="padding:16px">
        <div class="row"><div class="name grow" style="font-weight:900;font-size:18px">Brain Age</div><span class="muted" style="font-weight:800">${ba.length} check${ba.length === 1 ? '' : 's'}</span></div>
        ${pay.isFull() ? lineChart(ba.map(b => b.age), { labels: ba.map(b => b.date.slice(5)), min: 20, max: 80, invert: false }) : lockedChart(ba.length ? `Latest Brain Age: ${ba[ba.length - 1].age}` : 'No checks yet')}
      </div>
      <div class="panel" style="padding:16px">
        <div class="row" style="margin-bottom:10px"><div class="grow" style="font-weight:900;font-size:18px">${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div><span class="chip" style="background:var(--orange)">🔥 ${store.streak()}</span></div>
        ${calendar(p)}
        <div class="muted" style="font-weight:700;font-size:13px;margin-top:8px">Orange stamp: trained that day. Gold stamp: 3 or more exercises.</div>
      </div>
      <div class="list stagger">
        ${EXERCISES.map(ex => `<button class="card" data-id="${ex.id}"><div class="emoji" style="background:${ex.color}">${ex.icon}</div>
          <div class="grow"><div class="name">${ex.name}</div><div class="desc">${(p.history[ex.id] || []).length} plays</div></div>
          <span class="badge">${p.best[ex.id] != null ? 'Best ' + ex.format(p.best[ex.id]) : '–'}</span></button>`).join('')}
      </div>
    </div>`);
  s.querySelector('[data-back]').onclick = () => { sfx.tap(); home(); };
  s.querySelector('[data-up]')?.addEventListener('click', () => { sfx.tap(); upgrade('charts', progress); });
  s.querySelector('.list').onclick = e => { const c = e.target.closest('[data-id]'); if (!c) return; sfx.tap(); exerciseProgress(byId(c.dataset.id)); };
}

function calendar(p) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const key = store.today(new Date(y, m, d)), info = p.days[key];
    const n = info ? info.done.length + (info.check ? 1 : 0) : 0;
    cells += `<div class="day ${n ? 'stamp' : ''} ${n >= 3 ? 'gold' : ''} ${d === now.getDate() ? 'today' : ''}">${d}</div>`;
  }
  return `<div class="cal">${cells}</div>`;
}

function exerciseProgress(ex) {
  const p = store.current();
  const hist = (p.history[ex.id] || []);
  // one point per day: best of the day
  const byDay = {};
  hist.forEach(r => { const b = byDay[r.date]; byDay[r.date] = b == null ? r.score : ex.better === 'lower' ? Math.min(b, r.score) : Math.max(b, r.score); });
  const days = Object.keys(byDay).sort().slice(-20);
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>${ex.name}</h2></div>
    <div class="panel" style="padding:16px">
      <div style="font-weight:900;font-size:18px">Best score each day</div>
      <div class="muted" style="font-weight:700;font-size:13px">${ex.better === 'lower' ? 'Lower is better' : 'Higher is better'}</div>
      ${pay.isFull() ? lineChart(days.map(d => byDay[d]), { labels: days.map(d => d.slice(5)) }) : lockedChart('Track every day with Brainlark Full')}
    </div>
    <div class="stat-grid">
      <div class="stat" style="background:var(--panel)"><b>${p.best[ex.id] != null ? ex.format(p.best[ex.id]) : '–'}</b><span>Personal best</span></div>
      <div class="stat" style="background:var(--panel)"><b>${hist.length}</b><span>Times played</span></div>
    </div>
    <div class="grow"></div>
    ${unlocked(ex) ? '<button class="btn" data-play>Play now</button>' : ''}`, {});
  s.querySelector('[data-back]').onclick = () => { sfx.tap(); progress(); };
  s.querySelector('[data-up]')?.addEventListener('click', () => { sfx.tap(); upgrade('charts', () => exerciseProgress(ex)); });
  s.querySelector('[data-play]')?.addEventListener('click', () => { sfx.tap(); playTraining(ex); });
}

// ---------------- settings ----------------
function settings() {
  const st = store.settings(), p = store.current();
  const row = (key, label, desc, on) => `<div class="card" style="cursor:default"><div class="grow"><div class="name" style="font-size:16px">${label}</div><div class="desc">${desc}</div></div><button class="toggle ${on ? 'on' : ''}" data-t="${key}" aria-label="${label}"></button></div>`;
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>Settings</h2></div>
    <div class="list scroll grow">
      ${row('sound', 'Sound effects', 'Taps, chimes and fanfares', st.sound)}
      ${row('music', 'Menu music', 'Gentle background tunes', st.music)}
      ${row('ink', 'Handwriting answers', 'Off uses a number keypad', p.input === 'ink')}
      ${row('voice', 'Voice answers', 'Say the colour out loud in Colour Clash', st.voice)}
      ${row('unlockAll', 'Test unlock', 'Test builds only: acts as if Full is bought and opens every exercise', st.unlockAll)}
      <button class="card" data-restore><div class="emoji" style="background:var(--panel-2)">↺</div><div><div class="name" style="font-size:16px">${store.settings().full ? 'Brainlark Full is active' : 'Restore purchase'}</div><div class="desc">${store.settings().full ? 'Thank you for your support!' : 'Already bought Full on this Google account? Get it back here'}</div></div></button>
      <button class="card" data-teach><div class="emoji" style="background:var(--yellow)">✍️</div><div><div class="name" style="font-size:16px">Teach my handwriting</div><div class="desc">${Object.keys(p.inkSamples || {}).length ? 'Saved. Tap to redo' : 'Write each number twice so answers are read better'}</div></div></button>
      <button class="card" data-del style="margin-top:10px"><div class="emoji" style="background:#f6d6d6">🗑</div><div><div class="name" style="font-size:16px">Delete ${esc(p.name)}</div><div class="desc">Removes this player and all their results</div></div></button>
      <div class="muted center" style="font-weight:700;font-size:13px;margin-top:6px">Brainlark 0.2 test build</div>
    </div>`);
  s.querySelector('[data-back]').onclick = () => { sfx.tap(); home(); };
  s.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    const k = b.dataset.t; b.classList.toggle('on'); const on = b.classList.contains('on'); sfx.pop();
    if (k === 'ink') store.updateProfile(pp => { pp.input = on ? 'ink' : 'keys'; });
    else if (k === 'voice' && on) {
      voiceAvailable().then(okv => { if (!okv) { b.classList.remove('on'); toast('Voice answers need the Android app with speech recognition'); return; } ensurePermission().then(g => { store.setSetting('voice', g); if (!g) { b.classList.remove('on'); toast('Microphone permission is needed for voice answers'); } }); });
    }
    else { store.setSetting(k, on); applySettings(); if (k === 'music' && on) audio.startMusic('menu'); }
  });
  s.querySelector('[data-teach]').onclick = () => { sfx.tap(); teachInk(); };
  s.querySelector('[data-restore]').onclick = async () => {
    sfx.tap(); if (store.settings().full) return;
    const r = await pay.restore();
    if (r === 'ok') { sfx.fanfare(); confetti(120); toast('Brainlark Full restored!'); settings(); }
    else toast(r === 'none' ? 'No purchase found on this Google account' : 'The Play Store is not available right now');
  };
  let armed = false;
  s.querySelector('[data-del]').onclick = e => {
    const c = e.currentTarget;
    if (!armed) { armed = true; sfx.wrong(); c.querySelector('.name').textContent = 'Tap again to delete for good'; return; }
    store.deleteProfile(p.id); sfx.whoosh(); profiles();
  };
}

// ---------------- sharing ----------------
async function shareResult(btn, { label, big, line, sub, text }) {
  sfx.tap(); if (btn.disabled) return; btn.disabled = true;
  try {
    const img = await makeCard({ label, big, line, sub, mascotSvg: SPARK.replace(' class="spark"', '') });
    await shareImage(img, text);
  } catch (e) { console.error(e); toast('Sharing is not available right now'); }
  btn.disabled = false;
}

// ---------------- Brainlark Full ----------------
function lockedChart(note) {
  return `<div style="position:relative;margin-top:8px">
    <svg viewBox="0 0 320 150" style="width:100%;display:block;filter:blur(3px);opacity:.5"><polyline points="20,120 70,100 120,108 170,80 220,70 270,52 305,40" fill="none" stroke="#ff8a3d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div>
      <div class="muted" style="font-weight:800;margin-bottom:8px">${esc(note)}</div>
      <button class="btn pink small" data-up>🔒 Unlock charts</button></div></div></div>`;
}

function upgrade(reason, back = home) {
  const perks = [
    ['🧩', 'All 15 exercises', 'Head Count, Clock Reader, Light Trail, Number Place and more'],
    ['📈', 'Progress charts', 'Watch your Brain Age and every score improve day by day'],
    ['👨‍👩‍👧', 'Up to 4 players', 'Everyone in the family gets their own progress'],
    ['🚫', 'No ads, ever', 'And no subscription. Pay once, keep it for good'],
  ];
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>Brainlark Full</h2></div>
    <div class="panel" style="padding:20px;text-align:center">
      ${SPARK}
      <div class="title" style="font-size:26px;margin-top:6px">Unlock the full workout</div>
      <div class="subtitle">One payment. Everything, forever.</div>
    </div>
    <div class="list stagger scroll grow">
      ${perks.map(([i, t, d]) => `<div class="card" style="cursor:default"><div class="emoji" style="background:var(--panel-2)">${i}</div><div><div class="name" style="font-size:16px">${t}</div><div class="desc">${d}</div></div></div>`).join('')}
    </div>
    <button class="btn pink" data-buy style="min-height:62px;font-size:20px">Unlock for ${esc(pay.price())}</button>
    <button class="btn ghost small" data-restore>Restore purchase</button>`);
  const goBack = () => { sfx.tap(); back(); };
  s.querySelector('[data-back]').onclick = goBack;
  const buyBtn = s.querySelector('[data-buy]');
  const off = pay.onChange(() => { buyBtn.textContent = `Unlock for ${pay.price()}`; if (pay.isFull()) done(); });
  setCleanupOnce(off);
  let finished = false;
  const done = () => { if (finished) return; finished = true; off(); sfx.fanfare(); confetti(200); toast('Welcome to Brainlark Full! Everything is unlocked.'); home(); };
  buyBtn.onclick = async () => {
    sfx.tap(); buyBtn.disabled = true;
    const r = await pay.buy();
    buyBtn.disabled = false;
    if (r === 'ok' || pay.isFull()) done();
    else if (r === 'unavailable') toast('Purchases open once Brainlark is on the Play Store. In this test build, use Settings > Test unlock.', 3800);
    else if (r === 'error') toast('The purchase did not go through. You have not been charged.');
  };
  s.querySelector('[data-restore]').onclick = async () => {
    sfx.tap(); const r = await pay.restore();
    if (r === 'ok' || pay.isFull()) done(); else toast(r === 'none' ? 'No purchase found on this Google account' : 'The Play Store is not available right now');
  };
}
function setCleanupOnce(fn) { const scr = document.querySelector('.screen:not(.leave)'); const mo = new MutationObserver(() => { if (!scr.isConnected || scr.classList.contains('leave')) { fn(); mo.disconnect(); } }); mo.observe(scr, { attributes: true }); mo.observe(document.getElementById('app'), { childList: true }); }

// ---------------- handwriting teaching ----------------
function teachInk() {
  const order = [];
  for (let d = 0; d <= 9; d++) order.push(d, d);
  const samples = {};
  let k = 0;
  const s = show(`
    <div class="topbar"><button class="icon-btn" data-back>‹</button><h2>Teach my handwriting</h2></div>
    <div class="panel top lined" style="flex-basis:30%"><span class="corner l" data-c></span><div class="muted" style="font-weight:800">Write this number once, the way you normally do</div><div class="huge bump" data-d style="color:var(--orange)"></div></div>
    <div class="panel bottom"><div data-pad style="flex:1;display:flex;flex-direction:column;min-height:0"></div>
      <div class="input-tools"><button class="btn ghost small" data-clear>Erase</button><button class="btn teal small" data-next>Next</button></div></div>`);
  const pad = createInkPad(s.querySelector('[data-pad]'), { hint: 'Write the number here' });
  const dEl = s.querySelector('[data-d]'), cEl = s.querySelector('[data-c]');
  const render = () => { dEl.textContent = order[k]; dEl.classList.remove('bump'); void dEl.offsetWidth; dEl.classList.add('bump'); cEl.textContent = `${k + 1} / ${order.length}`; };
  render();
  s.querySelector('[data-back]').onclick = () => { sfx.tap(); pad.destroy(); settings(); };
  s.querySelector('[data-clear]').onclick = () => { sfx.tap(); pad.clear(); };
  s.querySelector('[data-next]').onclick = () => {
    const strokes = pad.strokes();
    if (!strokes.length) { sfx.wrong(); return; }
    const pts = []; strokes.forEach((st, id) => st.forEach(p => pts.push({ x: Math.round(p.x), y: Math.round(p.y), id })));
    (samples[order[k]] ||= []).push(pts);
    sfx.correct(); pad.clear(); k++;
    if (k >= order.length) {
      store.updateProfile(p => { p.inkSamples = samples; });
      setUserSamples(samples); pad.destroy(); sfx.fanfare(); confetti(120); toast('Got it! Brainlark now knows your handwriting.'); settings();
    } else render();
  };
}

// Android back button (Capacitor) / browser back
const CapApp = window.Capacitor?.Plugins?.App;
CapApp?.addListener('backButton', () => {
  const scr = document.querySelector('.screen:not(.leave)');
  const btn = scr?.querySelector('[data-quit], [data-back]');
  if (btn) btn.click();
  else if (scr?.querySelector('[data-switch]')) CapApp.exitApp();
  else if (store.current()) home();
});

pay.initPurchases();
splash();
