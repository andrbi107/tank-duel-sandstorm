/* Tank Duel: Sandstorm — main.js
   Vanilla JS turn-based artillery duel. No external dependencies.
   Renders to a single landscape <canvas>; overlay DOM handles HUD + screens. */
(function () {
'use strict';

/* ============================================================ Constants */
var PHYS_DT = 1 / 60;
var GRAVITY = 520;          // px/s^2 pulling the shell down
var WIND_ACCEL = 70;        // px/s^2 per unit of wind
var POWER_BASE = 180;       // px/s velocity at power 0
var POWER_SCALE = 6.4;      // px/s per power unit (power 0..100 -> 180..820)
var TERRAIN_STEP = 8;       // px per heightmap column
var EXPLOSION_RADIUS = 44;  // blast radius for damage + visual ring
var TANK_HIT_RADIUS = 16;   // within this = direct hit
var TANK_HP = 100;
var BARREL_LEN = 26;
var TANK_W = 30;
var TANK_H = 12;
var DIRECT_MIN = 25, DIRECT_MAX = 40;
var NEAR_MIN = 10, NEAR_MAX = 20;

// v0.0.3 — weapon variety
var WEAPONS = {
  standard: { name: 'استاندارد', blastR: 1.0,  dmgScale: 1.0,  velScale: 1.0,  cluster: 0, spread: 0 },
  cluster:  { name: 'خوشه‌ای',   blastR: 0.55, dmgScale: 0.5,  velScale: 1.05, cluster: 3, spread: 26 },
  heavy:    { name: 'سنگین',     blastR: 1.5,  dmgScale: 1.5,  velScale: 0.82, cluster: 0, spread: 0 }
};
var WEAPON_ORDER = ['standard', 'cluster', 'heavy'];
var RESOLVE_DELAY = 0.9;    // s after impact before turn passes
var ENEMY_THINK_DELAY = 0.8;// s the AI visibly aims before firing
var KEY_REPEAT = 0.03;      // s between held-key adjustments

var DIFFICULTY = {
  easy:   { angleErr: 8, powerErr: 15, stepAngle: 6,   stepPower: 12 },
  normal: { angleErr: 4, powerErr: 8,  stepAngle: 3,   stepPower: 6 },
  hard:   { angleErr: 1, powerErr: 3,  stepAngle: 1.5, stepPower: 3 }
};
var DIFF_RANK = { easy: 1, normal: 2, hard: 3 };

var SKY_THEMES = {
  day: {
    sky:   [['#3b7eaf', 0], ['#87b5d4', 0.55], ['#e8eef2', 1]],
    sun: '#fff4c0', sunGlow: '#fff4c0', sunX: 0.78, sunY: 0.18, sunR: 0.05,
    far: '#6a7a88', near: '#56636c',
    sand:  [['#d9b370', 0], ['#a87d44', 0.4], ['#5e3f22', 1]],
    crest: '#f0d29a', stars: false
  },
  dusk: {
    sky:   [['#2a1842', 0], ['#8c3a4a', 0.5], ['#e88a4a', 1]],
    sun: '#ff9a4a', sunGlow: '#ffb567', sunX: 0.74, sunY: 0.30, sunR: 0.07,
    far: '#3e2440', near: '#2a1830',
    sand:  [['#c89060', 0], ['#946234', 0.4], ['#4a2e18', 1]],
    crest: '#e8b878', stars: false
  },
  night: {
    sky:   [['#020410', 0], ['#060c20', 0.55], ['#0a1428', 1]],
    sun: '#d8e4f0', sunGlow: '#a8c0e0', sunX: 0.78, sunY: 0.16, sunR: 0.045,
    far: '#0c1830', near: '#08101f',
    sand:  [['#5a4a3a', 0], ['#3e3225', 0.4], ['#1e160e', 1]],
    crest: '#7a6a52', stars: true
  },
  dawn: {
    sky:   [['#1a1430', 0], ['#a86a78', 0.55], ['#ffd9b0', 1]],
    sun: '#ffe6c0', sunGlow: '#ffd0a0', sunX: 0.72, sunY: 0.42, sunR: 0.06,
    far: '#4a3a4a', near: '#362838',
    sand:  [['#c4a070', 0], ['#946a3a', 0.4], ['#4a2e18', 1]],
    crest: '#e8c890', stars: false
  }
};

var PLAYER_COLOR = '#5a8c3a';
var PLAYER_DARK = '#3e6428';
var ENEMY_COLOR = '#a8442e';
var ENEMY_DARK = '#6e2a1a';

var RECORD_KEY = 'tankDuel.record';
var NAME_KEY = 'tankDuel.name';

/* ============================================================ Helpers */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }

function shade(hex, amt) {
  var n = parseInt(hex.slice(1), 16);
  var r = clamp(((n >> 16) & 255) + amt, 0, 255);
  var g = clamp(((n >> 8) & 255) + amt, 0, 255);
  var b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function hexA(hex, a) {
  var n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function roundRect(c, x, y, w, h, r) {
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, r); return; }
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ============================================================ DOM refs */
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
var $ = function (id) { return document.getElementById(id); };

/* ============================================================ State */
var W = 0, H = 0, dpr = 1;
var screen = 'start';        // start | playing | paused | round-over | match-over
var phase = 'aim';           // aim | fire | enemy-think | resolve
var turn = 'player';         // player | enemy

var settings = { sky: 'dusk', difficulty: 'normal', mode: 1, weapon: 'standard' };
var playerName = '';

var terrain = [];
var player = null;
var enemy = null;
var shell = null;
var particles = [];
var explosions = [];
var stars = [];
var wind = 0;

var phaseTimer = 0;
var roundOverPending = false;
var matchMode = 1;
var matchPlayerWins = 0, matchEnemyWins = 0;

var keysHeld = {};
var keyRepeatAcc = 0;
var pointer = { active: false, startX: 0, startY: 0, lastY: 0, moved: false };

var lastTime = 0;
var physAcc = 0;

/* ============================================================ Storage */
function loadName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
}
function saveName(n) {
  try { localStorage.setItem(NAME_KEY, n); } catch (e) {}
}
function loadRecord() {
  try {
    var v = localStorage.getItem(RECORD_KEY);
    if (v) {
      var r = JSON.parse(v);
      return {
        wins: (r && r.wins) || 0,
        losses: (r && r.losses) || 0,
        hardestDifficultyWon: (r && r.hardestDifficultyWon) || null
      };
    }
  } catch (e) {}
  return { wins: 0, losses: 0, hardestDifficultyWon: null };
}
function saveRecord(r) {
  try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch (e) {}
}

/* ============================================================ Canvas sizing */
function resize() {
  var oldW = W, oldH = H;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.clientWidth || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (terrain.length) {
    rescaleTerrain(oldW, oldH);
    if (player) player.x = (player.x / (oldW || W)) * W;
    if (enemy) enemy.x = (enemy.x / (oldW || W)) * W;
  } else {
    generateTerrain();
  }
}
function rescaleTerrain(oldW, oldH) {
  if (!oldW || !oldH) { generateTerrain(); return; }
  var count = Math.ceil(W / TERRAIN_STEP) + 2;
  var old = terrain;
  var oldCount = old.length;
  var next = new Array(count);
  for (var i = 0; i < count; i++) {
    var x = i * TERRAIN_STEP;
    var fx = (x / W) * oldW;
    var idx = clamp(fx / TERRAIN_STEP, 0, oldCount - 1);
    var i0 = Math.floor(idx);
    var i1 = Math.min(oldCount - 1, i0 + 1);
    var t = idx - i0;
    next[i] = (old[i0] * (1 - t) + old[i1] * t) * (H / oldH);
  }
  terrain = next;
}

/* ============================================================ Terrain */
function generateTerrain() {
  var count = Math.ceil(W / TERRAIN_STEP) + 2;
  var base = H * 0.72;
  terrain = new Array(count);
  var drift = rand(-10, 10);
  for (var i = 0; i < count; i++) {
    drift += rand(-5, 5);
    drift *= 0.94;
    var x = i * TERRAIN_STEP;
    var h = Math.sin(x * 0.006 + 1.2) * H * 0.04
          + Math.sin(x * 0.014) * H * 0.018
          + Math.sin(x * 0.0024 + 0.8) * H * 0.03;
    terrain[i] = clamp(base + h + drift, H * 0.55, H * 0.88);
  }
}
function terrainY(x) {
  if (!terrain.length) return H * 0.72;
  var idx = clamp(x / TERRAIN_STEP, 0, terrain.length - 1);
  var i0 = Math.floor(idx);
  var i1 = Math.min(terrain.length - 1, i0 + 1);
  var t = idx - i0;
  return terrain[i0] * (1 - t) + terrain[i1] * t;
}
function carveCrater(x, y, r) {
  var start = Math.max(0, Math.floor((x - r) / TERRAIN_STEP));
  var end = Math.min(terrain.length - 1, Math.ceil((x + r) / TERRAIN_STEP));
  for (var i = start; i <= end; i++) {
    var px = i * TERRAIN_STEP;
    var dx = px - x;
    if (Math.abs(dx) >= r) continue;
    var depth = Math.sqrt(r * r - dx * dx) * 0.7;
    var newY = Math.min(H * 0.96, y + depth);
    if (newY > terrain[i]) terrain[i] = newY;
  }
}

/* ============================================================ Tanks */
function tankCenterY(t) { return terrainY(t.x) - TANK_H / 2; }
function getMuzzle(t) {
  var cy = tankCenterY(t);
  var turretY = cy - TANK_H / 2 - 4;
  var rad = t.angle * Math.PI / 180;
  return {
    x: t.x + t.dir * Math.cos(rad) * BARREL_LEN,
    y: turretY - Math.sin(rad) * BARREL_LEN
  };
}
function placeTanks() {
  player = { x: W * 0.15, hp: TANK_HP, angle: 45, power: 60, dir: 1, hitFlash: 0 };
  enemy  = { x: W * 0.82, hp: TANK_HP, angle: 45, power: 60, dir: -1, hitFlash: 0 };
}

/* ============================================================ Wind */
function rerollWind() {
  wind = rand(-5, 5);
}

/* ============================================================ Fire + shell physics */
function fire(actor) {
  if (actor === 'player' && (phase !== 'aim' || turn !== 'player')) return;
  var t = actor === 'player' ? player : enemy;
  var m = getMuzzle(t);
  var weapon = actor === 'player' ? settings.weapon : 'standard';
  var W = WEAPONS[weapon];
  var v = (POWER_BASE + t.power * POWER_SCALE) * W.velScale;
  var rad = t.angle * Math.PI / 180;
  shell = {
    x: m.x, y: m.y,
    vx: Math.cos(rad) * v * t.dir,
    vy: -Math.sin(rad) * v,
    trail: [],
    actor: actor,
    weapon: weapon
  };
  phase = 'fire';
  if (actor === 'player' && window.MUX) MUX.hit();
  updateHUD();
}
function updateShell(dt) {
  if (!shell) return;
  shell.trail.push({ x: shell.x, y: shell.y });
  if (shell.trail.length > 16) shell.trail.shift();
  shell.vx += wind * WIND_ACCEL * dt;
  shell.vy += GRAVITY * dt;
  shell.x += shell.vx * dt;
  shell.y += shell.vy * dt;

  var target = shell.actor === 'player' ? enemy : player;
  if (target) {
    var tcy = tankCenterY(target);
    if (Math.hypot(target.x - shell.x, tcy - shell.y) < TANK_HIT_RADIUS + 4) {
      detonate(shell.x, shell.y, shell.actor, shell.weapon);
      shell = null;
      endTurnAfterImpact();
      return;
    }
  }
  if (shell.y >= terrainY(shell.x) - 1) {
    detonate(shell.x, terrainY(shell.x), shell.actor, shell.weapon);
    shell = null;
    endTurnAfterImpact();
    return;
  }
  if (shell.x < -20 || shell.x > W + 20 || shell.y > H + 40) {
    shell = null;
    endTurnAfterImpact();
  }
}

/* ============================================================ Explosion + damage */
function explode(x, y, actor, weapon) {
  var W = WEAPONS[weapon || 'standard'];
  var hitR = TANK_HIT_RADIUS * W.blastR;
  var expR = EXPLOSION_RADIUS * W.blastR;
  var tanks = [player, enemy];
  for (var i = 0; i < tanks.length; i++) {
    var t = tanks[i];
    if (!t || t.hp <= 0) continue;
    var tcy = tankCenterY(t);
    var d = Math.hypot(t.x - x, tcy - y);
    var dmg = 0;
    if (d < hitR) {
      dmg = Math.round((DIRECT_MAX - (d / hitR) * (DIRECT_MAX - DIRECT_MIN)) * W.dmgScale);
    } else if (d < expR) {
      dmg = Math.round((NEAR_MAX - ((d - hitR) / (expR - hitR)) * (NEAR_MAX - NEAR_MIN)) * W.dmgScale);
    }
    if (dmg > 0) {
      t.hp = Math.max(0, t.hp - dmg);
      t.hitFlash = 1;
      toast((t === player ? 'YOU' : 'AI') + ' -' + dmg + ' HP');
    }
  }
  carveCrater(x, y, expR * 0.8);
  explosions.push({ x: x, y: y, maxR: expR * 1.3, age: 0, life: 0.6 });
  spawnDust(x, y, Math.round(24 * W.blastR));
}
// v0.0.3 — detonate handles cluster splitting before explode()
function detonate(x, y, actor, weapon) {
  var W = WEAPONS[weapon || 'standard'];
  if (W.cluster > 1) {
    for (var k = 0; k < W.cluster; k++) {
      var off = (k - (W.cluster - 1) / 2) * W.spread;
      explode(x + off, y, actor, weapon);
    }
  } else {
    explode(x, y, actor, weapon);
  }
}
function spawnDust(x, y, count) {
  var colors = ['#ffb84a', '#ff7a3a', '#d9b370', '#8b5a2b', '#fff2c0'];
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var sp = rand(40, 200);
    particles.push({
      x: x, y: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - rand(0, 90),
      life: rand(0.5, 1.1), maxLife: 1.1,
      size: rand(2, 5),
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 220
    });
  }
}
function updateParticles(dt) {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity || 0) * dt;
    p.vx *= 0.98;
    p.life -= dt;
  }
  particles = particles.filter(function (p) { return p.life > 0; });
}
function updateExplosions(dt) {
  for (var i = 0; i < explosions.length; i++) explosions[i].age += dt;
  explosions = explosions.filter(function (e) { return e.age < e.life; });
}

/* ============================================================ AI */
function simulateShot(ox, oy, angle, power, wd, dir, tx, ty) {
  var v = POWER_BASE + power * POWER_SCALE;
  var rad = angle * Math.PI / 180;
  var x = ox, y = oy;
  var vx = Math.cos(rad) * v * dir;
  var vy = -Math.sin(rad) * v;
  var closest = Math.hypot(tx - x, ty - y);
  for (var i = 0; i < 600; i++) {
    vx += wd * WIND_ACCEL * PHYS_DT;
    vy += GRAVITY * PHYS_DT;
    x += vx * PHYS_DT;
    y += vy * PHYS_DT;
    var d = Math.hypot(tx - x, ty - y);
    if (d < closest) closest = d;
    if (y >= terrainY(x) - 1) break;
    if (x < -20 || x > W + 20 || y > H + 40) break;
  }
  return closest;
}
function findAIShot() {
  var m = getMuzzle(enemy);
  var tx = player.x, ty = tankCenterY(player);
  var cfg = DIFFICULTY[settings.difficulty];
  var best = { angle: 45, power: 60, dist: Infinity };
  for (var a = 5; a <= 85; a += cfg.stepAngle) {
    for (var p = 15; p <= 100; p += cfg.stepPower) {
      var d = simulateShot(m.x, m.y, a, p, wind, enemy.dir, tx, ty);
      if (d < best.dist) best = { angle: a, power: p, dist: d };
    }
  }
  return best;
}
function applyAIError(shot) {
  var cfg = DIFFICULTY[settings.difficulty];
  return {
    angle: clamp(shot.angle + rand(-cfg.angleErr, cfg.angleErr), 0, 90),
    power: clamp(shot.power + rand(-cfg.powerErr, cfg.powerErr), 0, 100)
  };
}

/* ============================================================ Turn flow */
function endTurnAfterImpact() {
  phase = 'resolve';
  phaseTimer = RESOLVE_DELAY;
}
function startEnemyTurn() {
  turn = 'enemy';
  phase = 'enemy-think';
  phaseTimer = ENEMY_THINK_DELAY;
  rerollWind(); // wind is re-rolled every turn; the AI aims with the new wind
  // Compute the firing solution up front so the barrel visibly aims during the delay.
  var shot = findAIShot();
  var errd = applyAIError(shot);
  enemy.angle = errd.angle;
  enemy.power = errd.power;
  updateHUD();
}
function checkRoundOver() {
  if (!player || !enemy) return false;
  if (player.hp <= 0 || enemy.hp <= 0) {
    var winner;
    if (player.hp <= 0 && enemy.hp <= 0) winner = 'draw';
    else if (enemy.hp <= 0) winner = 'player';
    else winner = 'enemy';
    finishRound(winner);
    return true;
  }
  return false;
}
function finishRound(winner) {
  if (winner === 'player') matchPlayerWins++;
  else if (winner === 'enemy') matchEnemyWins++;
  roundOverPending = true;
  var needed = Math.ceil(matchMode / 2);
  if (matchPlayerWins >= needed || matchEnemyWins >= needed) {
    setTimeout(function () { roundOverPending = false; showMatchOver(matchPlayerWins > matchEnemyWins); }, 850);
  } else {
    (function (w) {
      setTimeout(function () { roundOverPending = false; showRoundOver(w); }, 850);
    })(winner);
  }
}

/* ============================================================ Physics step */
function updatePhysics(dt) {
  if (roundOverPending) return;
  if (phase === 'fire') {
    updateShell(dt);
  } else if (phase === 'enemy-think') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) fire('enemy');
  } else if (phase === 'resolve') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) {
      if (checkRoundOver()) return;
      if (turn === 'player') {
        startEnemyTurn();
      } else {
        turn = 'player';
        phase = 'aim';
        rerollWind();
        updateHUD();
      }
    }
  }
  [player, enemy].forEach(function (t) {
    if (t && t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 4);
  });
}

/* ============================================================ Rendering */
function render() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawTerrain();
  drawAimPreview();
  drawTank(player, true);
  drawTank(enemy, false);
  drawShell();
  drawExplosions();
  drawParticles();
  drawWindArrow();
}
function drawBackground() {
  var theme = SKY_THEMES[settings.sky];
  var g = ctx.createLinearGradient(0, 0, 0, H);
  for (var i = 0; i < theme.sky.length; i++) g.addColorStop(theme.sky[i][1], theme.sky[i][0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  var sx = W * theme.sunX, sy = H * theme.sunY, sr = H * theme.sunR;
  var glow = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 6);
  glow.addColorStop(0, hexA(theme.sunGlow, 0.55));
  glow.addColorStop(1, hexA(theme.sunGlow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
  ctx.fillStyle = theme.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();

  if (theme.stars) {
    ctx.fillStyle = '#ffffff';
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      ctx.globalAlpha = st.alpha;
      ctx.fillRect(st.x * W, st.y * H, st.size, st.size);
    }
    ctx.globalAlpha = 1;
  }

  // far dune silhouette
  ctx.fillStyle = theme.far;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (var x = 0; x <= W; x += 20) {
    var y = H * 0.55 + Math.sin(x * 0.005) * H * 0.04 + Math.sin(x * 0.013 + 2) * H * 0.02;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // near dune silhouette
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = theme.near;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (var x2 = 0; x2 <= W; x2 += 24) {
    var y2 = H * 0.62 + Math.sin(x2 * 0.007 + 1) * H * 0.03;
    ctx.lineTo(x2, y2);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}
function drawTerrain() {
  if (!terrain.length) return;
  var theme = SKY_THEMES[settings.sky];
  var g = ctx.createLinearGradient(0, H * 0.6, 0, H);
  for (var i = 0; i < theme.sand.length; i++) g.addColorStop(theme.sand[i][1], theme.sand[i][0]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (var i = 0; i < terrain.length; i++) ctx.lineTo(i * TERRAIN_STEP, terrain[i]);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = theme.crest;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var j = 0; j < terrain.length; j++) {
    var x = j * TERRAIN_STEP;
    if (j === 0) ctx.moveTo(x, terrain[j]);
    else ctx.lineTo(x, terrain[j]);
  }
  ctx.stroke();
}
function drawTank(t, isPlayer) {
  if (!t) return;
  var cy = tankCenterY(t);
  var surfaceY = terrainY(t.x);
  var turretY = cy - TANK_H / 2 - 4;
  var color = isPlayer ? PLAYER_COLOR : ENEMY_COLOR;
  var dark = isPlayer ? PLAYER_DARK : ENEMY_DARK;

  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(t.x, surfaceY + 2, TANK_W / 2 + 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // treads
  ctx.fillStyle = dark;
  roundRect(ctx, t.x - TANK_W / 2, cy - 2, TANK_W, TANK_H + 4, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (var tx = -TANK_W / 2 + 4; tx < TANK_W / 2; tx += 5) {
    ctx.fillRect(t.x + tx, cy + 2, 2, 4);
  }

  // body
  var grad = ctx.createLinearGradient(0, cy - TANK_H / 2, 0, cy + TANK_H / 2);
  grad.addColorStop(0, shade(color, 22));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  roundRect(ctx, t.x - TANK_W / 2 + 2, cy - TANK_H / 2, TANK_W - 4, TANK_H, 3);
  ctx.fill();

  // turret
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(t.x, turretY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, 12);
  ctx.beginPath();
  ctx.arc(t.x, turretY, 4, 0, Math.PI * 2);
  ctx.fill();

  // barrel
  var rad = t.angle * Math.PI / 180;
  var muzzleX = t.x + t.dir * Math.cos(rad) * BARREL_LEN;
  var muzzleY = turretY - Math.sin(rad) * BARREL_LEN;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(t.x, turretY);
  ctx.lineTo(muzzleX, muzzleY);
  ctx.stroke();
  ctx.strokeStyle = shade(color, 18);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(t.x, turretY);
  ctx.lineTo(muzzleX, muzzleY);
  ctx.stroke();

  // hit flash
  if (t.hitFlash > 0) {
    ctx.globalAlpha = t.hitFlash;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, t.x - TANK_W / 2 + 2, cy - TANK_H / 2, TANK_W - 4, TANK_H, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // HP bar
  var barW = 42, barH = 5;
  var bx = t.x - barW / 2;
  var by = cy - TANK_H / 2 - 18;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  ctx.fillStyle = isPlayer ? '#5fd17a' : '#d75f5f';
  ctx.fillRect(bx, by, barW * (t.hp / TANK_HP), barH);
}
function drawShell() {
  if (!shell) return;
  ctx.save();
  for (var i = 0; i < shell.trail.length; i++) {
    var p = shell.trail[i];
    ctx.globalAlpha = (i / shell.trail.length) * 0.5;
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff2c0';
  ctx.beginPath();
  ctx.arc(shell.x, shell.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawExplosions() {
  for (var i = 0; i < explosions.length; i++) {
    var e = explosions[i];
    var t = e.age / e.life;
    var r = e.maxR * t;
    var alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = '#ff5a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = '#ffb84a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    if (t < 0.3) {
      ctx.globalAlpha = (0.3 - t) / 0.3;
      ctx.fillStyle = '#fff2c0';
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
function drawParticles() {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
function drawWindArrow() {
  if (screen !== 'playing') return;
  var cx = W / 2;
  var cy = 70;
  var mag = Math.abs(wind);
  if (mag < 0.1) {
    ctx.save();
    ctx.fillStyle = '#ffd97a';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  var len = 14 + mag * 14;
  var dir = wind >= 0 ? 1 : -1;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#ffd97a';
  ctx.fillStyle = '#ffd97a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - dir * len / 2, cy);
  ctx.lineTo(cx + dir * len / 2, cy);
  ctx.stroke();
  var tipX = cx + dir * len / 2;
  ctx.beginPath();
  ctx.moveTo(tipX, cy);
  ctx.lineTo(tipX - dir * 9, cy - 6);
  ctx.lineTo(tipX - dir * 9, cy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawAimPreview() {
  if (screen !== 'playing' || phase !== 'aim' || turn !== 'player' || !player) return;
  var m = getMuzzle(player);
  var v = POWER_BASE + player.power * POWER_SCALE;
  var rad = player.angle * Math.PI / 180;
  var x = m.x, y = m.y;
  var vx = Math.cos(rad) * v * player.dir;
  var vy = -Math.sin(rad) * v;
  ctx.save();
  ctx.fillStyle = '#ffd97a';
  for (var i = 0; i < 48; i++) {
    vx += wind * WIND_ACCEL * PHYS_DT;
    vy += GRAVITY * PHYS_DT;
    x += vx * PHYS_DT;
    y += vy * PHYS_DT;
    if (y >= terrainY(x) - 1) break;
    if (x < -20 || x > W + 20 || y > H + 40) break;
    if (i % 2 === 0) {
      ctx.globalAlpha = 0.55 * (1 - i / 48);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ============================================================ HUD */
function updateHUD() {
  if (!player || !enemy) return;
  $('hp-name-left').textContent = playerName ? playerName.toUpperCase().slice(0, 8) : 'YOU';
  $('hp-name-right').textContent = 'AI';
  $('hp-fill-left').style.width = (player.hp / TANK_HP * 100) + '%';
  $('hp-fill-right').style.width = (enemy.hp / TANK_HP * 100) + '%';
  $('wind-val').textContent = wind.toFixed(1);
  var arrow = $('wind-arrow');
  if (Math.abs(wind) < 0.1) arrow.textContent = '·';
  else arrow.textContent = wind > 0 ? '→' : '←';
  var ti = $('turn-indicator');
  if (phase === 'aim' && turn === 'player') {
    ti.textContent = 'YOUR TURN'; ti.classList.remove('enemy');
  } else if (phase === 'enemy-think' || turn === 'enemy') {
    ti.textContent = "OPPONENT'S TURN"; ti.classList.add('enemy');
  } else {
    ti.textContent = turn === 'player' ? 'FIRING' : 'INCOMING'; ti.classList.add('enemy');
  }
  $('angle-val').textContent = Math.round(player.angle);
  $('power-val').textContent = Math.round(player.power);
  $('power-fill').style.width = player.power + '%';
}

/* ============================================================ Toast */
var toastTimer = 0;
function toast(msg) {
  var el = $('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.getElementById('app').appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1300);
}

/* ============================================================ Screens */
function hideAllOverlays() {
  ['start-screen', 'pause-screen', 'round-over-screen', 'match-over-screen'].forEach(function (id) {
    $(id).classList.add('hidden');
  });
  $('hud').classList.add('hidden');
}
function showStart() {
  screen = 'start';
  phase = 'aim';
  shell = null;
  particles = [];
  explosions = [];
  if (!terrain.length) generateTerrain();
  hideAllOverlays();
  $('start-screen').classList.remove('hidden');
  var r = loadRecord();
  $('rec-wins').textContent = r.wins;
  $('rec-losses').textContent = r.losses;
  $('rec-best').textContent = r.hardestDifficultyWon ? r.hardestDifficultyWon.toUpperCase() : '—';
  $('name-input').value = playerName;
}
function showGame() {
  screen = 'playing';
  hideAllOverlays();
  $('hud').classList.remove('hidden');
  updateHUD();
}
function showPause() {
  if (screen !== 'playing') return;
  screen = 'paused';
  $('pause-screen').classList.remove('hidden');
}
function hidePause() {
  screen = 'playing';
  $('pause-screen').classList.add('hidden');
}
function showRoundOver(winner) {
  screen = 'round-over';
  var titleEl = $('round-over-title');
  var infoEl = $('round-over-info');
  if (winner === 'player') {
    titleEl.textContent = 'ROUND WON';
    infoEl.textContent = (playerName ? playerName.toUpperCase() : 'YOU') + ' destroyed the enemy tank.';
  } else if (winner === 'enemy') {
    titleEl.textContent = 'ROUND LOST';
    infoEl.textContent = 'The enemy destroyed your tank.';
  } else {
    titleEl.textContent = 'DRAW';
    infoEl.textContent = 'Both tanks were destroyed in the blast.';
  }
  $('round-over-score').textContent = 'Match: ' + matchPlayerWins + ' — ' + matchEnemyWins;
  $('btn-next-round').style.display = (matchMode > 1) ? '' : 'none';
  $('round-over-screen').classList.remove('hidden');
}
function showMatchOver(playerWon) {
  screen = 'match-over';
  var r = loadRecord();
  if (playerWon) {
    r.wins = (r.wins || 0) + 1;
    var rank = DIFF_RANK[settings.difficulty];
    var prev = r.hardestDifficultyWon ? DIFF_RANK[r.hardestDifficultyWon] : 0;
    if (rank > prev) r.hardestDifficultyWon = settings.difficulty;
  } else {
    r.losses = (r.losses || 0) + 1;
  }
  saveRecord(r);
  $('match-over-title').textContent = playerWon ? 'VICTORY' : 'DEFEAT';
  $('match-over-info').textContent = playerWon
    ? (playerName ? playerName.toUpperCase() : 'YOU') + ' won the match ' + matchPlayerWins + '–' + matchEnemyWins + '!'
    : 'The enemy won the match ' + matchEnemyWins + '–' + matchPlayerWins + '.';
  $('match-over-score').textContent = 'Match: ' + matchPlayerWins + ' — ' + matchEnemyWins;
  $('mo-rec-wins').textContent = r.wins;
  $('mo-rec-losses').textContent = r.losses;
  $('mo-rec-best').textContent = r.hardestDifficultyWon ? r.hardestDifficultyWon.toUpperCase() : '—';
  $('match-over-screen').classList.remove('hidden');
}

/* ============================================================ Match / round setup */
function startMatch() {
  matchMode = settings.mode;
  matchPlayerWins = 0;
  matchEnemyWins = 0;
  startRound();
}
function startRound() {
  generateTerrain();
  placeTanks();
  rerollWind();
  particles = [];
  explosions = [];
  shell = null;
  roundOverPending = false;
  turn = 'player';
  phase = 'aim';
  showGame();
}

/* ============================================================ Input: keyboard */
function mapKey(key) {
  switch (key.toLowerCase()) {
    case 'arrowup': case 'w': return 'up';
    case 'arrowdown': case 's': return 'down';
    case 'arrowleft': case 'a': return 'left';
    case 'arrowright': case 'd': return 'right';
    default: return null;
  }
}
function bindKeyboard() {
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    var mapped = mapKey(k);
    if (mapped) { keysHeld[mapped] = true; e.preventDefault(); }
    if (e.repeat) return;
    if (k === ' ' || k === 'Enter') {
      if (screen === 'playing' && phase === 'aim' && turn === 'player') fire('player');
      e.preventDefault();
    } else if (k === 'p' || k === 'P' || k === 'Escape') {
      togglePause();
      e.preventDefault();
    } else if (k === 'r' || k === 'R') {
      if (screen === 'paused') { hidePause(); startRound(); }
    } else if (k === 'q' || k === 'Q') {
      // v0.0.3 — cycle weapon during player's aim
      if (screen === 'playing' && phase === 'aim' && turn === 'player') {
        var idx = WEAPON_ORDER.indexOf(settings.weapon);
        settings.weapon = WEAPON_ORDER[(idx + 1) % WEAPON_ORDER.length];
        toast('سلاح: ' + WEAPONS[settings.weapon].name);
        // keep the settings UI in sync
        var wBtns = document.querySelectorAll('[data-group="weapon"] .choice');
        for (var bi = 0; bi < wBtns.length; bi++) {
          wBtns[bi].classList.toggle('active', wBtns[bi].dataset.value === settings.weapon);
        }
        e.preventDefault();
      }
    }
  });
  window.addEventListener('keyup', function (e) {
    var mapped = mapKey(e.key);
    if (mapped) keysHeld[mapped] = false;
  });
}
function togglePause() {
  if (screen === 'playing') showPause();
  else if (screen === 'paused') hidePause();
}
function applyHeldKeys(dt) {
  if (screen !== 'playing' || phase !== 'aim' || turn !== 'player') return;
  keyRepeatAcc += dt;
  if (keyRepeatAcc < KEY_REPEAT) return;
  keyRepeatAcc = 0;
  if (keysHeld.up) adjustAngle(1);
  if (keysHeld.down) adjustAngle(-1);
  if (keysHeld.right) adjustPower(2);
  if (keysHeld.left) adjustPower(-2);
}
function adjustAngle(d) {
  if (screen !== 'playing' || phase !== 'aim' || turn !== 'player') return;
  player.angle = clamp(player.angle + d, 0, 90);
  updateHUD();
}
function adjustPower(d) {
  if (screen !== 'playing' || phase !== 'aim' || turn !== 'player') return;
  player.power = clamp(player.power + d, 0, 100);
  updateHUD();
}

/* ============================================================ Input: touch buttons */
function holdBtn(btn, fn) {
  fn();
  var iv = setInterval(fn, 80);
  var stop = function () {
    clearInterval(iv);
    btn.removeEventListener('pointerup', stop);
    btn.removeEventListener('pointercancel', stop);
    window.removeEventListener('pointerup', stop);
  };
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  window.addEventListener('pointerup', stop);
}
function bindTouch() {
  var angleBtns = document.querySelectorAll('[data-angle]');
  for (var i = 0; i < angleBtns.length; i++) {
    (function (btn) {
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var d = btn.dataset.angle === 'up' ? 1 : -1;
        holdBtn(btn, function () { adjustAngle(d); });
      });
    })(angleBtns[i]);
  }
  var powerBtns = document.querySelectorAll('[data-power]');
  for (var j = 0; j < powerBtns.length; j++) {
    (function (btn) {
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var d = btn.dataset.power === 'up' ? 2 : -2;
        holdBtn(btn, function () { adjustPower(d); });
      });
    })(powerBtns[j]);
  }
  $('t-fire').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (screen === 'playing' && phase === 'aim' && turn === 'player') fire('player');
  });
}

/* ============================================================ Input: mouse + swipe on canvas */
function bindPointer() {
  canvas.addEventListener('pointerdown', function (e) {
    if (screen !== 'playing' || phase !== 'aim' || turn !== 'player') return;
    pointer.active = true;
    pointer.startX = e.clientX;
    pointer.startY = pointer.lastY = e.clientY;
    pointer.moved = false;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (screen !== 'playing' || phase !== 'aim' || turn !== 'player') return;
    if (e.pointerType === 'mouse') {
      mouseAim(e.clientX, e.clientY);
    } else if (pointer.active) {
      var dy = e.clientY - pointer.lastY;
      if (Math.abs(dy) > 6) {
        adjustAngle(dy < 0 ? 2 : -2);
        pointer.lastY = e.clientY;
        pointer.moved = true;
      }
    }
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!pointer.active) return;
    pointer.active = false;
    var dist = Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY);
    if (!pointer.moved && dist < 10) {
      if (screen === 'playing' && phase === 'aim' && turn === 'player') fire('player');
    }
  });
  canvas.addEventListener('pointercancel', function () { pointer.active = false; });
}
function mouseAim(cx, cy) {
  var t = player;
  if (!t) return;
  var turretY = tankCenterY(t) - TANK_H / 2 - 4;
  if (cy > turretY) return;
  var dx = (cx - t.x) * t.dir;
  if (dx <= 0) return;
  var ang = Math.atan2(turretY - cy, dx) * 180 / Math.PI;
  if (ang >= 0 && ang <= 90) t.angle = ang;
  var dist = Math.abs(cx - t.x);
  t.power = clamp(dist / 5, 0, 100);
  updateHUD();
}

/* ============================================================ UI bindings */
function bindUI() {
  var groups = document.querySelectorAll('.choices');
  for (var i = 0; i < groups.length; i++) {
    (function (group) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('.choice');
        if (!btn) return;
        var all = group.querySelectorAll('.choice');
        for (var k = 0; k < all.length; k++) all[k].classList.remove('active');
        btn.classList.add('active');
      });
    })(groups[i]);
  }
  $('btn-play').addEventListener('click', function () {
    settings.sky = document.querySelector('[data-group="sky"] .choice.active').dataset.value;
    settings.difficulty = document.querySelector('[data-group="difficulty"] .choice.active').dataset.value;
    settings.mode = parseInt(document.querySelector('[data-group="mode"] .choice.active').dataset.value, 10);
    var wpnEl = document.querySelector('[data-group="weapon"] .choice.active');
    if (wpnEl) settings.weapon = wpnEl.dataset.value;
    playerName = ($('name-input').value || '').trim().slice(0, 14);
    saveName(playerName);
    startMatch();
  });
  $('btn-pause').addEventListener('click', showPause);
  $('btn-resume').addEventListener('click', hidePause);
  $('btn-restart-round').addEventListener('click', function () { hidePause(); startRound(); });
  $('btn-home').addEventListener('click', function () { hidePause(); showStart(); });
  $('btn-next-round').addEventListener('click', startRound);
  $('btn-restart-from-round').addEventListener('click', startMatch);
  $('btn-play-again').addEventListener('click', startMatch);
  $('btn-home-end').addEventListener('click', showStart);
}

/* ============================================================ Stars (night) */
function makeStars() {
  stars = [];
  for (var i = 0; i < 70; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.5,
      size: Math.random() < 0.7 ? 1 : 2,
      alpha: 0.3 + Math.random() * 0.6
    });
  }
}

/* ============================================================ Loop */
function loop(now) {
  if (!lastTime) lastTime = now;
  var realDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (screen === 'playing') {
    physAcc += realDt;
    var steps = 0;
    while (physAcc >= PHYS_DT && steps < 5) {
      updatePhysics(PHYS_DT);
      physAcc -= PHYS_DT;
      steps++;
      if (screen !== 'playing') break;
    }
    applyHeldKeys(realDt);
    updateParticles(realDt);
    updateExplosions(realDt);
  } else if (screen === 'start' || screen === 'round-over' || screen === 'match-over') {
    updateParticles(realDt);
    updateExplosions(realDt);
  }
  // paused: freeze everything

  render();
  requestAnimationFrame(loop);
}

/* ============================================================ Init */
function init() {
  makeStars();
  resize();
  bindUI();
  bindKeyboard();
  bindTouch();
  bindPointer();
  window.addEventListener('resize', resize);
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  playerName = loadName();
  showStart();
  requestAnimationFrame(loop);
}
init();

})();
