/**
 * 浮空岛快递 · HUD / 小地图 / 提示
 */
import { i18n, nameOf } from './i18n.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(world) {
    this.world = world;
    this.el = {
      hud: $('hud'),
      score: $('scoreValue'),
      best: $('bestValue'),
      speed: $('speedValue'),
      speedFill: $('speedFill'),
      boostFill: $('boostFill'),
      boostPct: $('boostPct'),
      boostBar: $('boostFill')?.parentElement,
      routeFill: $('routeFill'),
      routeText: $('routeText'),
      routeNo: document.querySelector('.route-no'),
      orderList: $('orderList'),
      orderItems: $('orderItems'),
      targetArrow: $('targetArrow'),
      targetName: $('targetName'),
      targetDist: $('targetDist'),
      arrowSvg: document.querySelector('.arrow-svg'),
      sprintTimer: $('sprintTimer'),
      timerValue: $('timerValue'),
      toastWrap: $('toastWrap'),
      minimap: $('minimap'),
      touchLayer: $('touchLayer'),
    };

    this.miniCtx = this.el.minimap.getContext('2d');
    this._setupMinimapCanvas();
    this._lastToast = 0;
  }

  _setupMinimapCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = 240;
    this.el.minimap.width = size * dpr;
    this.el.minimap.height = size * dpr;
    this.miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.miniSize = size;
  }

  show() { this.el.hud.hidden = false; }
  hide() { this.el.hud.hidden = true; }

  /** 按模式切换航线徽章文案 */
  setMode(mode) {
    const map = {
      orders: 'hud.route.orders',
      free: 'hud.route.free',
      sprint: 'hud.route.sprint',
    };
    this.el.routeNo.textContent = i18n.t(map[mode] || 'hud.route.orders');
  }

  setTouchVisible(v) {
    if (this.el.touchLayer) this.el.touchLayer.hidden = !v;
    this.el.hud.classList.toggle('touch-on', !!v);
  }

  /* ─────────── 订单清单 ─────────── */
  buildOrders(ids) {
    const ul = this.el.orderItems;
    ul.innerHTML = '';
    this.orderEls = ids.map((id, i) => {
      const isl = this.world.islands.get(id);
      const li = document.createElement('li');
      li.className = 'order-item';
      li.innerHTML = `<span class="oi-idx">${i + 1}</span><span class="oi-name">—</span><span class="oi-state"></span>`;
      ul.appendChild(li);
      return { li, name: li.querySelector('.oi-name'), state: li.querySelector('.oi-state'), isl };
    });
    this.refreshOrderNames();
  }

  refreshOrderNames() {
    if (!this.orderEls) return;
    for (const o of this.orderEls) {
      o.name.textContent = nameOf(o.isl.name);
    }
  }

  setOrderStates(states) {
    if (!this.orderEls) return;
    this.orderEls.forEach((o, i) => {
      const st = states[i];
      o.li.className = `order-item ${st === 'done' ? 'done' : st === 'active' ? 'active' : ''}`;
      o.state.textContent = i18n.t(`order.state.${st}`);
    });
  }

  /* ─────────── 每帧刷新 ─────────── */
  update(s) {
    this.el.score.textContent = Math.floor(s.score).toLocaleString();
    this.el.best.textContent = Math.floor(s.best).toLocaleString();

    const kmh = Math.round(s.speed * 3.6);
    this.el.speed.textContent = kmh;
    this.el.speedFill.style.width = `${Math.min(100, s.speedRatio * 100)}%`;

    const bp = Math.round(s.boost * 100);
    this.el.boostFill.style.width = `${bp}%`;
    this.el.boostPct.textContent = `${bp}%`;
    this.el.boostBar.classList.toggle('empty', s.boost <= 0.02);

    if (s.route) {
      const pct = s.route.total > 0 ? (s.route.current / s.route.total) * 100 : 0;
      this.el.routeFill.style.width = `${Math.min(100, pct)}%`;
      this.el.routeText.textContent = s.route.label
        ? `${s.route.label} ${s.route.current} / ${s.route.total}`
        : `${s.route.current} / ${s.route.total}`;
    } else {
      this.el.routeFill.style.width = '0%';
      this.el.routeText.textContent = '—';
    }

    if (s.target) {
      this.el.targetArrow.hidden = false;
      this.el.targetName.textContent = nameOf(s.target.name);
      this.el.targetDist.textContent = `${Math.round(s.target.distance)} m`;
      this.el.arrowSvg.style.transform = `rotate(${s.target.angle}deg)`;
    } else {
      this.el.targetArrow.hidden = true;
    }

    if (s.timer !== undefined && s.timer !== null) {
      this.el.sprintTimer.hidden = false;
      this.el.timerValue.textContent = Math.max(0, s.timer).toFixed(1);
      this.el.sprintTimer.classList.toggle('urgent', s.timer <= 10);
    } else {
      this.el.sprintTimer.hidden = true;
    }
  }

  /* ─────────── 提示气泡 ─────────── */
  toast(text, kind = '', sub = '') {
    const now = performance.now();
    if (now - this._lastToast < 90) return;
    this._lastToast = now;
    const div = document.createElement('div');
    div.className = `toast ${kind}`;
    div.innerHTML = sub
      ? `${escapeHtml(text)}<span class="t-sub">${escapeHtml(sub)}</span>`
      : escapeHtml(text);
    this.el.toastWrap.appendChild(div);
    setTimeout(() => div.remove(), 1600);
  }

  /* ─────────── 小地图 ─────────── */
  drawMinimap(plane, targetId) {
    const ctx = this.miniCtx;
    const S = this.miniSize;
    const cx = S / 2, cy = S / 2;
    const R = S * 0.46;
    const SCALE = R / 330;

    ctx.clearRect(0, 0, S, S);

    // 底盘
    const grad = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.1, cx, cy, R);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(219,238,252,0.85)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(35,48,74,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 网格
    ctx.strokeStyle = 'rgba(35,48,74,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const rr = (R / 3) * i;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    const px = plane.position.x * SCALE;
    const pz = plane.position.z * SCALE;

    // 风环
    ctx.fillStyle = 'rgba(240,169,46,0.75)';
    for (const ring of this.world.rings) {
      if (ring.passed) continue;
      if (ring.kind === 'route' && ring.leg > 0) continue;
      const rx = ring.center.x * SCALE;
      const rz = ring.center.z * SCALE;
      if (Math.hypot(rx, rz) > R - 3) continue;
      ctx.beginPath();
      ctx.arc(cx + rx, cy + rz, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 岛屿
    for (const isl of this.world.islands.values()) {
      const ix = isl.center.x * SCALE;
      const iz = isl.center.z * SCALE;
      const isTarget = isl.id === targetId;
      const isBase = isl.id === 'post';
      ctx.beginPath();
      ctx.arc(cx + ix, cy + iz, isTarget ? 5.4 : 3.6, 0, Math.PI * 2);
      ctx.fillStyle = isTarget ? '#e2542c' : isBase ? '#f0a92e' : 'rgba(60,86,120,0.55)';
      ctx.fill();
      if (isTarget) {
        ctx.strokeStyle = 'rgba(226,84,44,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + ix, cy + iz, 9.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 玩家
    const heading = plane.yaw;
    ctx.save();
    ctx.translate(cx + px, cy + pz);
    ctx.rotate(-heading);
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3.2);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ff7a4d';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** 计算目标方向（屏幕角度，度）与距离 */
export function computeTarget(plane, targetPos) {
  const dx = targetPos.x - plane.position.x;
  const dz = targetPos.z - plane.position.z;
  const dist = plane.position.distanceTo(targetPos);
  const fx = plane.forward.x, fz = plane.forward.z;
  const flen = Math.hypot(fx, fz) || 1;
  const ux = fx / flen, uz = fz / flen;
  const vlen = Math.hypot(dx, dz) || 1;
  const vx = dx / vlen, vz = dz / vlen;
  const ang = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
  return { angle: (ang * 180) / Math.PI, distance: dist };
}
