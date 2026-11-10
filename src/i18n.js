/**
 * 浮空岛快递 · 中英文文案
 */

const DICT = {
  zh: {
    'hud.post': '天空邮局',
    'hud.route': '第 7 航线',
    'hud.score': '得分',
    'hud.best': '最高分',
    'hud.orders': '天空快递订单',
    'hud.time': '剩余秒数',
    'hud.speed': '速度',
    'hud.unit': 'km/h',
    'hud.boost': '推进',
    'hud.map': '空域图',
    'hud.rings': '风环',
    'hud.route.orders': '第 7 航线',
    'hud.route.free': '自由巡航',
    'hud.route.sprint': '风环冲刺',

    'touch.boost': '推进',

    'hint.vert': '升降',
    'hint.turn': '转向',
    'hint.boost': '加速',

    'start.badge': '天空邮局 · 第 7 航线',
    'start.title': '浮空岛快递',
    'start.sub': '驾驶珊瑚橙小飞机，穿过云海浮岛，把五份包裹准时送到收件人手里。',
    'start.sound': '音效',
    'start.loading': '正在装载模型包…',
    'start.ready': '模型包就绪，选择一项任务起飞吧',

    'mode.free.name': '自由飞行',
    'mode.free.desc': '没有订单，没有终点。穿过金色风环刷新你的飞行纪录。',
    'mode.sprint.name': '风环冲刺',
    'mode.sprint.desc': '限时 60 秒，连穿风环不断加速。每多一个风环，分数就翻一截。',
    'mode.orders.name': '天空快递订单',
    'mode.orders.desc': '五份订单，按路线依次送达五座浮空岛。跟着金色风环走，不会迷路。',
    'mode.best': '最高分',

    'pause.title': '已暂停',
    'pause.resume': '继续飞行',
    'pause.restart': '重新开始',
    'pause.end': '结束并记录成绩',
    'pause.menu': '返回主菜单',

    'result.title': '本次成绩',
    'result.again': '再来一次',
    'result.newBest': '★ 新纪录！',
    'result.rings': '穿过风环',
    'result.delivered': '送达订单',
    'result.distance': '飞行距离',
    'result.freeEnd': '自由飞行结束',
    'result.sprintEnd': '时间到',
    'result.ordersEnd': '全部送达！',
    'result.ordersFail': '任务结束',

    'toast.ring': '风环 +{n}',
    'toast.combo': '连击 ×{n}！',
    'toast.deliver': '送达！+{n}',
    'toast.newOrder': '新订单：{name}',
    'toast.crash': '撞上浮空岛！',
    'toast.allDone': '五份订单全部送达！',
    'toast.pickup': '已取件：{name}',
    'toast.boostReady': '推进已充满',

    'order.state.pending': '待送达',
    'order.state.active': '运送中',
    'order.state.done': '已送达',

    'mode.tag.free': '自由飞行',
    'mode.tag.sprint': '风环冲刺',
    'mode.tag.orders': '快递订单',

    'lang.name': 'English',
  },

  en: {
    'hud.post': 'Sky Post Office',
    'hud.route': 'Route 7',
    'hud.score': 'Score',
    'hud.best': 'Best',
    'hud.orders': 'Courier Orders',
    'hud.time': 'Seconds left',
    'hud.speed': 'Speed',
    'hud.unit': 'km/h',
    'hud.boost': 'Boost',
    'hud.map': 'Airspace',
    'hud.rings': 'Rings',
    'hud.route.orders': 'Route 7',
    'hud.route.free': 'Open Cruise',
    'hud.route.sprint': 'Ring Sprint',

    'touch.boost': 'BOOST',

    'hint.vert': 'Climb',
    'hint.turn': 'Turn',
    'hint.boost': 'Boost',

    'start.badge': 'Sky Post Office · Route 7',
    'start.title': 'Sky Courier',
    'start.sub': 'Fly your coral-orange courier plane through a sea of clouds and floating islands, and deliver five parcels on time.',
    'start.sound': 'Sound',
    'start.loading': 'Loading model pack…',
    'start.ready': 'Model pack ready — pick a mission and take off',

    'mode.free.name': 'Free Flight',
    'mode.free.desc': 'No orders, no finish line. Thread the golden wind rings and top your flight record.',
    'mode.sprint.name': 'Ring Sprint',
    'mode.sprint.desc': '60 seconds on the clock. Chain wind rings for speed — every extra ring multiplies your score.',
    'mode.orders.name': 'Courier Orders',
    'mode.orders.desc': 'Five parcels, delivered in order to five floating islands. Follow the golden rings and never get lost.',
    'mode.best': 'Best',

    'pause.title': 'Paused',
    'pause.resume': 'Resume flight',
    'pause.restart': 'Restart',
    'pause.end': 'End & record score',
    'pause.menu': 'Main Menu',

    'result.title': 'Result',
    'result.again': 'Play again',
    'result.newBest': '★ New record!',
    'result.rings': 'Rings threaded',
    'result.delivered': 'Orders delivered',
    'result.distance': 'Distance flown',
    'result.freeEnd': 'Free flight complete',
    'result.sprintEnd': "Time's up",
    'result.ordersEnd': 'All delivered!',
    'result.ordersFail': 'Run ended',

    'toast.ring': 'Ring +{n}',
    'toast.combo': 'Combo ×{n}!',
    'toast.deliver': 'Delivered! +{n}',
    'toast.newOrder': 'New order: {name}',
    'toast.crash': 'Island collision!',
    'toast.allDone': 'All five orders delivered!',
    'toast.pickup': 'Parcel loaded: {name}',
    'toast.boostReady': 'Boost recharged',

    'order.state.pending': 'Pending',
    'order.state.active': 'In transit',
    'order.state.done': 'Delivered',

    'mode.tag.free': 'Free Flight',
    'mode.tag.sprint': 'Ring Sprint',
    'mode.tag.orders': 'Courier Orders',

    'lang.name': '中文',
  },
};

const STORE_KEY = 'skyCourier.lang';

export const i18n = {
  lang: 'zh',

  init() {
    let saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (_) { saved = null; }
    const nav = (navigator.language || 'zh').toLowerCase();
    this.lang = saved === 'zh' || saved === 'en' ? saved : (nav.startsWith('zh') ? 'zh' : 'en');
    return this.lang;
  },

  setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    this.lang = lang;
    try { localStorage.setItem(STORE_KEY, lang); } catch (_) { /* 隐私模式忽略 */ }
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    this.apply();
  },

  toggle() {
    this.setLang(this.lang === 'zh' ? 'en' : 'zh');
    return this.lang;
  },

  /** 取文案，支持 {name} 占位替换 */
  t(key, vars) {
    const table = DICT[this.lang] || DICT.zh;
    let s = table[key] ?? DICT.zh[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      }
    }
    return s;
  },

  /** 刷新页面内所有 data-i18n 节点 */
  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = this.t(el.dataset.i18n);
      if (el.dataset.i18nHtml === '1') el.innerHTML = v;
      else el.textContent = v;
    });
  },
};

/** 岛屿名等专有名词 */
export const NAMES = {
  post: { zh: '天空邮局', en: 'Sky Post Office' },
  lantern: { zh: '灯塔岛', en: 'Lantern Isle' },
  chime: { zh: '风铃谷', en: 'Chime Valley' },
  marsh: { zh: '棉花糖云', en: 'Marshmallow Cloud' },
  twin: { zh: '双子树', en: 'Twin Tree Isle' },
  rainbow: { zh: '彩虹瀑布台', en: 'Rainbow Falls' },
};

export function nameOf(entry) {
  return i18n.lang === 'en' ? entry.en : entry.zh;
}
