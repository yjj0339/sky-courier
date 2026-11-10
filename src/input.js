/**
 * 浮空岛快递 · 输入
 * 键盘：W/S 升降，A/D 转向，Space 加速，方向键同样可用
 * 触屏：左半屏虚拟摇杆（上下=升降，左右=转向），右下按钮=加速
 */

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'boost',
};

export class Input {
  constructor(opts = {}) {
    this.keys = { up: false, down: false, left: false, right: false, boost: false };
    this.touch = { active: false, pitch: 0, yaw: 0, boost: false };
    this.onPause = opts.onPause || (() => {});
    this.onRestart = opts.onRestart || (() => {});
    this.onFirstGesture = opts.onFirstGesture || (() => {});
    this._gestureDone = false;
    this.isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;

    this._bindKeyboard();
    if (this.isTouch) this._bindTouch(opts.stickEl, opts.knobEl, opts.boostEl);
  }

  _firstGesture() {
    if (this._gestureDone) return;
    this._gestureDone = true;
    this.onFirstGesture();
  }

  _bindKeyboard() {
    const stop = (e) => {
      const action = KEY_MAP[e.code];
      if (action) {
        this.keys[action] = e.type === 'keydown';
        e.preventDefault();
      }
      if (e.type === 'keydown') {
        if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); this.onPause(); }
        if (e.code === 'KeyR') { this.onRestart(); }
        this._firstGesture();
      }
    };

    window.addEventListener('keydown', stop, { passive: false });
    window.addEventListener('keyup', stop, { passive: false });
    window.addEventListener('blur', () => {
      for (const k of Object.keys(this.keys)) this.keys[k] = false;
    });
  }

  _bindTouch(stickEl, knobEl, boostEl) {
    if (!stickEl || !knobEl) return;
    const MAX = 52;
    let stickId = null;
    let originX = 0, originY = 0;

    const setKnob = (dx, dy) => {
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const start = (e) => {
      if (stickId !== null) return;
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.55) continue;
        stickId = t.identifier;
        originX = t.clientX;
        originY = t.clientY;
        stickEl.style.left = `${originX}px`;
        stickEl.style.bottom = 'auto';
        stickEl.style.top = `${originY}px`;
        stickEl.classList.add('active');
        this.touch.active = true;
        this._firstGesture();
        break;
      }
    };

    const move = (e) => {
      if (stickId === null) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        let dx = t.clientX - originX;
        let dy = t.clientY - originY;
        const len = Math.hypot(dx, dy);
        if (len > MAX) { dx = (dx / len) * MAX; dy = (dy / len) * MAX; }
        setKnob(dx, dy);
        this.touch.yaw = -dx / MAX;       // 右滑 = 右转
        this.touch.pitch = -dy / MAX;     // 上滑 = 爬升
      }
    };

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        stickId = null;
        this.touch.active = false;
        this.touch.pitch = 0;
        this.touch.yaw = 0;
        setKnob(0, 0);
        stickEl.classList.remove('active');
      }
    };

    const layer = stickEl.closest('.touch-layer') || document.body;
    layer.addEventListener('touchstart', start, { passive: true });
    layer.addEventListener('touchmove', move, { passive: false });
    layer.addEventListener('touchend', end, { passive: true });
    layer.addEventListener('touchcancel', end, { passive: true });

    if (boostEl) {
      const on = (e) => { e.preventDefault(); this.touch.boost = true; this._firstGesture(); };
      const off = (e) => { e.preventDefault(); this.touch.boost = false; };
      boostEl.addEventListener('touchstart', on, { passive: false });
      boostEl.addEventListener('touchend', off, { passive: false });
      boostEl.addEventListener('touchcancel', off, { passive: false });
      // 鼠标也能按住（桌面端调试/触屏笔记本）
      boostEl.addEventListener('mousedown', on);
      window.addEventListener('mouseup', off);
    }
  }

  /** 合并后的控制量 */
  read() {
    const k = this.keys;
    const t = this.touch;
    let pitch = 0, yaw = 0;
    if (k.up) pitch += 1;
    if (k.down) pitch -= 1;
    if (k.left) yaw += 1;
    if (k.right) yaw -= 1;
    pitch += t.pitch;
    yaw += t.yaw;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      yaw: Math.max(-1, Math.min(1, yaw)),
      boost: k.boost || t.boost,
    };
  }
}
