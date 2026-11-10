# 浮空岛快递 · Sky Courier

驾驶珊瑚橙小飞机，在明亮高饱和的天空与白云之间穿越漂浮小岛，完成五份天空快递订单。
卡通低多边形风格，Three.js 实现，桌面与移动端皆可玩。

在线试玩：<https://yjj0339.github.io/sky-courier/>

---

## 玩法

| 操作 | 按键 |
| --- | --- |
| 上升 / 下降 | `W` / `S`（方向键 `↑` / `↓` 同样可用） |
| 左右转向 | `A` / `D`（方向键 `←` / `→` 同样可用） |
| 加速推进 | `Space` |
| 暂停 | `Esc` / `P` |
| 重新开始 | `R` |

移动端：左半屏拖拽出现虚拟摇杆（上下＝升降，左右＝转向），右下角圆形按钮＝加速。

### 三种任务

- **自由飞行** —— 没有订单也没有终点，穿过金色风环刷新飞行纪录。
- **风环冲刺** —— 限时 60 秒，沿环道连穿 14 个风环，连击越高中分越高。
- **天空快递订单** —— 五份包裹，按路线依次送达五座浮空岛。跟着金色风环走，进入目标岛上方的金色光环即完成送达。

穿过风环会触发冲刺加速并补充推进能量；撞上浮空岛会掉速扣分。

### 界面

- 航线徽章显示 `天空邮局 · 第 7 航线` 与当前进度。
- 三个模式各自记录最高分，保存在浏览器 `localStorage`（`skyCourier.best.*`）。
- 音效开关与中英文切换，偏好同样保存在本地。

---

## 本地运行

```bash
npm install          # 只为拿 three 源码，运行时用的是仓库内置的 vendor/
npm start            # 启动本地静态服务 -> http://localhost:8189
```

> 必须通过 HTTP 服务访问（ES Module + `importmap` 无法用 `file://` 打开）。

---

## 目录结构

```
index.html                页面骨架 / 开始界面 / HUD
styles.css                浅色系界面样式
serve.js                  本地静态服务器
src/
  main.js                 主循环、模式管理、计分、界面联动
  world.js                天空穹顶、白云、浮空岛、树木房屋、金色光环
  plane.js                飞行物理、追尾镜头、推进尾迹
  input.js                键盘 + 触屏摇杆
  hud.js                  HUD、小地图、目标指向
  audio.js                Web Audio 合成音效（无外部音频文件）
  i18n.js                 中英文文案
assets/models/
  coral-plane.glb         飞机模型包（随源码附带，运行时本地加载）
vendor/                   Three.js r187 + GLTFLoader（本地内置，无 CDN 依赖）
tools/
  build-plane-model.mjs   重新生成飞机模型包
  verify-model.mjs        校验 .glb 结构完整性
  check-syntax.mjs        ES Module 语法自检
qa/
  model-preview.html      飞机模型 3/4 视角预览页
```

### 飞机模型包

`assets/models/coral-plane.glb` 是自带的本地模型，由 `tools/build-plane-model.mjs` 生成：
锥形机身、后掠主翼、白翼尖、座舱风挡、竖直尾翼 + 青绿小旗、机背快递包裹，以及独立节点的可旋转螺旋桨。
节点结构为 `CoralPlane → { Body, Cargo, Propeller }`，游戏运行时用 `Cargo` 的显隐表示包裹是否在机上，
用 `Propeller` 的旋转表现引擎。

修改模型后重新生成并校验：

```bash
npm run build:model
npm run verify:model
```

---

## 技术要点

- **Three.js r187**，以 ES Module + `importmap` 方式本地引入，不依赖任何 CDN。
- 浮空岛几何体按材质合并（顶点色 + 平面着色），整座岛只占一个 draw call；白云用 `InstancedMesh`。
- 天空是自定义 `ShaderMaterial` 渐变穹顶，带太阳光晕，随相机移动。
- 风环判定用「上一帧位置 → 当前帧位置」的线段采样，避免高速穿模漏检。
- 渲染使用 `NeutralToneMapping` 保住卡通配色的高饱和度。
- 移动端自动降低阴影分辨率、关闭抗锯齿、降低像素比，并启用虚拟摇杆。

---

## 许可

MIT
