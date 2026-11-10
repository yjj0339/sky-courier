/**
 * 浮空岛快递 · 主程序
 * 模式管理 / 计分 / 渲染循环 / 界面联动
 */
import * as THREE from 'three';
import { World, ORDER_TARGETS } from './world.js';
import { Plane, ChaseCamera, BoostTrail, FLIGHT } from './plane.js';
import { Input } from './input.js';
import { HUD, computeTarget } from './hud.js';
import { i18n, nameOf } from './i18n.js';
import { audio } from './audio.js';

/* ───────────────────────── 常量 ───────────────────────── */
const BEST_KEY = {
  free: 'skyCourier.best.free',
  sprint: 'skyCourier.best.sprint',
  orders: 'skyCourier.best.orders',
};
const SPRINT_SECONDS = 60;
const MODE_TITLE = {
  free: 'result.freeEnd',
  sprint: 'result.sprintEnd',
  orders: 'result.ordersEnd',
};

const $ = (id) => document.getElementById(id);

/* ───────────────────────── 渲染器 ───────────────────────── */
const canvas = $('scene');
const isMobile = matchMedia('(hover: none) and (pointer: coarse)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color('#a9e4ff'), 320, 900);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 2000);
camera.position.set(0, 24, 60);

/* ───────────────────────── 世界 / 玩家 ───────────────────────── */
const world = new World(scene, { shadows: !isMobile, shadowSize: isMobile ? 512 : 1024 }).build();
const plane = new Plane(scene);
const chase = new ChaseCamera(camera);
const trail = new BoostTrail(scene, isMobile ? 34 : 60);
const hud = new HUD(world);

/* ───────────────────────── 游戏状态 ───────────────────────── */
const game = {
  mode: 'free',
  running: false,
  paused: false,
  score: 0,
  best: 0,
  combo: 0,
  comboTimer: 0,
  rings: 0,
  distance: 0,
  elapsed: 0,
  orderIndex: 0,
  orderStates: [],
  delivered: 0,
  ringsByKind: { free: 0, sprint: 0, route: 0 },
  timer: null,
};

function loadBest(mode) {
  try {
    const v = parseInt(localStorage.getItem(BEST_KEY[mode]) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch (_) { return 0; }
}
function saveBest(mode, value) {
  try { localStorage.setItem(BEST_KEY[mode], String(Math.floor(value))); } catch (_) { /* 忽略 */ }
}

function refreshBestLabels() {
  for (const mode of Object.keys(BEST_KEY)) {
    const el = document.querySelector(`[data-best="${mode}"]`);
    if (el) el.textContent = loadBest(mode).toLocaleString();
  }
}

/* ───────────────────────── 界面元素 ───────────────────────── */
const ui = {
  start: $('start'),
  pause: $('pause'),
  result: $('result'),
  loadingNote: $('loadingNote'),
  soundBtn: $('soundBtn'),
  soundIcon: $('soundIcon'),
  langBtn: $('langBtn'),
  langLabel: $('langLabel'),
  pauseBtn: $('pauseBtn'),
  resumeBtn: $('resumeBtn'),
  restartBtn: $('restartBtn'),
  menuBtn: $('menuBtn'),
  endBtn: $('endBtn'),
  againBtn: $('againBtn'),
  resultMenuBtn: $('resultMenuBtn'),
  resultTitle: $('resultTitle'),
  resultScore: $('resultScore'),
  resultBest: $('resultBest'),
  resultStats: $('resultStats'),
  pauseScore: $('pauseScore'),
  pauseBest: $('pauseBest'),
  boostBtn: $('boostBtn'),
};

/* ───────────────────────── 模式逻辑 ───────────────────────── */
function ringFilter() {
  if (game.mode === 'sprint') return (r) => r.kind === 'sprint';
  if (game.mode === 'orders') return (r) => r.kind === 'route' && r.leg === game.orderIndex;
  return (r) => r.kind === 'free' || r.kind === 'route';
}

/** 航线进度条的数据（不同模式展示不同含义） */
function routeInfo() {
  const byKind = game.ringsByKind || { free: 0, sprint: 0, route: 0 };
  if (game.mode === 'orders') {
    return { current: game.delivered, total: ORDER_TARGETS.length };
  }
  if (game.mode === 'sprint') {
    return {
      current: byKind.sprint || 0,
      total: world.sprintRings.length,
      label: i18n.t('hud.rings'),
    };
  }
  return {
    current: (byKind.free || 0) + (byKind.route || 0),
    total: world.freeRings.length + world.routeRings.length,
    label: i18n.t('hud.rings'),
  };
}

function resetMode(mode) {
  game.mode = mode;
  game.score = 0;
  game.best = loadBest(mode);
  game.combo = 0;
  game.comboTimer = 0;
  game.rings = 0;
  game.distance = 0;
  game.elapsed = 0;
  game.delivered = 0;
  game.orderIndex = 0;
  game.ringsByKind = { free: 0, sprint: 0, route: 0 };
  game.timer = mode === 'sprint' ? SPRINT_SECONDS : null;

  world.resetRings(null);
  world.setActiveDelivery(null);

  const post = world.islands.get('post');
  const first = mode === 'orders' ? world.islands.get(ORDER_TARGETS[0]) : null;

  if (mode === 'orders') {
    game.orderStates = ORDER_TARGETS.map(() => 'pending');
    game.orderStates[0] = 'active';
    world.setActiveDelivery(ORDER_TARGETS[0]);
    plane.reloadCargo();
    // 朝第一目标的方向起飞
    const yaw = Math.atan2(
      -(first.center.x - post.center.x),
      -(first.center.z - post.center.z),
    );
    plane.reset(new THREE.Vector3(post.center.x, post.topY + 16, post.center.z + 34), yaw);
  } else if (mode === 'sprint') {
    // 从第一个冲刺风环的后方切入，正对环道方向
    const first = world.sprintRings[0];
    const back = first.center.clone().addScaledVector(first.normal, -24);
    plane.reset(back, Math.atan2(-first.normal.x, -first.normal.z));
  } else {
    plane.reset(new THREE.Vector3(0, 26, 60), Math.PI);
  }

  hud.buildOrders(ORDER_TARGETS);
  hud.setOrderStates(game.orderStates);
  hud.setMode(mode);
  hud.el.orderList.hidden = mode !== 'orders';

  chase._init = false;
  game.running = true;
  game.paused = false;
  hud.show();
  hud.setTouchVisible(input.isTouch);
}

/* ───────────────────────── 流程控制 ───────────────────────── */
function startMode(mode) {
  audio.unlock();
  audio.startEngine();
  ui.start.classList.add('fade-out');
  setTimeout(() => {
    ui.start.hidden = true;
    ui.start.classList.remove('fade-out');
  }, 340);
  ui.result.hidden = true;
  ui.pause.hidden = true;
  resetMode(mode);
}

function toMenu() {
  game.running = false;
  game.paused = false;
  audio.stopEngine();
  hud.hide();
  ui.pause.hidden = true;
  ui.result.hidden = true;
  ui.start.hidden = false;
  ui.start.classList.remove('fade-out');
  refreshBestLabels();
  ui.loadingNote.textContent = i18n.t('start.ready');
}

function pauseGame() {
  if (!game.running || game.paused) return;
  game.paused = true;
  ui.pauseScore.textContent = Math.floor(game.score).toLocaleString();
  ui.pauseBest.textContent = Math.floor(game.best).toLocaleString();
  ui.pause.hidden = false;
  audio.click();
}

function resumeGame() {
  game.paused = false;
  ui.pause.hidden = true;
  audio.click();
}

function finishRun(reasonKey) {
  if (!game.running) return;
  game.running = false;

  // 结算加成
  if (game.mode === 'sprint') {
    game.score += Math.floor(Math.max(0, game.timer || 0) * 20);
  }
  if (game.mode === 'orders' && game.delivered >= ORDER_TARGETS.length) {
    game.score += 2500;
    game.score += Math.floor(Math.max(0, 480 - game.elapsed) * 8);
  }

  const isBest = game.score > game.best;
  if (isBest) {
    game.best = game.score;
    saveBest(game.mode, game.best);
    refreshBestLabels();
  }

  // 标题：订单模式要区分「全部送达」与「中途结束」
  let titleKey = reasonKey;
  if (!titleKey) {
    if (game.mode === 'orders') {
      titleKey = game.delivered >= ORDER_TARGETS.length ? 'result.ordersEnd' : 'result.ordersFail';
    } else {
      titleKey = MODE_TITLE[game.mode];
    }
  }

  ui.resultTitle.textContent = i18n.t(titleKey);
  ui.resultScore.textContent = Math.floor(game.score).toLocaleString();
  ui.resultBest.textContent = isBest ? i18n.t('result.newBest') : '';
  ui.resultStats.innerHTML = this_stat_html();
  ui.result.hidden = false;
  audio.stopEngine();
}

function this_stat_html() {
  const stats = [];
  stats.push(`<div><span>${i18n.t('result.rings')}</span><b>${game.rings}</b></div>`);
  if (game.mode === 'orders') {
    stats.push(`<div><span>${i18n.t('result.delivered')}</span><b>${game.delivered}/${ORDER_TARGETS.length}</b></div>`);
  }
  stats.push(`<div><span>${i18n.t('result.distance')}</span><b>${Math.round(game.distance)}m</b></div>`);
  return stats.join('');
}

/* ───────────────────────── 事件 ───────────────────────── */
function onRingPassed(ring) {
  game.combo = Math.min(10, game.combo + 1);
  game.comboTimer = 4.2;
  game.rings++;
  if (!game.ringsByKind) game.ringsByKind = { free: 0, sprint: 0, route: 0 };
  game.ringsByKind[ring.kind] = (game.ringsByKind[ring.kind] || 0) + 1;
  const pts = 100 * game.combo;
  game.score += pts;
  plane.onRingPassed();
  audio.ring(game.combo);
  hud.toast(
    i18n.t('toast.ring', { n: pts }),
    'gold',
    game.combo > 1 ? i18n.t('toast.combo', { n: game.combo }) : '',
  );
}

function onDelivery(dr) {
  if (game.orderIndex >= ORDER_TARGETS.length) return;
  if (dr.islandId !== ORDER_TARGETS[game.orderIndex]) return;
  const isl = world.islands.get(dr.islandId);

  const idx = game.orderIndex;
  game.orderStates[idx] = 'done';
  game.delivered++;
  game.score += 1000;
  plane.deliverCargo();
  audio.deliver();
  hud.toast(i18n.t('toast.deliver', { n: 1000 }), 'good', nameOf(isl.name));

  game.orderIndex++;
  if (game.orderIndex >= ORDER_TARGETS.length) {
    hud.setOrderStates(game.orderStates);
    hud.toast(i18n.t('toast.allDone'), 'good');
    setTimeout(() => finishRun('result.ordersEnd'), 1100);
    return;
  }
  game.orderStates[game.orderIndex] = 'active';
  world.setActiveDelivery(ORDER_TARGETS[game.orderIndex]);
  hud.setOrderStates(game.orderStates);
  plane.reloadCargo();
  hud.toast(i18n.t('toast.newOrder', { name: nameOf(world.islands.get(ORDER_TARGETS[game.orderIndex]).name) }), '');
}

function onCrash() {
  game.score = Math.max(0, game.score - 60);
  game.combo = 0;
  audio.crash();
  hud.toast(i18n.t('toast.crash'), 'bad');
}

/* ───────────────────────── 输入 ───────────────────────── */
const input = new Input({
  onPause: () => {
    if (!game.running) return;
    if (game.paused) resumeGame(); else pauseGame();
  },
  onRestart: () => {
    if (!game.running) return;
    resetMode(game.mode);
    audio.click();
  },
  onFirstGesture: () => { audio.unlock(); },
  stickEl: $('stick'),
  knobEl: $('stickKnob'),
  boostBtn: $('boostBtn'),
});

/* ───────────────────────── 界面绑定 ───────────────────────── */
document.querySelectorAll('.mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    audio.unlock();
    audio.click();
    startMode(card.dataset.mode);
  });
});

ui.soundBtn.addEventListener('click', () => {
  const on = audio.toggle();
  ui.soundIcon.textContent = on ? '🔊' : '🔇';
  ui.soundBtn.classList.toggle('off', !on);
  if (on) { audio.unlock(); audio.click(); }
});

ui.langBtn.addEventListener('click', () => {
  audio.click();
  const lang = i18n.toggle();
  ui.langLabel.textContent = lang === 'zh' ? '中文' : 'EN';
  i18n.apply();
  hud.refreshOrderNames();
  hud.setOrderStates(game.orderStates);
  refreshBestLabels();
  ui.loadingNote.textContent = i18n.t('start.ready');
});

ui.pauseBtn.addEventListener('click', pauseGame);
ui.resumeBtn.addEventListener('click', resumeGame);
ui.restartBtn.addEventListener('click', () => { resetMode(game.mode); audio.click(); });
ui.menuBtn.addEventListener('click', () => { audio.click(); toMenu(); });
if (ui.endBtn) ui.endBtn.addEventListener('click', () => { audio.click(); finishRun(); });
ui.againBtn.addEventListener('click', () => { audio.click(); startMode(game.mode); });
ui.resultMenuBtn.addEventListener('click', () => { audio.click(); toMenu(); });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.running && !game.paused) pauseGame();
});

/* ───────────────────────── 主循环 ───────────────────────── */
const timer = new THREE.Timer();
const prevPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(0.05, timer.getDelta());

  if (game.running && !game.paused) {
    game.elapsed += dt;
    const inp = input.read();
    prevPos.copy(plane.position);

    const res = plane.update(dt, inp, world);
    if (res.crashed) onCrash();

    // 风环
    const ring = world.checkRingPass(prevPos, plane.position, ringFilter());
    if (ring) onRingPassed(ring);

    // 连击衰减
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) game.combo = 0;
    }

    // 送达
    if (game.mode === 'orders') {
      const dr = world.checkDelivery(plane.position);
      if (dr && dr.islandId === ORDER_TARGETS[game.orderIndex]) onDelivery(dr);
    }

    // 冲刺计时
    if (game.timer !== null) {
      game.timer -= dt;
      if (game.timer <= 0) {
        game.timer = 0;
        finishRun('result.sprintEnd');
      }
    }

    // 距离与飞行得分
    game.distance += plane.speed * dt;
    if (game.mode === 'free') game.score += Math.floor(plane.speed * dt * 0.35);

    // 推进按钮状态
    if (ui.boostBtn) {
      ui.boostBtn.classList.toggle('cooling', plane.boost <= 0.02);
    }
  }

  world.update(dt, camera, plane.position);
  chase.update(dt, plane, plane.boosting ? 1 : 0);
  trail.update(dt, plane, game.running && !game.paused && plane.boosting);

  // HUD
  const targetIsland = game.mode === 'orders' && game.orderIndex < ORDER_TARGETS.length
    ? world.islands.get(ORDER_TARGETS[game.orderIndex])
    : null;
  const target = targetIsland
    ? { name: targetIsland.name, ...computeTarget(plane, targetIsland.center.clone().setY(targetIsland.topY + 9.5)) }
    : null;

  hud.update({
    score: game.score,
    best: game.best,
    speed: plane.speed,
    speedRatio: plane.speedRatio,
    boost: plane.boost,
    route: routeInfo(),
    target,
    timer: game.timer,
  });
  hud.drawMinimap(plane, targetIsland ? targetIsland.id : null);

  audio.updateEngine(plane.speedRatio, plane.boosting ? 1 : 0);
  renderer.render(scene, camera);
}

/* ───────────────────────── 启动 ───────────────────────── */
async function boot() {
  i18n.init();
  i18n.apply();
  ui.soundIcon.textContent = audio.enabled ? '🔊' : '🔇';
  ui.soundBtn.classList.toggle('off', !audio.enabled);
  ui.langLabel.textContent = i18n.lang === 'zh' ? '中文' : 'EN';
  refreshBestLabels();

  try {
    await plane.load();
    ui.loadingNote.textContent = i18n.t('start.ready');
    ui.loadingNote.classList.add('ready');
  } catch (err) {
    console.error('[sky-courier] 模型包加载失败', err);
    ui.loadingNote.textContent = '模型包加载失败，请通过 HTTP 服务访问';
  }

  // 背景演示：主菜单也保持世界在飞
  plane.reset(new THREE.Vector3(0, 34, 96), Math.PI * 0.92);
  chase._init = false;
  animate();
}

boot();
