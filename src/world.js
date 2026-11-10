/**
 * 浮空岛快递 · 世界构建
 * 渐变天空穹顶 / 卡通白云 / 锥形浮空岛 + 树木房屋 / 金色光环检查点
 */
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { NAMES } from './i18n.js';

/* ───────────────────────── 调色板 ───────────────────────── */
const C = {
  skyTop: '#1290ee',
  skyHorizon: '#a9e4ff',
  skyLow: '#dff3ff',
  sun: '#fff6d8',
  cloud: '#ffffff',
  cloudShade: '#dceeff',

  grass: '#63c95c',
  grassDark: '#4aa84a',
  grassLight: '#8ede72',
  rock: '#c99668',
  rockDark: '#a9744a',
  rockLight: '#dcaa7c',

  trunk: '#8a5a3b',
  leaf: '#3fae5a',
  leafAlt: '#2f9d8f',
  leafGold: '#e8c34a',

  wall: '#fff3e0',
  wallWarm: '#ffd9b0',
  roof: '#e2542c',
  roofAlt: '#3aa0c8',
  door: '#8a5a3b',
  window: '#ffd86b',

  gold: '#ffc24a',
  goldDark: '#c9871a',
  post: '#e2542c',
};

/* ───────────────────────── 岛屿定义 ───────────────────────── */
export const ISLAND_DEFS = [
  { id: 'post',    name: NAMES.post,    pos: [0, 0, 0],        r: 17, h: 19, kind: 'post',   seed: 11 },
  { id: 'lantern', name: NAMES.lantern, pos: [-120, 26, -100], r: 13, h: 15, kind: 'house',  seed: 23 },
  { id: 'chime',   name: NAMES.chime,   pos: [70, 40, -172],  r: 15, h: 17, kind: 'house',  seed: 37 },
  { id: 'marsh',   name: NAMES.marsh,   pos: [186, 14, -48],  r: 14, h: 16, kind: 'house',  seed: 41 },
  { id: 'twin',    name: NAMES.twin,    pos: [-78, 60, 132],  r: 13, h: 14, kind: 'house',  seed: 53 },
  { id: 'rainbow', name: NAMES.rainbow, pos: [150, 76, 152],  r: 16, h: 20, kind: 'house',  seed: 67 },

  { id: 'd1', name: { zh: '西风礁', en: 'Westwind Reef' }, pos: [-212, -14, 42], r: 11, h: 13, kind: 'plain', seed: 71 },
  { id: 'd2', name: { zh: '望星台', en: 'Stargazer' },    pos: [58, 94, -272],  r: 12, h: 15, kind: 'plain', seed: 79 },
  { id: 'd3', name: { zh: '云絮洲', en: 'Cirrus Islet' }, pos: [-158, 44, -232], r: 10, h: 12, kind: 'plain', seed: 83 },
  { id: 'd4', name: { zh: '东港', en: 'Eastport' },      pos: [252, 50, 92],   r: 12, h: 15, kind: 'plain', seed: 89 },
  { id: 'd5', name: { zh: '暖流滩', en: 'Warm Shallows' }, pos: [26, -20, 252], r: 11, h: 13, kind: 'plain', seed: 97 },
  { id: 'd6', name: { zh: '老风车', en: 'Old Mill' },     pos: [-126, 34, 252], r: 12, h: 14, kind: 'plain', seed: 101 },
];

/** 五份订单的目标顺序 */
export const ORDER_TARGETS = ['lantern', 'chime', 'marsh', 'twin', 'rainbow'];

/* ───────────────────────── 工具 ───────────────────────── */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 运行时生成的径向光晕贴图 */
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, 'rgba(255,220,140,0.55)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 把若干带颜色的几何体合并为一个（顶点色 + 平面着色）
 * parts: [{ geo, color, matrix }]
 */
function mergeColored(parts) {
  const geos = [];
  for (const { geo, color, matrix } of parts) {
    let g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    g.deleteAttribute('uv');
    // 多面体（二十面体/十二面体）是非索引的，而基本体是索引的 —— 统一转成非索引
    if (g.index) {
      const flat = g.toNonIndexed();
      g.dispose();
      g = flat;
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

function mat4(pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  );
  return m;
}

/* ───────────────────────── 树木 / 房屋 零件 ───────────────────────── */
function treeParts(rand, x, z, scale = 1) {
  const parts = [];
  const trunkH = 2.2 * scale;
  parts.push({
    geo: new THREE.CylinderGeometry(0.3 * scale, 0.42 * scale, trunkH, 6),
    color: C.trunk,
    matrix: mat4([x, trunkH / 2, z]),
  });
  const kind = rand();
  if (kind < 0.5) {
    // 松塔
    const h = 4.4 * scale;
    parts.push({
      geo: new THREE.ConeGeometry(2.0 * scale, h, 7),
      color: C.leaf,
      matrix: mat4([x, trunkH + h / 2 - 0.4, z]),
    });
    parts.push({
      geo: new THREE.ConeGeometry(1.45 * scale, h * 0.62, 7),
      color: C.leafGold,
      matrix: mat4([x, trunkH + h * 0.82, z]),
    });
  } else if (kind < 0.82) {
    // 圆冠树
    parts.push({
      geo: new THREE.IcosahedronGeometry(1.9 * scale, 0),
      color: C.leafAlt,
      matrix: mat4([x, trunkH + 1.5 * scale, z]),
    });
    parts.push({
      geo: new THREE.IcosahedronGeometry(1.3 * scale, 0),
      color: C.leaf,
      matrix: mat4([x + 0.8 * scale, trunkH + 2.4 * scale, z - 0.5 * scale]),
    });
  } else {
    // 金色秋树
    parts.push({
      geo: new THREE.IcosahedronGeometry(2.0 * scale, 0),
      color: C.leafGold,
      matrix: mat4([x, trunkH + 1.6 * scale, z]),
    });
  }
  return parts;
}

function houseParts(rand, x, z, y, scale = 1, roofColor = C.roof) {
  const solid = [];
  const glow = [];
  const w = 4.2 * scale, h = 3.4 * scale, d = 4.0 * scale;

  solid.push({
    geo: new THREE.BoxGeometry(w, h, d),
    color: C.wall,
    matrix: mat4([x, y + h / 2, z]),
  });
  // 四坡屋顶
  solid.push({
    geo: new THREE.ConeGeometry(w * 0.82, 2.5 * scale, 4),
    color: roofColor,
    matrix: mat4([x, y + h + 1.25 * scale, z], [0, Math.PI / 4, 0]),
  });
  // 门
  solid.push({
    geo: new THREE.BoxGeometry(1.0 * scale, 1.8 * scale, 0.22 * scale),
    color: C.door,
    matrix: mat4([x, y + 0.9 * scale, z + d / 2 + 0.02]),
  });
  // 窗（发光）
  const wr = 0.55 * scale;
  for (const sx of [-1, 1]) {
    glow.push({
      geo: new THREE.BoxGeometry(wr, wr, 0.16 * scale),
      color: C.window,
      matrix: mat4([x + sx * w * 0.29, y + h * 0.62, z + d / 2 + 0.03]),
    });
    glow.push({
      geo: new THREE.BoxGeometry(0.16 * scale, wr, wr),
      color: C.window,
      matrix: mat4([x + w / 2 + 0.03, y + h * 0.62, z + sx * d * 0.26]),
    });
  }
  // 烟囱
  solid.push({
    geo: new THREE.BoxGeometry(0.7 * scale, 1.5 * scale, 0.7 * scale),
    color: C.rockDark,
    matrix: mat4([x + w * 0.24, y + h + 1.5 * scale, z - d * 0.2]),
  });
  return { solid, glow };
}

function postOfficeParts(rand, x, z, y, scale = 1) {
  const solid = [];
  const glow = [];
  const w = 7.0 * scale, h = 4.4 * scale, d = 5.4 * scale;

  solid.push({
    geo: new THREE.BoxGeometry(w, h, d),
    color: C.wallWarm,
    matrix: mat4([x, y + h / 2, z]),
  });
  solid.push({
    geo: new THREE.ConeGeometry(w * 0.66, 2.8 * scale, 4),
    color: C.roof,
    matrix: mat4([x, y + h + 1.4 * scale, z], [0, Math.PI / 4, 0]),
  });
  // 门廊
  solid.push({
    geo: new THREE.BoxGeometry(2.4 * scale, 2.6 * scale, 0.3 * scale),
    color: C.roofAlt,
    matrix: mat4([x, y + 1.3 * scale, z + d / 2 + 0.12]),
  });
  solid.push({
    geo: new THREE.BoxGeometry(3.2 * scale, 0.22 * scale, 1.3 * scale),
    color: C.roofAlt,
    matrix: mat4([x, y + 2.7 * scale, z + d / 2 + 0.5]),
  });
  // 窗户
  for (const sx of [-1, 1]) {
    glow.push({
      geo: new THREE.BoxGeometry(1.0 * scale, 1.0 * scale, 0.18 * scale),
      color: C.window,
      matrix: mat4([x + sx * w * 0.3, y + h * 0.6, z + d / 2 + 0.05]),
    });
  }
  // 邮筒
  for (const sx of [-1, 1]) {
    solid.push({
      geo: new THREE.CylinderGeometry(0.42 * scale, 0.42 * scale, 1.5 * scale, 8),
      color: C.post,
      matrix: mat4([x + sx * (w * 0.5 + 1.5 * scale), y + 0.75 * scale, z + d / 2 + 0.6]),
    });
  }
  // 风向袋杆
  solid.push({
    geo: new THREE.CylinderGeometry(0.14 * scale, 0.14 * scale, 7 * scale, 6),
    color: C.rockDark,
    matrix: mat4([x + w * 0.5 + 1.2 * scale, y + 3.5 * scale, z - d * 0.3]),
  });
  return { solid, glow, windsock: { x: x + w * 0.5 + 1.2 * scale, y: y + 6.8 * scale, z: z - d * 0.3 } };
}

/* ───────────────────────── 世界 ───────────────────────── */
export class World {
  constructor(scene, quality = {}) {
    this.scene = scene;
    this.quality = quality;
    this.islands = new Map();
    this.rings = [];
    this.deliveryRings = [];
    this.time = 0;
    this._glowTex = null;
  }

  build() {
    this._buildSky();
    this._buildLights();
    this._buildClouds();
    this._buildIslands();
    this._buildRings();
    return this;
  }

  /* ── 天空穹顶 ── */
  _buildSky() {
    const geo = new THREE.SphereGeometry(900, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(C.skyTop) },
        horizonColor: { value: new THREE.Color(C.skyHorizon) },
        lowColor: { value: new THREE.Color(C.skyLow) },
        sunColor: { value: new THREE.Color(C.sun) },
        sunDir: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 lowColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(horizonColor, topColor, smoothstep(0.0, 0.40, h));
          col = mix(lowColor, col, smoothstep(-0.5, 0.02, h));
          float sun = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * pow(sun, 420.0) * 2.2;
          col += sunColor * pow(sun, 26.0) * 0.16;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  /* ── 灯光 ── */
  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xd6f0ff, 0xf7e0c0, 2.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4de, 3.1);
    sun.position.set(70, 120, 55);
    sun.castShadow = this.quality.shadows !== false;
    if (sun.castShadow) {
      const size = this.quality.shadowSize || 1024;
      sun.shadow.mapSize.set(size, size);
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 420;
      const s = 95;
      sun.shadow.camera.left = -s;
      sun.shadow.camera.right = s;
      sun.shadow.camera.top = s;
      sun.shadow.camera.bottom = -s;
      sun.shadow.bias = -0.0012;
      sun.shadow.normalBias = 0.6;
    }
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(sun.target);

    // 补光，避免背光面死黑
    const fill = new THREE.DirectionalLight(0xbfe4ff, 1.15);
    fill.position.set(-80, 40, -70);
    this.scene.add(fill);
  }

  /* ── 白云（实例化） ── */
  _buildClouds() {
    const rand = mulberry32(2026);
    const puffs = [];
    const clusters = 34;
    for (let i = 0; i < clusters; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 120 + rand() * 320;
      const cx = Math.cos(a) * rad;
      const cz = Math.sin(a) * rad;
      const cy = -40 + rand() * 210;
      const n = 3 + Math.floor(rand() * 5);
      for (let j = 0; j < n; j++) {
        const s = 6 + rand() * 13;
        puffs.push({
          x: cx + (rand() - 0.5) * 34,
          y: cy + (rand() - 0.5) * 8,
          z: cz + (rand() - 0.5) * 34,
          s,
          sy: 0.52 + rand() * 0.3,
          tint: rand(),
        });
      }
    }
    const geo = new THREE.IcosahedronGeometry(1, 0);
    // three 只有在 vertexColors 开启且几何体带 color 属性时才会把 instanceColor 乘进 diffuse
    const vcount = geo.attributes.position.count;
    const white = new Float32Array(vcount * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(white, 3));
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
    const mesh = new THREE.InstancedMesh(geo, mat, puffs.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    puffs.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.s, p.s * p.sy, p.s);
      dummy.rotation.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.4);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setStyle(p.tint > 0.5 ? C.cloud : C.cloudShade);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    this.clouds = mesh;
    this.scene.add(mesh);
  }

  /* ── 浮空岛 ── */
  _buildIslands() {
    const solidMat = new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0.0,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(C.window),
      emissive: new THREE.Color(C.window),
      emissiveIntensity: 1.5,
      roughness: 0.4,
    });
    this.islandMat = solidMat;
    this.windowMat = glowMat;

    for (const def of ISLAND_DEFS) {
      const rand = mulberry32(def.seed);
      const group = new THREE.Group();
      group.position.set(...def.pos);
      const [px, py, pz] = def.pos;

      const solid = [];
      const glow = [];

      // 岩锥（尖端朝下）
      solid.push({
        geo: new THREE.ConeGeometry(def.r, def.h, 9, 2),
        color: C.rock,
        matrix: mat4([0, -def.h / 2 - 0.7, 0], [Math.PI, 0, 0]),
      });
      // 岩层色带
      solid.push({
        geo: new THREE.ConeGeometry(def.r * 0.62, def.h * 0.5, 9, 1),
        color: C.rockDark,
        matrix: mat4([0, -def.h * 0.62 - 0.7, 0], [Math.PI, 0, 0]),
      });
      // 草地顶层
      solid.push({
        geo: new THREE.CylinderGeometry(def.r * 1.04, def.r * 0.99, 0.8, 9),
        color: C.grass,
        matrix: mat4([0, -0.4, 0]),
      });
      solid.push({
        geo: new THREE.CylinderGeometry(def.r * 1.06, def.r * 1.04, 0.22, 9),
        color: C.grassLight,
        matrix: mat4([0, -0.05, 0]),
      });
      // 岛缘石块
      const rockCount = 4 + Math.floor(rand() * 4);
      for (let i = 0; i < rockCount; i++) {
        const a = rand() * Math.PI * 2;
        const rr = def.r * (0.72 + rand() * 0.2);
        solid.push({
          geo: new THREE.DodecahedronGeometry(0.6 + rand() * 0.9, 0),
          color: rand() > 0.5 ? C.rockLight : C.rock,
          matrix: mat4([Math.cos(a) * rr, -0.4, Math.sin(a) * rr], [rand() * 3, rand() * 3, rand() * 3]),
        });
      }

      // 树木
      const treeCount = def.kind === 'plain' ? 2 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 4);
      for (let i = 0; i < treeCount; i++) {
        const a = rand() * Math.PI * 2;
        const rr = def.r * (0.25 + rand() * 0.62);
        solid.push(...treeParts(rand, Math.cos(a) * rr, Math.sin(a) * rr, 0.85 + rand() * 0.6));
      }

      // 建筑
      if (def.kind === 'post') {
        const p = postOfficeParts(rand, 0, 0, 0, 1);
        solid.push(...p.solid);
        glow.push(...p.glow);
        this.windsock = p.windsock ? new THREE.Vector3(px + p.windsock.x, py + p.windsock.y, pz + p.windsock.z) : null;
      } else if (def.kind === 'house') {
        const h = houseParts(rand, def.r * 0.16, -def.r * 0.12, 0, 1, rand() > 0.5 ? C.roof : C.roofAlt);
        solid.push(...h.solid);
        glow.push(...h.glow);
      }

      // 合并几何，减少 draw call
      if (solid.length) {
        const merged = mergeColored(solid);
        if (merged) {
          const mesh = new THREE.Mesh(merged, solidMat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
        solid.forEach((p) => p.geo.dispose());
      }
      if (glow.length) {
        const merged = mergeColored(glow);
        if (merged) group.add(new THREE.Mesh(merged, glowMat));
        glow.forEach((p) => p.geo.dispose());
      }

      this.scene.add(group);
      this.islands.set(def.id, {
        def,
        group,
        id: def.id,
        name: def.name,
        center: new THREE.Vector3(px, py, pz),
        topY: py,
        radius: def.r * 0.94,
        bottomY: py - def.h - 2.4,
        deliveryRadius: 11,
      });
    }

    // 风向袋（动态）
    if (this.windsock) {
      const g = new THREE.Group();
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 4.2, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xff8a4d, side: THREE.DoubleSide, roughness: 0.7 }),
      );
      cone.rotation.z = -Math.PI / 2;
      cone.position.x = 2.2;
      g.add(cone);
      this.windsockMesh = cone;
      g.position.copy(this.windsock);
      this.scene.add(g);
    }
  }

  /* ── 金色光环 ── */
  _makeRingMaterial() {
    if (!this.ringMat) {
      this.ringMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(C.gold),
        emissive: new THREE.Color(C.gold),
        emissiveIntensity: 0.42,
        metalness: 0.72,
        roughness: 0.26,
      });
      this.ringGlowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(C.gold),
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.ringGeo = new THREE.TorusGeometry(1, 0.048, 8, 40);
      this.ringGlowGeo = new THREE.RingGeometry(0.88, 1.0, 40);
    }
  }

  _addRing(center, normal, radius, kind, meta = {}) {
    this._makeRingMaterial();
    const group = new THREE.Group();

    const torus = new THREE.Mesh(this.ringGeo, this.ringMat);
    torus.scale.setScalar(radius);
    torus.castShadow = false;
    group.add(torus);

    const glow = new THREE.Mesh(this.ringGlowGeo, this.ringGlowMat);
    glow.scale.setScalar(radius);
    group.add(glow);

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.9, 32),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(C.gold), transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    group.add(inner);

    group.position.copy(center);
    group.lookAt(center.clone().add(normal));
    this.scene.add(group);

    const ring = {
      group, torus, glow, inner,
      center: center.clone(),
      normal: normal.clone().normalize(),
      radius,
      kind,
      passed: false,
      ...meta,
    };
    this.rings.push(ring);
    return ring;
  }

  _buildRings() {
    const rand = mulberry32(777);

    // ① 订单航线风环：每一段路线 4 个检查点
    const chain = ['post', ...ORDER_TARGETS];
    this.routeRings = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const a = this.islands.get(chain[i]);
      const b = this.islands.get(chain[i + 1]);
      const start = a.center.clone();
      const end = b.center.clone();
      const dir = end.clone().sub(start);
      const len = dir.length();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const ctrl = start.clone().add(end).multiplyScalar(0.5);
      ctrl.y += len * 0.15 + 14;
      ctrl.add(perp.multiplyScalar(len * 0.11 * (i % 2 === 0 ? 1 : -1)));

      const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
      const count = 4;
      for (let k = 1; k <= count; k++) {
        const t = k / (count + 1);
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t).normalize();
        const r = this._addRing(p, tan, 7.2, 'route', { leg: i, index: k });
        this.routeRings.push(r);
      }
    }

    // ② 冲刺环道：一圈 14 个
    this.sprintRings = [];
    {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.3;
        const rr = 215 + (i % 2 === 0 ? 34 : -22);
        const p = new THREE.Vector3(
          Math.cos(a) * rr,
          24 + Math.sin(a * 2.2) * 42 + (i % 3) * 12,
          Math.sin(a) * rr,
        );
        const tangent = new THREE.Vector3(-Math.sin(a), Math.cos(a * 2.2) * 0.12, Math.cos(a));
        const r = this._addRing(p, tangent.normalize(), 7.6, 'sprint', { index: i });
        this.sprintRings.push(r);
      }
    }

    // ③ 自由飞行散落风环
    this.freeRings = [];
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const rr = 60 + rand() * 240;
      const p = new THREE.Vector3(
        Math.cos(a) * rr,
        -20 + rand() * 130,
        Math.sin(a) * rr,
      );
      const normal = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const r = this._addRing(p, normal, 7.4, 'free', { index: i });
      this.freeRings.push(r);
    }

    // ④ 送达光环：悬停在目标岛上方
    this.deliveryRings = [];
    for (const id of ORDER_TARGETS) {
      const isl = this.islands.get(id);
      const center = isl.center.clone();
      center.y += 9.5;
      const g = new THREE.Group();
      const torus = new THREE.Mesh(this.ringGeo, this.ringMat);
      torus.scale.setScalar(8.4);
      g.add(torus);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(8.2, 36),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(C.gold), transparent: true, opacity: 0.12,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      g.add(inner);
      g.position.copy(center);
      this.scene.add(g);
      this.deliveryRings.push({
        group: g, torus, inner, center,
        islandId: id, radius: 10.5, active: false, spin: Math.random() * Math.PI * 2,
      });
    }
  }

  /* ── 每帧更新 ── */
  update(dt, camera, playerPos) {
    this.time += dt;
    const t = this.time;

    if (this.sky) this.sky.position.copy(camera.position);

    // 云层缓慢漂移
    if (this.clouds) {
      this.clouds.rotation.y += dt * 0.0035;
    }

    // 风环：自转 + 上下浮动
    for (const ring of this.rings) {
      ring.group.rotation.z += dt * 0.55;
      const bob = Math.sin(t * 1.4 + ring.center.x * 0.05) * 0.6;
      ring.group.position.y = ring.center.y + bob;
      ring.glow.material.opacity = 0.1 + Math.sin(t * 2.4 + ring.center.z * 0.03) * 0.05;
    }

    // 送达光环
    for (const dr of this.deliveryRings) {
      dr.spin += dt * 1.1;
      dr.group.rotation.y = dr.spin;
      dr.group.position.y = dr.center.y + Math.sin(t * 1.7 + dr.spin) * 0.8;
      const pulse = dr.active ? 1 : 0.45;
      dr.inner.material.opacity = (0.07 + Math.sin(t * 3) * 0.05) * pulse + 0.04;
      dr.torus.scale.setScalar(8.4 * (dr.active ? 1 + Math.sin(t * 3.4) * 0.03 : 1));
    }

    // 风向袋
    if (this.windsockMesh) {
      this.windsockMesh.rotation.y = Math.sin(t * 1.1) * 0.35 + 0.2;
      this.windsockMesh.rotation.z = -Math.PI / 2 + Math.sin(t * 2.2) * 0.12;
    }

    // 阴影相机跟随玩家
    if (this.sun && playerPos) {
      this.sun.position.set(playerPos.x + 70, playerPos.y + 120, playerPos.z + 55);
      this.sun.target.position.copy(playerPos);
      this.sun.target.updateMatrixWorld();
    }
  }

  /** 检测上一帧到这一帧之间穿过的风环。filter 可以是 kind 数组或 (ring)=>boolean */
  checkRingPass(prevPos, curPos, filter) {
    const seg = curPos.clone().sub(prevPos);
    const dist = seg.length();
    const steps = Math.min(18, Math.max(2, Math.ceil(dist / 1.1)));
    const pt = new THREE.Vector3();
    for (const ring of this.rings) {
      if (ring.passed) continue;
      if (typeof filter === 'function') { if (!filter(ring)) continue; }
      else if (Array.isArray(filter)) { if (!filter.includes(ring.kind)) continue; }
      for (let s = 0; s <= steps; s++) {
        pt.copy(prevPos).addScaledVector(seg, s / steps).sub(ring.center);
        const along = pt.dot(ring.normal);
        if (Math.abs(along) > 1.7) continue;
        const radial = pt.clone().addScaledVector(ring.normal, -along).length();
        if (radial < ring.radius - 0.5) {
          ring.passed = true;
          return ring;
        }
      }
    }
    return null;
  }

  /** 检测是否进入送达区 */
  checkDelivery(pos) {
    for (const dr of this.deliveryRings) {
      if (!dr.active) continue;
      const d = pos.distanceTo(dr.center);
      if (d < dr.radius) return dr;
    }
    return null;
  }

  /** 检测与浮空岛碰撞，返回被撞的岛 */
  checkIslandCollision(pos, margin = 2.4) {
    for (const isl of this.islands.values()) {
      const dx = pos.x - isl.center.x;
      const dz = pos.z - isl.center.z;
      const radial = Math.hypot(dx, dz);
      if (radial < isl.radius + margin && pos.y < isl.topY + margin && pos.y > isl.bottomY) {
        return isl;
      }
    }
    return null;
  }

  /** 某个世界坐标是否位于岛体内部（用于出生点与安全高度） */
  isOverIsland(pos) {
    for (const isl of this.islands.values()) {
      const d = Math.hypot(pos.x - isl.center.x, pos.z - isl.center.z);
      if (d < isl.radius && pos.y > isl.bottomY && pos.y < isl.topY + 12) return isl;
    }
    return null;
  }

  resetRings(kinds) {
    for (const ring of this.rings) {
      if (!kinds || kinds.includes(ring.kind)) ring.passed = false;
    }
  }

  setActiveDelivery(islandId) {
    for (const dr of this.deliveryRings) dr.active = dr.islandId === islandId;
  }
}
