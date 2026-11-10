/**
 * 「浮空岛快递」飞机模型包生成器 / Coral plane model-pack builder
 *
 * 生成 assets/models/coral-plane.glb —— 卡通低多边形珊瑚橙小飞机。
 * 机头朝 -Z，原点在机体中心。
 * 节点结构：CoralPlane -> { Body, Cargo(快递包裹，可单独显隐), Propeller(螺旋桨) }
 *
 * 用法: node tools/build-plane-model.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../assets/models/coral-plane.glb');

/* ------------------------------------------------------------------ */
/* 颜色                                                                */
/* ------------------------------------------------------------------ */
const PALETTE = {
  coral: '#FF7A4D',
  coralDark: '#E2542C',
  coralLite: '#FFA47A',
  belly: '#FFE6D2',
  cream: '#FFF6E8',
  white: '#FFFFFF',
  glass: '#9BD8F7',
  ink: '#33384A',
  gold: '#FFC24A',
  teal: '#3FC8C0',
};

function srgbToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  const out = [];
  for (const shift of [16, 8, 0]) {
    const c = ((n >> shift) & 255) / 255;
    out.push(c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 几何构建器（平面着色 + 顶点色）                                       */
/* ------------------------------------------------------------------ */
class Builder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.idx = [];
  }

  get vertexCount() {
    return this.pos.length / 3;
  }

  get triCount() {
    return this.idx.length / 3;
  }

  /** 四边形（给定环绕顺序），拆成两个三角形，使用面法线 */
  quad(a, b, c, d, color) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const rgb = srgbToLinear(color);
    const base = this.vertexCount;
    for (const p of [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(nx, ny, nz);
      this.col.push(rgb[0], rgb[1], rgb[2]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** 轴对齐长方体（中心 + 尺寸），法线朝外 */
  box(cx, cy, cz, w, h, d, color) {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const a0 = [x0, y0, z0], a1 = [x1, y0, z0], a2 = [x1, y1, z0], a3 = [x0, y1, z0];
    const b0 = [x0, y0, z1], b1 = [x1, y0, z1], b2 = [x1, y1, z1], b3 = [x0, y1, z1];
    this.quad(a0, a3, a2, a1, color); // -Z 前
    this.quad(b1, b2, b3, b0, color); // +Z 后
    this.quad(a1, a2, b2, b1, color); // +X 右
    this.quad(b0, b3, a3, a0, color); // -X 左
    this.quad(a3, b3, b2, a2, color); // +Y 上
    this.quad(b1, b0, a0, a1, color); // -Y 下
  }

  /** 沿 Z 的锥台：前后两个矩形截面 */
  taperZ(z0, z1, w0, h0, w1, h1, cy0, cy1, color, bottomColor) {
    const b = bottomColor || color;
    const a0 = [-w0 / 2, cy0 - h0 / 2, z0], a1 = [w0 / 2, cy0 - h0 / 2, z0];
    const a2 = [w0 / 2, cy0 + h0 / 2, z0], a3 = [-w0 / 2, cy0 + h0 / 2, z0];
    const b0 = [-w1 / 2, cy1 - h1 / 2, z1], b1 = [w1 / 2, cy1 - h1 / 2, z1];
    const b2 = [w1 / 2, cy1 + h1 / 2, z1], b3 = [-w1 / 2, cy1 + h1 / 2, z1];
    this.quad(a0, a3, a2, a1, color); // 前端盖
    this.quad(b1, b2, b3, b0, color); // 后端盖
    this.quad(a1, a2, b2, b1, color); // 右
    this.quad(b0, b3, a3, a0, color); // 左
    this.quad(a3, b3, b2, a2, color); // 上
    this.quad(b1, b0, a0, a1, b);     // 下
  }

  /**
   * 水平薄板：XZ 平面四边形沿 Y 挤出。
   * 顶面法线必须朝 +Y：n_y = -(uz*vx - ux*vz)，因此需要二维叉积为负。
   */
  slabXZ(pts, yBottom, yTop, color) {
    let p = pts.slice();
    const ux = p[1][0] - p[0][0], uz = p[1][1] - p[0][1];
    const vx = p[3][0] - p[0][0], vz = p[3][1] - p[0][1];
    if (ux * vz - uz * vx > 0) p = p.slice().reverse();
    const lo = p.map((q) => [q[0], yBottom, q[1]]);
    const hi = p.map((q) => [q[0], yTop, q[1]]);
    this.quad(hi[0], hi[1], hi[2], hi[3], color);   // 顶
    this.quad(lo[3], lo[2], lo[1], lo[0], color);   // 底
    this.quad(lo[0], lo[1], hi[1], hi[0], color);   // 前缘
    this.quad(lo[1], lo[2], hi[2], hi[1], color);   // 翼尖
    this.quad(lo[2], lo[3], hi[3], hi[2], color);   // 后缘
    this.quad(lo[3], lo[0], hi[0], hi[3], color);   // 根部
  }

  /**
   * 垂直薄板：ZY 平面四边形沿 X 挤出。
   * +X 面法线必须朝 +X：n_x = -(uy*vx - ux*vy)，因此需要二维叉积为负。
   */
  slabZY(pts, xBottom, xTop, color) {
    let p = pts.slice();
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1];
    const vx = p[3][0] - p[0][0], vy = p[3][1] - p[0][1];
    if (ux * vy - uy * vx > 0) p = p.slice().reverse();
    const lo = p.map((q) => [xBottom, q[1], q[0]]);
    const hi = p.map((q) => [xTop, q[1], q[0]]);
    this.quad(hi[0], hi[1], hi[2], hi[3], color);
    this.quad(lo[3], lo[2], lo[1], lo[0], color);
    this.quad(lo[0], lo[1], hi[1], hi[0], color);
    this.quad(lo[1], lo[2], hi[2], hi[1], color);
    this.quad(lo[2], lo[3], hi[3], hi[2], color);
    this.quad(lo[3], lo[0], hi[0], hi[3], color);
  }

  /** XY 平面四边形沿 Z 挤出（用于螺旋桨桨叶） */
  slabXY(pts, zFront, zBack, color) {
    let p = pts.slice();
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1];
    const vx = p[3][0] - p[0][0], vy = p[3][1] - p[0][1];
    if (ux * vy - uy * vx < 0) p = p.slice().reverse();
    const front = p.map((q) => [q[0], q[1], zFront]);
    const back = p.map((q) => [q[0], q[1], zBack]);
    this.quad(back[0], back[1], back[2], back[3], color); // +Z
    this.quad(front[3], front[2], front[1], front[0], color); // -Z
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(front[i], front[j], back[j], back[i], color);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 机体 Body                                                           */
/* ------------------------------------------------------------------ */
const body = new Builder();

// 机身：三段锥台，机头(-Z)收窄，腹部奶油色
body.taperZ(-2.32, -1.52, 0.30, 0.26, 0.64, 0.44, 0.02, 0.0, PALETTE.coral, PALETTE.belly);
body.taperZ(-1.52, 0.62, 0.64, 0.44, 0.72, 0.50, 0.0, 0.0, PALETTE.coral, PALETTE.belly);
body.taperZ(0.62, 2.02, 0.72, 0.50, 0.26, 0.24, 0.0, 0.02, PALETTE.coralDark, PALETTE.belly);
// 机头锥尖
body.taperZ(-2.62, -2.32, 0.12, 0.12, 0.30, 0.26, 0.02, 0.02, PALETTE.coralDark, PALETTE.coralDark);

// 座舱风挡
body.box(0, 0.34, -0.92, 0.50, 0.30, 0.92, PALETTE.glass);
body.box(0, 0.50, -0.92, 0.42, 0.06, 0.80, PALETTE.coralLite);

// 主翼（后掠）
for (const s of [-1, 1]) {
  body.slabXZ(
    [[s * 0.30, -0.62], [s * 2.34, -0.08], [s * 2.34, 0.52], [s * 0.30, 0.80]],
    -0.055, 0.055, PALETTE.coral,
  );
  body.slabXZ(
    [[s * 2.02, -0.145], [s * 2.34, -0.08], [s * 2.34, 0.52], [s * 2.02, 0.545]],
    -0.064, 0.064, PALETTE.white,
  );
  body.slabXZ(
    [[s * 0.34, -0.60], [s * 2.00, -0.145], [s * 2.00, 0.545], [s * 0.34, 0.78]],
    -0.070, -0.058, PALETTE.gold,
  );
}

// 尾翼（水平）
for (const s of [-1, 1]) {
  body.slabXZ(
    [[s * 0.06, 1.06], [s * 0.92, 1.34], [s * 0.92, 1.70], [s * 0.06, 1.76]],
    -0.04, 0.04, PALETTE.coralDark,
  );
}

// 垂直尾翼
body.slabZY(
  [[0.95, 0.08], [1.24, 0.82], [1.68, 0.82], [1.60, 0.08]],
  -0.055, 0.055, PALETTE.white,
);
// 尾翼顶端青绿小旗
body.slabZY(
  [[1.26, 0.82], [1.44, 1.10], [1.76, 0.82], [1.56, 0.82]],
  -0.022, 0.022, PALETTE.teal,
);

// 起落滑橇
for (const s of [-1, 1]) {
  body.box(s * 0.42, -0.30, 0.05, 0.07, 0.12, 1.40, PALETTE.ink);
}
body.box(0, -0.38, -0.45, 0.92, 0.08, 0.10, PALETTE.ink);

/* ------------------------------------------------------------------ */
/* 快递包裹 Cargo（独立节点，送达时隐藏）                                  */
/* ------------------------------------------------------------------ */
const cargo = new Builder();
cargo.box(0, 0.50, 0.30, 0.58, 0.42, 0.86, PALETTE.cream);
cargo.box(0, 0.50, 0.30, 0.61, 0.45, 0.20, PALETTE.coral);
cargo.box(0, 0.735, 0.12, 0.26, 0.03, 0.20, PALETTE.white);

/* ------------------------------------------------------------------ */
/* 螺旋桨 Propeller（独立节点，运行时旋转）                                */
/* ------------------------------------------------------------------ */
const prop = new Builder();
prop.taperZ(-2.92, -2.64, 0.10, 0.10, 0.20, 0.20, 0.02, 0.02, PALETTE.ink, PALETTE.ink);
prop.taperZ(-2.64, -2.42, 0.20, 0.20, 0.27, 0.27, 0.02, 0.02, PALETTE.gold, PALETTE.gold);

for (let i = 0; i < 2; i++) {
  const a = i * Math.PI * 0.5;
  const ca = Math.cos(a), sa = Math.sin(a);
  const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca + 0.02];
  const pts = [
    rot(0.10, -0.05), rot(0.94, -0.075), rot(0.94, 0.075), rot(0.10, 0.05),
  ];
  prop.slabXY(pts, -2.72, -2.60, PALETTE.ink);
}

/* ------------------------------------------------------------------ */
/* glTF / GLB 打包                                                       */
/* ------------------------------------------------------------------ */
function minMax(arr, comp) {
  let lo = Infinity, hi = -Infinity;
  for (let i = comp; i < arr.length; i += 3) {
    if (arr[i] < lo) lo = arr[i];
    if (arr[i] > hi) hi = arr[i];
  }
  return [lo, hi];
}

/** 打包单个部件 -> { accessors, bufferViews, bin } */
function packPart(builder) {
  const positions = new Float32Array(builder.pos);
  const normals = new Float32Array(builder.nrm);
  const colors = new Float32Array(builder.col);
  const indices = new Uint32Array(builder.idx);

  const parts = [];
  const bufferViews = [];
  let offset = 0;
  const push = (typedArray, target) => {
    const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    parts.push(bytes);
    if (pad) parts.push(Buffer.alloc(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    offset += bytes.length + pad;
  };

  push(positions, 34962);
  push(normals, 34962);
  push(colors, 34962);
  push(indices, 34963);

  const [minX, maxX] = minMax(positions, 0);
  const [minY, maxY] = minMax(positions, 1);
  const [minZ, maxZ] = minMax(positions, 2);

  const accessors = [
    { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
    { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: colors.length / 3, type: 'VEC3' },
    { bufferView: 3, componentType: 5125, count: indices.length, type: 'SCALAR' },
  ];

  return { accessors, bufferViews, bin: Buffer.concat(parts) };
}

const packed = [packPart(body), packPart(cargo), packPart(prop)];

const binChunks = [];
const bufferViews = [];
const accessors = [];
let binOffset = 0;

for (const p of packed) {
  const pad = (4 - (p.bin.length % 4)) % 4;
  for (const v of p.bufferViews) {
    bufferViews.push({ ...v, byteOffset: v.byteOffset + binOffset });
  }
  for (const a of p.accessors) {
    accessors.push({ ...a, bufferView: a.bufferView + bufferViews.length - p.bufferViews.length });
  }
  binChunks.push(p.bin, Buffer.alloc(pad));
  binOffset += p.bin.length + pad;
}

const bin = Buffer.concat(binChunks);

const json = {
  asset: { version: '2.0', generator: 'sky-courier model-pack builder' },
  scene: 0,
  scenes: [{ name: 'Scene', nodes: [0] }],
  nodes: [
    { name: 'CoralPlane', children: [1, 2, 3] },
    { name: 'Body', mesh: 0 },
    { name: 'Cargo', mesh: 1 },
    { name: 'Propeller', mesh: 2 },
  ],
  meshes: [
    { name: 'Body', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }] },
    { name: 'Cargo', primitives: [{ attributes: { POSITION: 4, NORMAL: 5, COLOR_0: 6 }, indices: 7, material: 0 }] },
    { name: 'Propeller', primitives: [{ attributes: { POSITION: 8, NORMAL: 9, COLOR_0: 10 }, indices: 11, material: 0 }] },
  ],
  materials: [
    {
      name: 'PlanePaint',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0.0,
        roughnessFactor: 0.72,
      },
      doubleSided: true,
    },
  ],
  buffers: [{ byteLength: bin.length }],
  bufferViews,
  accessors,
};

const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
const binPad = (4 - (bin.length % 4)) % 4;
const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);

const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

const chunkHeader = (len, type) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(len, 0);
  h.writeUInt32LE(type, 4);
  return h;
};

const glb = Buffer.concat([
  header,
  chunkHeader(jsonChunk.length, 0x4e4f534a), // JSON
  jsonChunk,
  chunkHeader(binChunk.length, 0x004e4942), // BIN
  binChunk,
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, glb);

console.log('✔ 模型包已生成:', OUT);
for (const [name, b] of [['Body', body], ['Cargo', cargo], ['Propeller', prop]]) {
  console.log(`  ${name}: ${b.vertexCount} 顶点 / ${b.triCount} 三角面`);
}
console.log(`  文件大小 ${glb.length} 字节`);
