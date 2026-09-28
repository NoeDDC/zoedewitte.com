/* Dino Rêveur — un petit jeu proposé par Zoé Dewitte.
   Tout est dessiné à la main dans un <canvas>, sans image ni dépendance.
   Les données (scores, badges, réglages) restent dans le localStorage du navigateur. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- utils
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => Math.floor(n).toLocaleString('fr-FR');

  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // -------------------------------------------------------------- storage
  const NS = 'dino-reveur:';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    clear() { try { Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* rien */ } },
  };

  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let stats = Object.assign({ games: 0, best: 0, stars: 0, meters: 0, time: 0 }, store.get('stats', {}));
  let board = store.get('board', []);
  let earned = store.get('badges', {});
  let skinId = store.get('skin', 'menthe');
  let muted = store.get('muted', false);
  let lastName = store.get('name', '');
  let daily = store.get('daily', null);
  let streak = store.get('streak', { count: 0, last: null });

  // ------------------------------------------------------------- content
  const SKINS = [
    { id: 'menthe', name: 'Menthe', need: 0, body: '#5cc28a', belly: '#d2f5dd', dark: '#3f9a6a', spike: '#ff9fb8' },
    { id: 'barbe', name: 'Barbe à papa', need: 100, body: '#ff9ec0', belly: '#ffe3ee', dark: '#e0719a', spike: '#7fcaf5' },
    { id: 'lagon', name: 'Lagon', need: 300, body: '#5bb8f0', belly: '#d6efff', dark: '#3a8fc4', spike: '#ffd166' },
    { id: 'abricot', name: 'Abricot', need: 600, body: '#ffab5c', belly: '#ffe8cc', dark: '#d9802f', spike: '#6fcf9f' },
    { id: 'lilas', name: 'Lilas', need: 1000, body: '#a98bf0', belly: '#eee6ff', dark: '#7d62c9', spike: '#ffe08a' },
    { id: 'or', name: 'Or', need: 2000, body: '#f2c94c', belly: '#fff5cc', dark: '#c99a1e', spike: '#ff8fab' },
  ];
  const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
  if (skinById(skinId).need > stats.best) skinId = 'menthe';

  const BADGES = [
    { id: 'first', icon: '🥚', name: 'Éclosion', desc: 'Jouer une première partie' },
    { id: 's100', icon: '🐾', name: 'Petites pattes', desc: 'Atteindre 100 points' },
    { id: 's500', icon: '🌵', name: 'Coureur du désert', desc: 'Atteindre 500 points' },
    { id: 's1000', icon: '💨', name: 'Infatigable', desc: 'Atteindre 1 000 points' },
    { id: 's2000', icon: '👑', name: 'Légende', desc: 'Atteindre 2 000 points' },
    { id: 'star10', icon: '⭐', name: "Chasseur d'étoiles", desc: '10 étoiles en une partie' },
    { id: 'night', icon: '🌙', name: 'Oiseau de nuit', desc: 'Voir tomber la nuit' },
    { id: 'duck', icon: '🙇', name: 'Tête baissée', desc: 'Passer sous un ptérodactyle' },
    { id: 'shield', icon: '🫧', name: 'Sauvé par la bulle', desc: 'Être protégé par une bulle' },
    { id: 'games10', icon: '🎟️', name: 'Habitué', desc: 'Jouer 10 parties' },
    { id: 'daily', icon: '☀️', name: 'Défi relevé', desc: 'Réussir un défi du jour' },
    { id: 'streak3', icon: '🔥', name: 'En feu', desc: '3 défis du jour de suite' },
  ];

  // ---------------------------------------------------------- daily goal
  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function challenge() {
    const key = dayKey();
    const r = mulberry32(parseInt(key.replace(/-/g, ''), 10));
    r();
    const target = 250 + Math.floor(r() * 12) * 50;
    const stars = 5 + Math.floor(r() * 7);
    if (!daily || daily.date !== key) { daily = { date: key, bestScore: 0, bestStars: 0, done: false }; store.set('daily', daily); }
    return { key, target, stars };
  }

  // --------------------------------------------------------------- sound
  const Sound = {
    ac: null,
    ensure() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ac.destination);
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    tone(f1, f2, dur, type = 'sine', vol = 0.2, delay = 0) {
      if (muted || !this.ac) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.03);
    },
    jump() { this.tone(400, 760, 0.14, 'triangle', 0.16); },
    star() { this.tone(1046, 0, 0.12, 'sine', 0.13); this.tone(1568, 0, 0.2, 'sine', 0.11, 0.06); },
    hit() { this.tone(240, 55, 0.4, 'sawtooth', 0.1); this.tone(110, 40, 0.3, 'square', 0.05); },
    milestone() { this.tone(784, 0, 0.1, 'triangle', 0.1); this.tone(1175, 0, 0.18, 'triangle', 0.1, 0.09); },
    shield() { [523, 659, 784].forEach((f, i) => this.tone(f, 0, 0.25, 'sine', 0.1, i * 0.05)); },
    pop() { this.tone(900, 180, 0.22, 'triangle', 0.14); },
    badge() { [659, 880, 1319].forEach((f, i) => this.tone(f, 0, 0.2, 'triangle', 0.09, i * 0.08)); },
  };

  // -------------------------------------------------------------- canvas
  const stage = $('#stage');
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  let W = 900, H = 300, GY = 252, SCALE = 1, DPR = 1;

  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    let s = Math.min(r.height / 300, r.width / 560);
    if (r.width >= 800) s = Math.max(r.height / 440, Math.min(r.height / 300, r.width / 900));
    SCALE = s;
    W = r.width / s;
    H = r.height / s;
    GY = H - 48;
    canvas.width = Math.round(r.width * DPR);
    canvas.height = Math.round(r.height * DPR);
    ctx.setTransform(s * DPR, 0, 0, s * DPR, 0, 0);
    dino.x = W < 640 ? 44 : 70;
    if (dino.fy > GY || G.state !== 'run') dino.fy = GY;
    if (!clouds.length) initClouds();
  }

  // ---------------------------------------------------------- game state
  const GRAV = 2500, JUMP_V = 700, HOLD_GRAV = 0.55, HOLD_MAX = 0.22, FASTFALL = 5200;
  const BASE_SPEED = 380, ACCEL = 7.5;
  const maxSpeed = () => (W < 640 ? 700 : 960);

  const G = {
    state: 'idle', t: 0, scroll: 0, speed: 0, dist: 0, bonus: 0, stars: 0, elapsed: 0,
    obstacles: [], items: [], parts: [], untilNext: 0, shake: 0, shield: false, invuln: 0,
    flash: 0, lastMilestone: 0, overAt: 0, newRecord: false, entry: null, killer: null,
    jumpBuffer: 0, dustT: 0, cycle: 0,
  };
  const dino = { x: 70, fy: 252, vy: 0, holding: false, holdT: 0, down: false, ducking: false, dead: false, blink: 0, nextBlink: 2.5 };
  const clouds = [];
  const skyStars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.5, 1.6), tw: rand(1, 3), ph: rand(0, 6) }));

  const score = () => Math.floor(G.dist * 0.025) + G.bonus;

  function initClouds() {
    clouds.length = 0;
    for (let i = 0; i < 6; i++) clouds.push({ x: rand(0, W), y: rand(0.08, 0.42), s: rand(0.6, 1.25), v: rand(4, 14) });
  }

  // -------------------------------------------------------------- palette
  const KF = [
    { t: 0.0, top: '#a9dcff', bot: '#fff1dc', far: '#c3d3f2', mid: '#9fd8b1', ground: '#f3dcae', grass: '#86cf98', night: 0 },
    { t: 0.42, top: '#a9dcff', bot: '#fff1dc', far: '#c3d3f2', mid: '#9fd8b1', ground: '#f3dcae', grass: '#86cf98', night: 0 },
    { t: 0.52, top: '#8d88dc', bot: '#ffb99b', far: '#cba1cf', mid: '#86b89c', ground: '#ebc69c', grass: '#78b98b', night: 0.3 },
    { t: 0.62, top: '#1d2150', bot: '#4b3f80', far: '#3d4180', mid: '#2f5363', ground: '#6e5a7e', grass: '#3f7467', night: 1 },
    { t: 0.86, top: '#1d2150', bot: '#4b3f80', far: '#3d4180', mid: '#2f5363', ground: '#6e5a7e', grass: '#3f7467', night: 1 },
    { t: 0.95, top: '#9cc3f2', bot: '#ffd3c4', far: '#bcc6ea', mid: '#98cdaa', ground: '#efd5a8', grass: '#80c793', night: 0.2 },
    { t: 1.0, top: '#a9dcff', bot: '#fff1dc', far: '#c3d3f2', mid: '#9fd8b1', ground: '#f3dcae', grass: '#86cf98', night: 0 },
  ].map((k) => ({ ...k, top: hex(k.top), bot: hex(k.bot), far: hex(k.far), mid: hex(k.mid), ground: hex(k.ground), grass: hex(k.grass) }));

  function palette(c) {
    let i = 0;
    while (i < KF.length - 2 && c > KF[i + 1].t) i++;
    const a = KF[i], b = KF[i + 1];
    const t = clamp((c - a.t) / (b.t - a.t || 1), 0, 1);
    const e = t * t * (3 - 2 * t);
    return {
      top: mix(a.top, b.top, e), bot: mix(a.bot, b.bot, e), far: mix(a.far, b.far, e), mid: mix(a.mid, b.mid, e),
      ground: mix(a.ground, b.ground, e), grass: mix(a.grass, b.grass, e), night: lerp(a.night, b.night, e),
    };
  }

  const INK = '#2a2440';
  const SHADE = [42, 30, 80];

  // ------------------------------------------------------------ controls
  function press() {
    Sound.ensure();
    if (G.state === 'idle') return start();
    if (G.state === 'over') { if (performance.now() - G.overAt > 550) start(); return; }
    if (G.state === 'pause') return togglePause();
    dino.holding = true;
    G.jumpBuffer = 0.12;
  }
  function release() { dino.holding = false; }

  function tryJump() {
    if (dino.fy < GY) return false;
    dino.vy = -JUMP_V;
    dino.holdT = 0;
    dino.fy = GY - 0.01;
    G.jumpBuffer = 0;
    Sound.jump();
    puff(dino.x + 18, GY, 6);
    return true;
  }

  const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target)) {
      if (e.key === 'Enter') e.target.blur();
      return;
    }
    const k = e.code;
    if (e.target && e.target.tagName === 'BUTTON' && (k === 'Space' || k === 'Enter')) return;
    if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) press();
    } else if (k === 'ArrowDown' || k === 'KeyS') {
      if (G.state === 'run') { e.preventDefault(); dino.down = true; }
    } else if (k === 'KeyP' || k === 'Escape') {
      if (G.state === 'run' || G.state === 'pause') { e.preventDefault(); togglePause(); }
    } else if (k === 'Enter' && G.state === 'over') {
      press();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.code;
    if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') release();
    if (k === 'ArrowDown' || k === 'KeyS') dino.down = false;
  });

  let pointerStartY = null;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointerStartY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    press();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerStartY === null || G.state !== 'run') return;
    if (e.clientY - pointerStartY > 22) { dino.down = true; dino.holding = false; }
  });
  const endPointer = () => { pointerStartY = null; dino.down = false; release(); };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  $('#pauseScreen').addEventListener('pointerdown', (e) => { e.preventDefault(); togglePause(); });

  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'run') togglePause(); });
  window.addEventListener('blur', () => { dino.down = false; release(); });

  // ------------------------------------------------------------ lifecycle
  function start() {
    Sound.ensure();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    challenge();
    Object.assign(G, {
      state: 'run', speed: BASE_SPEED, dist: 0, bonus: 0, stars: 0, elapsed: 0, obstacles: [], items: [],
      untilNext: 420, shake: 0, shield: false, invuln: 0, flash: 0, lastMilestone: 0, newRecord: false,
      entry: null, killer: null, jumpBuffer: 0,
    });
    Object.assign(dino, { fy: GY, vy: 0, holding: false, down: false, ducking: false, dead: false });
    $('#startScreen').hidden = true;
    $('#overScreen').hidden = true;
    $('#pauseScreen').hidden = true;
    renderBoard();
  }

  function togglePause() {
    if (G.state === 'run') { G.state = 'pause'; $('#pauseScreen').hidden = false; }
    else if (G.state === 'pause') { G.state = 'run'; $('#pauseScreen').hidden = true; dino.holding = false; dino.down = false; }
  }

  function gameOver(killer) {
    G.state = 'over';
    G.killer = killer;
    dino.dead = true;
    dino.holding = false;
    dino.down = false;
    G.overAt = performance.now();
    G.shake = reduceMotion ? 0 : 12;
    Sound.hit();
    for (let i = 0; i < 18; i++) {
      G.parts.push({ x: dino.x + 24, y: dino.fy - 26, vx: rand(-220, 220), vy: rand(-380, -60), life: 0, max: rand(0.5, 0.9), size: rand(2, 5), c: skinById(skinId).body, g: 900 });
    }

    const sc = score();
    const prevBest = stats.best;
    stats.games++;
    stats.stars += G.stars;
    stats.meters += Math.floor(G.dist / 40);
    stats.time += G.elapsed;
    G.newRecord = sc > prevBest && sc > 0;
    if (G.newRecord) stats.best = sc;
    store.set('stats', stats);

    unlock('first');
    if (stats.games >= 10) unlock('games10');

    const newSkin = SKINS.find((s) => s.need > prevBest && s.need <= stats.best);
    if (newSkin) setTimeout(() => toast('🦖', `Nouveau dino débloqué : <b>${newSkin.name}</b>`), 900);

    // défi du jour
    const ch = challenge();
    daily.bestScore = Math.max(daily.bestScore, sc);
    daily.bestStars = Math.max(daily.bestStars, G.stars);
    if (!daily.done && daily.bestScore >= ch.target && daily.bestStars >= ch.stars) {
      daily.done = true;
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (streak.last === dayKey(y)) streak.count++;
      else if (streak.last !== ch.key) streak.count = 1;
      streak.last = ch.key;
      store.set('streak', streak);
      unlock('daily');
      if (streak.count >= 3) unlock('streak3');
      setTimeout(() => toast('☀️', '<b>Défi du jour réussi !</b>'), 300);
    }
    store.set('daily', daily);

    // tableau d'honneur
    G.entry = null;
    if (sc > 0) {
      const entry = { id: Date.now(), name: lastName, score: sc, date: dayKey() };
      board.push(entry);
      board.sort((a, b) => b.score - a.score || a.id - b.id);
      board = board.slice(0, 5);
      if (board.includes(entry)) G.entry = entry;
      store.set('board', board);
    }

    setTimeout(showOver, 560);
    renderAll();
  }

  function showOver() {
    if (G.state !== 'over') return;
    const sc = score();
    const kick = $('#overKicker');
    const lines = {
      cactus: ['Aïe, un cactus !', 'Ça pique…', 'Le cactus a gagné cette fois.'],
      bird: ['Percuté par un ptérodactyle !', 'Collision aérienne !'],
      rock: ['Trébuché sur un caillou !', 'Oups, le caillou…'],
    };
    const pool = lines[G.killer] || lines.cactus;
    kick.textContent = G.newRecord ? 'Nouveau record !' : pool[Math.floor(Math.random() * pool.length)];
    kick.classList.toggle('record', G.newRecord);
    $('#overScore').textContent = fmt(sc);
    $('#overBest').textContent = fmt(stats.best);
    $('#overStars').textContent = G.stars;
    const row = $('#nameRow');
    if (G.entry) {
      const rank = board.indexOf(G.entry) + 1;
      $('#overRank').textContent = rank === 1 ? '1re place' : `${rank}e place`;
      $('#nameInput').value = G.entry.name || '';
      row.hidden = false;
    } else {
      row.hidden = true;
    }
    $('#overScreen').hidden = false;
    if (G.newRecord) confetti();
  }

  $('#nameInput').addEventListener('input', (e) => {
    const name = e.target.value.trim().slice(0, 14);
    lastName = name;
    store.set('name', name);
    if (G.entry) { G.entry.name = name; store.set('board', board); renderBoard(); }
  });
  $('#againBtn').addEventListener('click', start);
  $('#shareBtn').addEventListener('click', share);

  // ---------------------------------------------------------------- spawn
  function spawn() {
    const sc = score();
    const x = W + 40;
    let o;
    const birdChance = sc > 180 ? Math.min(0.3, 0.12 + sc / 5000) : 0;
    if (Math.random() < birdChance) {
      const lv = sc < 450 ? (Math.random() < 0.5 ? 'low' : 'mid') : ['low', 'mid', 'high'][Math.floor(Math.random() * 3)];
      const bottom = { low: GY - 10, mid: GY - 40, high: GY - 68 }[lv];
      o = { type: 'bird', x, y: bottom, w: 44, h: 24, level: lv, flap: rand(0, 6) };
    } else {
      const r = Math.random();
      if (r < 0.34) o = { type: 'cactus', x, y: GY, w: 22, h: Math.round(rand(38, 46)) };
      else if (r < 0.58) o = { type: 'big', x, y: GY, w: 30, h: Math.round(rand(54, 62)) };
      else if (r < 0.82 && sc > 60) {
        const n = sc > 350 && Math.random() < 0.5 ? 3 : 2;
        const hs = Array.from({ length: n }, () => Math.round(rand(32, 44)));
        o = { type: 'cluster', x, y: GY, n, hs, w: 16 * (n - 1) + 20, h: Math.max(...hs) };
      } else o = { type: 'rock', x, y: GY, w: 38, h: 22 };
    }
    o.seed = Math.random();
    o.flower = Math.random() < 0.4;
    G.obstacles.push(o);

    const gap = G.speed * rand(0.78, 1.45) + 150 + (o.type === 'cluster' ? 30 : 0) + (o.type === 'bird' ? 60 : 0);

    if (o.type !== 'bird' && Math.random() < 0.3) {
      const cx = o.x + o.w / 2;
      for (let i = -2; i <= 2; i++) G.items.push({ type: 'star', x: cx + i * 30, y: GY - o.h - 30 - 26 * (1 - (i * i) / 5), r: 10, bob: i * 0.6 });
    } else if (Math.random() < 0.24) {
      const mx = o.x + o.w + gap * 0.5 - 30;
      const high = Math.random() < 0.5;
      for (let i = 0; i < 3; i++) G.items.push({ type: 'star', x: mx + i * 30, y: high ? GY - 92 : GY - 26, r: 10, bob: i * 0.6 });
    }
    if (!G.shield && sc > 250 && !G.items.some((i) => i.type === 'shield') && Math.random() < 0.05) {
      G.items.push({ type: 'shield', x: o.x + o.w + gap * 0.5, y: GY - 72, r: 15, bob: 0 });
    }
    return gap;
  }

  // ------------------------------------------------------------ collision
  function dinoBoxes() {
    const x = dino.x, f = dino.fy;
    if (dino.ducking) return [{ x: x + 2, y: f - 22, w: 58, h: 20 }];
    return [{ x: x + 2, y: f - 36, w: 30, h: 34 }, { x: x + 20, y: f - 52, w: 26, h: 18 }];
  }
  function obstacleBox(o) {
    if (o.type === 'bird') return { x: o.x + 6, y: o.y - 19, w: 32, h: 14 };
    if (o.type === 'rock') return { x: o.x + 4, y: o.y - o.h + 5, w: o.w - 8, h: o.h - 5 };
    return { x: o.x + 3, y: o.y - o.h + 3, w: o.w - 6, h: o.h - 3 };
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ------------------------------------------------------------- effects
  function puff(x, y, n) {
    for (let i = 0; i < n; i++) G.parts.push({ x: x + rand(-6, 6), y: y - rand(0, 3), vx: rand(-90, 30), vy: rand(-70, -10), life: 0, max: rand(0.3, 0.55), size: rand(2.5, 5), c: 'dust', g: 0 });
  }
  function sparkle(x, y, c = '#ffd24a', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const sp = rand(80, 200);
      G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(0.35, 0.6), size: rand(1.8, 3.4), c, g: 200, star: Math.random() < 0.5 });
    }
  }

  // --------------------------------------------------------------- update
  function update(dt) {
    G.t += dt;

    dino.nextBlink -= dt;
    if (dino.nextBlink <= 0) { dino.blink = 0.13; dino.nextBlink = rand(2, 5); }
    if (dino.blink > 0) dino.blink -= dt;

    const cloudSpeed = G.state === 'run' ? G.speed * 0.06 : 8;
    for (const c of clouds) {
      c.x -= (cloudSpeed + c.v) * dt;
      if (c.x < -140 * c.s) { c.x = W + rand(20, 200); c.y = rand(0.08, 0.42); c.s = rand(0.6, 1.25); }
    }

    if (G.state === 'idle') { G.scroll += 26 * dt; G.cycle = 0; }

    if (G.state === 'run') {
      G.elapsed += dt;
      G.speed = Math.min(maxSpeed(), BASE_SPEED + G.elapsed * ACCEL);
      const dx = G.speed * dt;
      G.dist += dx;
      G.scroll += dx;
      G.cycle = ((G.dist * 0.025) % 900) / 900;
      if (G.cycle > 0.64 && G.cycle < 0.86) unlock('night');

      // dino
      if (G.jumpBuffer > 0) { G.jumpBuffer -= dt; if (dino.fy >= GY) tryJump(); }
      if (dino.fy < GY || dino.vy < 0) {
        let g = GRAV;
        if (dino.holding && dino.vy < 0 && dino.holdT < HOLD_MAX) { g *= HOLD_GRAV; dino.holdT += dt; }
        if (dino.down) g += FASTFALL;
        dino.vy += g * dt;
        dino.fy += dino.vy * dt;
        if (dino.fy >= GY) { dino.fy = GY; dino.vy = 0; puff(dino.x + 20, GY, 5); }
      }
      dino.ducking = dino.down && dino.fy >= GY;
      G.dustT -= dt;
      if (dino.fy >= GY && G.dustT <= 0) { G.dustT = 0.09; G.parts.push({ x: dino.x + 6, y: GY - 2, vx: rand(-60, -20), vy: rand(-40, -10), life: 0, max: 0.35, size: rand(1.5, 3), c: 'dust', g: 0 }); }

      // spawn
      G.untilNext -= dx;
      if (G.untilNext <= 0) G.untilNext = spawn();

      // obstacles
      const boxes = dinoBoxes();
      for (const o of G.obstacles) {
        o.x -= (o.type === 'bird' ? G.speed + 40 : G.speed) * dt;
        if (o.dead) continue;
        if (!o.passed && o.x + o.w < dino.x) {
          o.passed = true;
          if (o.type === 'bird' && o.level === 'mid' && dino.ducking) unlock('duck');
        }
        if (G.invuln > 0) continue;
        const ob = obstacleBox(o);
        if (boxes.some((b) => overlap(b, ob))) {
          if (G.shield) {
            G.shield = false;
            G.invuln = 0.9;
            o.dead = true;
            sparkle(o.x + o.w / 2, o.y - o.h / 2, '#9fd8ff', 16);
            Sound.pop();
            unlock('shield');
          } else {
            gameOver(o.type === 'cluster' || o.type === 'big' ? 'cactus' : o.type);
            break;
          }
        }
      }
      G.obstacles = G.obstacles.filter((o) => o.x + o.w > -60 && !o.dead);
      if (G.invuln > 0) G.invuln -= dt;

      // items
      for (const it of G.items) {
        it.x -= G.speed * dt;
        if (it.taken) continue;
        const bob = Math.sin(G.t * 4 + it.bob) * 3;
        const ib = { x: it.x - it.r, y: it.y + bob - it.r, w: it.r * 2, h: it.r * 2 };
        if (boxes.some((b) => overlap({ x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 }, ib))) {
          it.taken = true;
          if (it.type === 'star') {
            G.stars++;
            G.bonus += 10;
            sparkle(it.x, it.y + bob);
            Sound.star();
            if (G.stars >= 10) unlock('star10');
          } else {
            G.shield = true;
            sparkle(it.x, it.y + bob, '#9fd8ff', 14);
            Sound.shield();
            toast('🫧', 'Bulle protectrice !');
          }
        }
      }
      G.items = G.items.filter((i) => i.x > -40 && !i.taken);

      // paliers
      const sc = score();
      const m = Math.floor(sc / 100);
      if (m > G.lastMilestone) { G.lastMilestone = m; G.flash = 0.9; Sound.milestone(); }
      if (G.flash > 0) G.flash -= dt;
      if (sc >= 100) unlock('s100');
      if (sc >= 500) unlock('s500');
      if (sc >= 1000) unlock('s1000');
      if (sc >= 2000) unlock('s2000');
    }

    if (G.state === 'over' && dino.fy < GY) {
      dino.vy += GRAV * dt;
      dino.fy = Math.min(GY, dino.fy + dino.vy * dt);
    }

    for (const p of G.parts) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt - (G.state === 'run' && p.c === 'dust' ? G.speed * dt * 0.5 : 0);
      p.y += p.vy * dt;
    }
    G.parts = G.parts.filter((p) => p.life < p.max);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
  }

  // --------------------------------------------------------------- render
  function farProfile(wx) {
    const k = (2 * Math.PI) / 1600;
    return 62 + 26 * Math.sin(wx * k * 2 + 1.3) + 16 * Math.sin(wx * k * 5 + 0.4) + 8 * Math.sin(wx * k * 11 + 2.1) + 4 * Math.sin(wx * k * 19 + 0.7);
  }
  function midProfile(wx) {
    const k = (2 * Math.PI) / 1200;
    return 30 + 14 * Math.sin(wx * k * 3 + 0.2) + 9 * Math.sin(wx * k * 7 + 1.9) + 4 * Math.sin(wx * k * 13 + 0.5);
  }

  function render() {
    const P = palette(G.cycle);
    ctx.save();
    if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);

    // ciel
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, rgb(P.top));
    sky.addColorStop(1, rgb(P.bot));
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // étoiles du ciel
    if (P.night > 0.02) {
      for (const s of skyStars) {
        const a = P.night * (0.55 + 0.45 * Math.sin(G.t * s.tw + s.ph));
        ctx.fillStyle = `rgba(255,250,235,${a})`;
        ctx.beginPath();
        ctx.arc(s.x * W, 12 + s.y * (GY * 0.5), s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawSunMoon(P);
    drawClouds(P);

    // montagnes lointaines
    const farBase = GY - 8;
    const fg = ctx.createLinearGradient(0, farBase - 110, 0, farBase);
    fg.addColorStop(0, rgb(P.far));
    fg.addColorStop(1, rgb(mix(P.far, P.bot, 0.45)));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-10, H);
    for (let sx = -10; sx <= W + 10; sx += 8) ctx.lineTo(sx, farBase - farProfile(sx + G.scroll * 0.1));
    ctx.lineTo(W + 10, H);
    ctx.fill();

    // collines + arbres
    const midScroll = G.scroll * 0.3;
    ctx.fillStyle = rgb(P.mid);
    ctx.beginPath();
    ctx.moveTo(-10, H);
    for (let sx = -10; sx <= W + 10; sx += 6) ctx.lineTo(sx, GY - midProfile(sx + midScroll));
    ctx.lineTo(W + 10, H);
    ctx.fill();
    const treeC = rgb(mix(P.mid, SHADE, 0.22));
    const treeL = rgb(mix(P.mid, [255, 255, 255], 0.12));
    const step = 70;
    for (let i = Math.floor((midScroll - 40) / step); i <= Math.floor((midScroll + W + 40) / step); i++) {
      const r = hash(i);
      if (r > 0.42) continue;
      const wx = i * step + hash(i + 17) * 40;
      const sx = wx - midScroll;
      const y = GY - midProfile(wx) + 2;
      const s = 0.7 + hash(i + 3) * 0.6;
      if (r < 0.2) {
        ctx.fillStyle = treeC;
        ctx.beginPath(); ctx.moveTo(sx, y - 30 * s); ctx.lineTo(sx + 9 * s, y); ctx.lineTo(sx - 9 * s, y); ctx.fill();
      } else {
        ctx.fillStyle = treeC;
        ctx.fillRect(sx - 1.2, y - 10 * s, 2.4, 10 * s);
        ctx.beginPath(); ctx.arc(sx, y - 14 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = treeL;
        ctx.beginPath(); ctx.arc(sx - 2.5 * s, y - 16 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawGround(P);
    for (const it of G.items) drawItem(it);
    for (const o of G.obstacles) drawObstacle(o, P);

    // dino
    const skin = skinById(skinId);
    const pose = dino.dead ? 'dead' : dino.ducking ? 'duck' : dino.fy < GY ? 'jump' : G.state === 'run' ? 'run' : 'stand';
    const flicker = G.invuln > 0 && Math.floor(G.t * 16) % 2 === 0;
    ctx.globalAlpha = flicker ? 0.45 : 1;
    // ombre
    const lift = clamp((GY - dino.fy) / 150, 0, 1);
    ctx.fillStyle = `rgba(40,30,70,${0.16 * (1 - lift * 0.7)})`;
    ctx.beginPath(); ctx.ellipse(dino.x + 22, GY + 1, 22 * (1 - lift * 0.4), 4, 0, 0, Math.PI * 2); ctx.fill();
    drawDino(ctx, dino.x, dino.fy, skin, pose, G.t, dino.blink > 0);
    ctx.globalAlpha = 1;
    if (G.shield) {
      const cx = dino.x + (dino.ducking ? 30 : 24), cy = dino.fy - (dino.ducking ? 16 : 28);
      const rr = 38 + Math.sin(G.t * 5) * 1.5;
      const bg = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, rr);
      bg.addColorStop(0, 'rgba(255,255,255,0.35)');
      bg.addColorStop(0.7, 'rgba(159,216,255,0.12)');
      bg.addColorStop(1, 'rgba(159,216,255,0.35)');
      ctx.fillStyle = bg;
      ctx.strokeStyle = 'rgba(190,230,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // particules
    for (const p of G.parts) {
      const a = 1 - p.life / p.max;
      if (p.c === 'dust') {
        ctx.fillStyle = rgb(mix(P.ground, [255, 255, 255], 0.35), a * 0.8);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + p.life / p.max), 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = p.c;
        ctx.globalAlpha = a;
        if (p.star) { starPath(p.x, p.y, p.size * 1.8, p.size * 0.8); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }

    // voile de nuit sur le premier plan
    if (P.night > 0) {
      const veil = ctx.createLinearGradient(0, GY - 170, 0, GY - 40);
      veil.addColorStop(0, 'rgba(22,18,64,0)');
      veil.addColorStop(1, `rgba(22,18,64,${P.night * 0.16})`);
      ctx.fillStyle = veil;
      ctx.fillRect(-20, GY - 170, W + 40, H);
    }

    ctx.restore();
    drawHud(P);
  }

  function drawSunMoon(P) {
    const c = G.cycle;
    const sunH = c <= 0.4 ? 1 : c < 0.6 ? 1 - (c - 0.4) / 0.2 : c > 0.9 ? (c - 0.9) / 0.1 : 0;
    const moonH = c < 0.58 ? 0 : c < 0.68 ? (c - 0.58) / 0.1 : c < 0.86 ? 1 : c < 0.96 ? 1 - (c - 0.86) / 0.1 : 0;
    const topY = Math.max(36, GY * 0.2), lowY = GY - 20;
    if (sunH > 0) {
      const x = W * 0.8, y = lerp(lowY, topY, sunH);
      const col = mix([255, 150, 90], [255, 214, 110], sunH);
      const glow = ctx.createRadialGradient(x, y, 8, x, y, 90);
      glow.addColorStop(0, rgb(col, 0.45));
      glow.addColorStop(1, rgb(col, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 90, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(mix(col, [255, 255, 255], 0.25));
      ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
    }
    if (moonH > 0) {
      const x = W * 0.3, y = lerp(lowY, topY, moonH);
      const glow = ctx.createRadialGradient(x, y, 6, x, y, 70);
      glow.addColorStop(0, 'rgba(255,245,210,0.3)');
      glow.addColorStop(1, 'rgba(255,245,210,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 70, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(220,206,176,0.35)';
      ctx.beginPath(); ctx.arc(x - 6, y - 4, 4, 0, Math.PI * 2); ctx.arc(x + 5, y + 6, 3, 0, Math.PI * 2); ctx.arc(x + 6, y - 7, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawClouds(P) {
    const col = mix([255, 255, 255], [130, 126, 200], P.night * 0.75);
    for (const c of clouds) {
      const x = c.x, y = c.y * GY, s = c.s;
      ctx.fillStyle = rgb(col, 0.85 - P.night * 0.35);
      ctx.beginPath();
      ctx.arc(x, y, 14 * s, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(x + 18 * s, y - 8 * s, 18 * s, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(x + 40 * s, y - 2 * s, 15 * s, Math.PI * 1.3, Math.PI * 2);
      ctx.arc(x + 54 * s, y + 4 * s, 10 * s, Math.PI * 1.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGround(P) {
    ctx.fillStyle = rgb(P.ground);
    ctx.fillRect(-20, GY, W + 40, H - GY + 20);
    const s = G.scroll;

    // cailloux et fleurs
    const pebble = rgb(mix(P.ground, SHADE, 0.14));
    const light = rgb(mix(P.ground, [255, 255, 255], 0.3));
    for (let i = Math.floor(s / 26) - 1; i <= Math.floor((s + W) / 26) + 1; i++) {
      const r = hash(i * 1.37);
      const x = i * 26 + hash(i + 5) * 18 - s;
      const y = GY + 16 + hash(i + 11) * (H - GY - 22);
      if (r < 0.45) {
        ctx.fillStyle = pebble;
        ctx.beginPath(); ctx.ellipse(x, y, 2 + r * 4, 1.3 + r * 2, 0, 0, Math.PI * 2); ctx.fill();
      } else if (r < 0.62) {
        ctx.fillStyle = light;
        ctx.fillRect(x, y, 6 + r * 8, 1.6);
      }
    }

    // bande d'herbe festonnée
    ctx.fillStyle = rgb(P.grass);
    ctx.fillRect(-20, GY - 2, W + 40, 7);
    for (let i = Math.floor(s / 14) - 1; i <= Math.floor((s + W) / 14) + 1; i++) {
      ctx.beginPath(); ctx.arc(i * 14 - s + 7, GY + 5, 5.5 + hash(i) * 1.5, 0, Math.PI); ctx.fill();
    }
    // brins
    ctx.strokeStyle = rgb(mix(P.grass, SHADE, 0.12));
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i = Math.floor(s / 18) - 1; i <= Math.floor((s + W) / 18) + 1; i++) {
      const r = hash(i + 91);
      if (r > 0.55) continue;
      const x = i * 18 + r * 10 - s;
      ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x - 2, GY - 4 - r * 5); ctx.moveTo(x + 2, GY); ctx.lineTo(x + 4, GY - 3 - r * 4); ctx.stroke();
      if (r < 0.08) {
        ctx.fillStyle = hash(i) < 0.5 ? '#ffb3c7' : '#fff6d8';
        ctx.beginPath(); ctx.arc(x - 2, GY - 6 - r * 5, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(x - 2, GY - 6 - r * 5, 0.9, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function starPath(x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r : R;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function drawItem(it) {
    const bob = Math.sin(G.t * 4 + it.bob) * 3;
    const y = it.y + bob;
    if (it.type === 'star') {
      const glow = ctx.createRadialGradient(it.x, y, 2, it.x, y, 22);
      glow.addColorStop(0, 'rgba(255,220,100,0.5)');
      glow.addColorStop(1, 'rgba(255,220,100,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(it.x, y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(it.x, y);
      ctx.rotate(Math.sin(G.t * 2 + it.bob) * 0.18);
      ctx.translate(-it.x, -y);
      starPath(it.x, y, it.r, it.r * 0.48);
      ctx.fillStyle = '#ffd24a';
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#f0a81c';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(it.x - 2.5, y - 2.5, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      const r = it.r + Math.sin(G.t * 5) * 1;
      const g = ctx.createRadialGradient(it.x - 5, y - 6, 2, it.x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.45, 'rgba(190,230,255,0.45)');
      g.addColorStop(1, 'rgba(150,200,255,0.7)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(it.x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,210,0.7)';
      ctx.beginPath(); ctx.arc(it.x, y, r - 3, 0.3, 1.4); ctx.stroke();
    }
  }

  function drawCactus(cx, base, h, tw, aw, span, seed, flower, P) {
    const green = rgb(mix([63, 157, 119], SHADE, P.night * 0.35));
    const lightG = rgb(mix([120, 206, 160], SHADE, P.night * 0.35));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const top = base - h + tw / 2;
    const la = base - h * (0.4 + seed * 0.12), lh = h * 0.26;
    const ra = base - h * (0.58 - seed * 0.12), rh = h * 0.22;
    ctx.strokeStyle = green;
    ctx.lineWidth = aw;
    ctx.beginPath(); ctx.moveTo(cx, la); ctx.lineTo(cx - span, la); ctx.lineTo(cx - span, la - lh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, ra); ctx.lineTo(cx + span, ra); ctx.lineTo(cx + span, ra - rh); ctx.stroke();
    ctx.lineWidth = tw;
    ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, top); ctx.stroke();
    ctx.strokeStyle = lightG;
    ctx.lineWidth = Math.max(1.6, tw * 0.2);
    ctx.beginPath(); ctx.moveTo(cx - tw * 0.2, base - 5); ctx.lineTo(cx - tw * 0.2, top); ctx.stroke();
    ctx.lineWidth = Math.max(1.2, aw * 0.2);
    ctx.beginPath(); ctx.moveTo(cx - span - aw * 0.18, la - 2); ctx.lineTo(cx - span - aw * 0.18, la - lh); ctx.stroke();
    if (flower) {
      const fy = top - tw / 2;
      ctx.fillStyle = '#ff8fb0';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffe07a';
      ctx.beginPath(); ctx.arc(cx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawObstacle(o, P) {
    if (o.type === 'cactus') drawCactus(o.x + o.w / 2, o.y, o.h, 10, 7, 8, o.seed, o.flower, P);
    else if (o.type === 'big') drawCactus(o.x + o.w / 2, o.y, o.h, 14, 9, 10.5, o.seed, o.flower, P);
    else if (o.type === 'cluster') {
      for (let i = 0; i < o.n; i++) drawCactus(o.x + 10 + i * 16, o.y, o.hs[i], 9, 5, 6, hash(o.seed * 10 + i), o.flower && i === 1, P);
    } else if (o.type === 'rock') {
      const x = o.x, b = o.y, w = o.w, h = o.h;
      ctx.fillStyle = rgb(mix([176, 160, 196], SHADE, P.night * 0.3));
      ctx.beginPath();
      ctx.moveTo(x, b);
      ctx.bezierCurveTo(x - 1, b - h * 0.8, x + w * 0.25, b - h * 1.05, x + w * 0.52, b - h);
      ctx.bezierCurveTo(x + w * 0.85, b - h * 0.96, x + w + 1, b - h * 0.5, x + w, b);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgb(mix([208, 196, 224], SHADE, P.night * 0.3));
      ctx.beginPath(); ctx.ellipse(x + w * 0.38, b - h * 0.68, w * 0.18, h * 0.18, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(mix([150, 200, 150], SHADE, P.night * 0.3));
      ctx.beginPath(); ctx.ellipse(x + w * 0.7, b - h * 0.9, 5, 2.5, 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === 'bird') drawBird(o, P);
  }

  function drawBird(o, P) {
    const x = o.x, cy = o.y - 12;
    const f = Math.sin(G.t * 13 + o.flap);
    const body = rgb(mix([179, 140, 234], SHADE, P.night * 0.25));
    const wing = rgb(mix([150, 110, 214], SHADE, P.night * 0.25));
    // aile arrière
    ctx.fillStyle = wing;
    ctx.beginPath(); ctx.moveTo(x + 18, cy - 1); ctx.quadraticCurveTo(x + 26, cy - 4 - 14 * f, x + 34, cy - 20 * f); ctx.lineTo(x + 30, cy); ctx.closePath(); ctx.fill();
    // queue
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(x + 32, cy); ctx.lineTo(x + 44, cy - 5); ctx.lineTo(x + 42, cy + 3); ctx.closePath(); ctx.fill();
    // corps
    ctx.beginPath(); ctx.ellipse(x + 22, cy + 1, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    // tête + crête
    ctx.beginPath(); ctx.arc(x + 10, cy - 3, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 12, cy - 8); ctx.lineTo(x + 22, cy - 13); ctx.lineTo(x + 15, cy - 4); ctx.closePath(); ctx.fill();
    // bec
    ctx.fillStyle = '#ffc15e';
    ctx.beginPath(); ctx.moveTo(x + 5, cy - 4); ctx.lineTo(x - 7, cy - 1); ctx.lineTo(x + 5, cy + 1); ctx.closePath(); ctx.fill();
    // œil
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + 9, cy - 4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(x + 8.4, cy - 4, 1.4, 0, Math.PI * 2); ctx.fill();
    // ventre
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(x + 20, cy + 4, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    // aile avant
    ctx.fillStyle = wing;
    ctx.beginPath(); ctx.moveTo(x + 16, cy); ctx.quadraticCurveTo(x + 20, cy - 6 - 16 * f, x + 30, cy - 22 * f); ctx.lineTo(x + 27, cy + 2); ctx.closePath(); ctx.fill();
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawDino(c, x, fy, s, pose, t, blink) {
    const duck = pose === 'duck';
    const running = pose === 'run' || duck;
    const ph = Math.sin(t * 20);
    const bodyBob = running ? Math.abs(ph) * -1.2 : pose === 'stand' ? Math.sin(t * 2.4) * 0.6 : 0;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // jambes
    const legH = duck ? 8 : 12;
    let l1 = 0, l2 = 0;
    if (running) { l1 = Math.max(0, ph) * 5; l2 = Math.max(0, -ph) * 5; }
    if (pose === 'jump') { l1 = 4; l2 = 1; }
    c.fillStyle = s.dark;
    rr(c, x + 9, fy - legH - l1, 8, legH, 3.5); c.fill();
    c.fillStyle = s.body;
    rr(c, x + (duck ? 24 : 21), fy - legH - l2, 8, legH, 3.5); c.fill();

    c.save();
    c.translate(0, bodyBob);
    const wag = Math.sin(t * (running ? 14 : 3)) * 2;

    if (!duck) {
      // queue
      c.fillStyle = s.body;
      c.beginPath();
      c.moveTo(x + 8, fy - 34);
      c.quadraticCurveTo(x - 8, fy - 32 + wag, x - 17, fy - 20 + wag);
      c.quadraticCurveTo(x - 4, fy - 18, x + 10, fy - 14);
      c.closePath(); c.fill();
      // piques
      c.fillStyle = s.spike;
      [[x + 0, fy - 33], [x + 8, fy - 38], [x + 16, fy - 39.5]].forEach(([px, py], i) => {
        const sz = 5 + i;
        c.beginPath(); c.moveTo(px - sz * 0.7, py + 3); c.lineTo(px, py - sz * 0.9); c.lineTo(px + sz * 0.7, py + 3); c.closePath(); c.fill();
      });
      c.beginPath(); c.moveTo(x + 24, fy - 53); c.lineTo(x + 27, fy - 60); c.lineTo(x + 32, fy - 53.5); c.closePath(); c.fill();
      // corps
      c.fillStyle = s.body;
      c.beginPath(); c.ellipse(x + 17, fy - 24, 17, 14, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = s.belly;
      c.beginPath(); c.ellipse(x + 22, fy - 19, 9.5, 9, -0.2, 0, Math.PI * 2); c.fill();
      // tête
      c.fillStyle = s.body;
      rr(c, x + 18, fy - 55, 31, 23, 10.5); c.fill();
      c.beginPath(); c.ellipse(x + 26, fy - 36, 8, 7, 0, 0, Math.PI * 2); c.fill();
      // bras
      c.strokeStyle = s.dark;
      c.lineWidth = 4;
      const arm = running ? ph * 1.5 : 0;
      c.beginPath(); c.moveTo(x + 28, fy - 27); c.lineTo(x + 34, fy - 22 + arm); c.stroke();
      drawFace(c, x + 38, fy - 45, s, pose, blink);
    } else {
      // queue
      c.fillStyle = s.body;
      c.beginPath();
      c.moveTo(x + 6, fy - 20);
      c.quadraticCurveTo(x - 8, fy - 18 + wag, x - 16, fy - 12 + wag);
      c.quadraticCurveTo(x - 2, fy - 7, x + 8, fy - 6);
      c.closePath(); c.fill();
      c.fillStyle = s.spike;
      [[x + 8, fy - 22], [x + 18, fy - 24], [x + 28, fy - 24]].forEach(([px, py], i) => {
        const sz = 4.5 + i * 0.6;
        c.beginPath(); c.moveTo(px - sz * 0.7, py + 3); c.lineTo(px, py - sz * 0.8); c.lineTo(px + sz * 0.7, py + 3); c.closePath(); c.fill();
      });
      c.fillStyle = s.body;
      c.beginPath(); c.ellipse(x + 23, fy - 13, 24, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = s.belly;
      c.beginPath(); c.ellipse(x + 28, fy - 9, 12, 5.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = s.body;
      rr(c, x + 36, fy - 29, 28, 19, 9); c.fill();
      c.strokeStyle = s.dark;
      c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(x + 36, fy - 8); c.lineTo(x + 42, fy - 5); c.stroke();
      drawFace(c, x + 53, fy - 22, s, pose, blink, 0.9);
    }
    c.restore();
  }

  function drawFace(c, ex, ey, s, pose, blink, k = 1) {
    // joue
    c.fillStyle = 'rgba(255,120,150,0.35)';
    c.beginPath(); c.ellipse(ex - 3 * k, ey + 8 * k, 3.5 * k, 2.2 * k, 0, 0, Math.PI * 2); c.fill();
    // narine
    c.fillStyle = s.dark;
    c.beginPath(); c.arc(ex + 8 * k, ey - 2 * k, 1.1 * k, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.6 * k;
    if (pose === 'dead') {
      const r = 3 * k;
      c.beginPath(); c.moveTo(ex - r, ey - r); c.lineTo(ex + r, ey + r); c.moveTo(ex + r, ey - r); c.lineTo(ex - r, ey + r); c.stroke();
      c.fillStyle = INK;
      c.beginPath(); c.ellipse(ex + 6 * k, ey + 8 * k, 2.2 * k, 2.8 * k, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    if (blink) {
      c.beginPath(); c.arc(ex, ey - 1 * k, 3.6 * k, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    } else {
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(ex, ey, 4.8 * k, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK;
      c.beginPath(); c.arc(ex + 1.3 * k, ey + 0.4 * k, 2.7 * k, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(ex + 2.2 * k, ey - 0.8 * k, 1 * k, 0, Math.PI * 2); c.fill();
    }
    // sourire
    c.beginPath();
    if (pose === 'jump') c.arc(ex + 5 * k, ey + 6.5 * k, 2.4 * k, 0, Math.PI);
    else c.arc(ex + 5 * k, ey + 5 * k, 3 * k, 0.2 * Math.PI, 0.75 * Math.PI);
    c.stroke();
  }

  function drawDigits(str, xRight, y, size, color) {
    ctx.font = `700 ${size}px "DM Sans", system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const adv = size * 0.6;
    for (let i = str.length - 1, k = 0; i >= 0; i--, k++) ctx.fillText(str[i], xRight - adv * (k + 0.5), y);
    return adv * str.length;
  }

  function drawHud(P) {
    const ink = rgb(mix(hex(INK), [255, 255, 255], P.night));
    const soft = rgb(mix(hex(INK), [255, 255, 255], P.night), 0.5);
    const right = W - 18;
    if (G.state !== 'idle') {
      const visible = G.flash <= 0 || Math.floor(G.flash * 8) % 2 === 0;
      const w = visible ? drawDigits(String(score()).padStart(5, '0'), right, 34, 22, ink) : 22 * 0.6 * 5;
      if (stats.best > 0) {
        const bw = drawDigits(String(stats.best).padStart(5, '0'), right - w - 14, 34, 14, soft);
        ctx.font = '700 10px "DM Sans", system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = soft;
        ctx.fillText('RECORD', right - w - 18 - bw, 33);
      }
      // étoiles
      starPath(28, 29, 9, 4.3);
      ctx.fillStyle = '#ffd24a'; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = '#f0a81c'; ctx.stroke();
      ctx.font = '700 17px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = ink;
      ctx.fillText(String(G.stars), 42, 35);
      if (G.shield) {
        const sx = 42 + ctx.measureText(String(G.stars)).width + 22;
        ctx.fillStyle = 'rgba(159,216,255,0.6)';
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(sx, 29, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (stats.best > 0) {
      const bw = drawDigits(String(stats.best).padStart(5, '0'), right, 34, 16, soft);
      ctx.font = '700 10px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = soft;
      ctx.fillText('RECORD', right - bw - 6, 33);
    }
  }

  // ------------------------------------------------------------ main loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (G.state !== 'pause') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ----------------------------------------------------------- badges/ui
  function unlock(id) {
    if (earned[id]) return false;
    earned[id] = dayKey();
    store.set('badges', earned);
    const b = BADGES.find((x) => x.id === id);
    if (b) { toast(b.icon, `Badge débloqué : <b>${esc(b.name)}</b>`); Sound.badge(); }
    renderBadges();
    return true;
  }

  function toast(icon, html) {
    const zone = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="t-ico">${icon}</span><span>${html}</span>`;
    zone.appendChild(el);
    while (zone.children.length > 3) zone.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2600);
  }

  function renderBoard() {
    const ol = $('#board');
    if (!board.length) {
      ol.innerHTML = '<li class="empty">Aucun score pour l\'instant.<br>À vous de jouer !</li>';
      return;
    }
    ol.innerHTML = board.map((e, i) => `
      <li class="${G.entry && e.id === G.entry.id ? 'me' : ''}">
        <span class="rank r${i + 1}">${i + 1}</span>
        <span class="who">${esc(e.name || 'Anonyme')}</span>
        <span class="pts">${fmt(e.score)}</span>
      </li>`).join('');
  }

  function renderBadges() {
    const n = BADGES.filter((b) => earned[b.id]).length;
    $('#badgeCount').textContent = `${n} sur ${BADGES.length} débloqués`;
    $('#badgeGrid').innerHTML = BADGES.map((b) => `
      <div class="badge ${earned[b.id] ? 'on' : ''}" title="${esc(b.desc)}">
        <span class="medal" aria-hidden="true">${b.icon}</span>
        <span class="b-name">${esc(b.name)}</span>
        <span class="b-desc">${esc(b.desc)}</span>
      </div>`).join('');
  }

  function renderStats() {
    const mins = Math.round(stats.time / 60);
    const tiles = [
      [fmt(stats.games), stats.games > 1 ? 'parties jouées' : 'partie jouée'],
      [fmt(stats.best), 'meilleur score'],
      [fmt(stats.stars), 'étoiles ramassées'],
      [stats.meters >= 1000 ? `${(stats.meters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : `${fmt(stats.meters)} m`, `parcourus en ${mins < 1 ? '< 1' : mins} min`],
    ];
    $('#statGrid').innerHTML = tiles.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  }

  const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.6l4.6-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderDaily() {
    const ch = challenge();
    $('#dailyDate').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const objs = [
      { label: `Atteindre <b>${ch.target}</b> points`, cur: daily.bestScore, goal: ch.target },
      { label: `Ramasser <b>${ch.stars}</b> étoiles en une partie`, cur: daily.bestStars, goal: ch.stars },
    ];
    $('#dailyList').innerHTML = objs.map((o) => {
      const done = o.cur >= o.goal;
      return `<li class="obj ${done ? 'done' : ''}">
        <span class="check">${CHECK}</span>
        <span class="obj-label">${o.label}</span>
        <span class="obj-prog">${Math.min(o.cur, o.goal)} / ${o.goal}</span>
        <span class="bar"><i style="width:${clamp((o.cur / o.goal) * 100, 0, 100)}%"></i></span>
      </li>`;
    }).join('');
    const y = new Date(); y.setDate(y.getDate() - 1);
    const alive = streak.last === ch.key || streak.last === dayKey(y);
    const count = alive ? streak.count : 0;
    $('#streak').innerHTML = daily.done
      ? `🔥 Défi réussi ! Série en cours : <b>${count} jour${count > 1 ? 's' : ''}</b>. Revenez demain.`
      : count > 0
        ? `🔥 Série en cours : <b>${count} jour${count > 1 ? 's' : ''}</b>. Ne la perdez pas !`
        : 'Un nouveau défi chaque jour, le même pour tout le monde.';
    $('#startSub').textContent = daily.done ? 'Défi du jour réussi ✓' : `Défi du jour : ${ch.target} points et ${ch.stars} étoiles`;
  }

  function renderSkins() {
    const grid = $('#skinGrid');
    grid.innerHTML = '';
    for (const s of SKINS) {
      const locked = s.need > stats.best;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'skin' + (s.id === skinId ? ' sel' : '');
      b.disabled = locked;
      b.setAttribute('aria-pressed', s.id === skinId);
      b.innerHTML = `<canvas width="160" height="136"></canvas><span class="s-name">${esc(s.name)}</span><span class="s-need">${locked ? `record ≥ ${fmt(s.need)}` : s.id === skinId ? 'choisi' : 'disponible'}</span>${locked ? '<span class="lock" aria-hidden="true">🔒</span>' : ''}`;
      const c = b.querySelector('canvas').getContext('2d');
      c.scale(2, 2);
      c.fillStyle = 'rgba(40,30,70,0.12)';
      c.beginPath(); c.ellipse(41, 63, 20, 3, 0, 0, Math.PI * 2); c.fill();
      drawDino(c, 20, 63, s, 'stand', 0, false);
      b.addEventListener('click', () => {
        skinId = s.id;
        store.set('skin', skinId);
        renderSkins();
      });
      grid.appendChild(b);
    }
  }

  function renderAll() { renderBoard(); renderBadges(); renderStats(); renderDaily(); renderSkins(); }

  // ---------------------------------------------------------------- misc
  async function share() {
    const sc = score();
    const text = `J'ai fait ${sc} points à Dino Rêveur 🦖, le jeu proposé par Zoé Dewitte ! Tu fais mieux ?`;
    const url = location.origin + location.pathname;
    const full = `${text} ${url}`;

    // 1. Feuille de partage native (mobile, HTTPS)
    if (navigator.share) {
      try { await navigator.share({ title: 'Dino Rêveur', text, url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // 2. Presse-papier moderne (HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(full); toast('📋', 'Texte copié, il n\'y a plus qu\'à le coller !'); return; }
      catch (e) { /* on tente la méthode suivante */ }
    }
    // 3. Copie à l'ancienne, qui marche aussi en HTTP
    if (legacyCopy(full)) { toast('📋', 'Texte copié, il n\'y a plus qu\'à le coller !'); return; }
    // 4. Dernier recours : afficher le texte à copier à la main
    window.prompt('Copiez ce texte pour partager votre score :', full);
  }

  function legacyCopy(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, str.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  const soundBtn = $('#soundBtn');
  function syncSound() {
    soundBtn.classList.toggle('muted', muted);
    soundBtn.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
  }
  soundBtn.addEventListener('click', () => { muted = !muted; store.set('muted', muted); syncSound(); Sound.ensure(); soundBtn.blur(); });
  $('#pauseBtn').addEventListener('click', (e) => {
    if (G.state === 'idle' || G.state === 'over') start();
    else togglePause();
    e.currentTarget.blur();
  });
  const fsBtn = $('#fsBtn');
  const fsReq = stage.requestFullscreen || stage.webkitRequestFullscreen;
  if (!fsReq) fsBtn.hidden = true;
  fsBtn.addEventListener('click', () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else fsReq.call(stage);
    fsBtn.blur();
  });

  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Effacer vos scores, badges et statistiques ? Cette action est définitive.')) {
      store.clear();
      location.reload();
    }
  });

  // confettis pour les records
  const cf = $('#confetti');
  const cfx = cf.getContext('2d');
  let conf = [];
  let cfRunning = false;
  function confetti() {
    if (reduceMotion) return;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    cf.width = innerWidth * d; cf.height = innerHeight * d;
    cfx.setTransform(d, 0, 0, d, 0, 0);
    const r = stage.getBoundingClientRect();
    const colors = ['#ff7c9c', '#ffd24a', '#5cc28a', '#5bb8f0', '#a98bf0', '#ffab5c'];
    for (let i = 0; i < 170; i++) {
      conf.push({ x: r.left + r.width / 2 + rand(-60, 60), y: r.top + r.height * 0.35, vx: rand(-10, 10), vy: rand(-17, -6), rot: rand(0, 6), vr: rand(-0.3, 0.3), w: rand(6, 10), h: rand(9, 15), c: colors[i % colors.length] });
    }
    if (!cfRunning) { cfRunning = true; requestAnimationFrame(cfStep); }
  }
  function cfStep() {
    cfx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of conf) {
      p.vy += 0.36; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      cfx.save();
      cfx.translate(p.x, p.y);
      cfx.rotate(p.rot);
      cfx.scale(1, Math.cos(p.rot * 2));
      cfx.fillStyle = p.c;
      cfx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cfx.restore();
    }
    conf = conf.filter((p) => p.y < innerHeight + 40);
    if (conf.length) requestAnimationFrame(cfStep);
    else { cfRunning = false; cfx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ---------------------------------------------------------------- boot
  syncSound();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  resize();
  renderAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());
  requestAnimationFrame(frame);
})();
