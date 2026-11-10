/**
 * 校验 assets/models/coral-plane.glb 的结构完整性。
 * 用法: node tools/verify-model.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, '../assets/models/coral-plane.glb');
const buf = readFileSync(path);

const fail = (msg) => { console.error('✘ ' + msg); process.exitCode = 1; };

if (buf.toString('ascii', 0, 4) !== 'glTF') fail('magic 不是 glTF');
const version = buf.readUInt32LE(4);
if (version !== 2) fail('version 不是 2');
const total = buf.readUInt32LE(8);
if (total !== buf.length) fail(`header 长度 ${total} != 文件长度 ${buf.length}`);

let off = 12;
let json = null;
let bin = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  const body = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
  else if (type === 0x004e4942) bin = body;
  off += 8 + len;
}

if (!json) fail('缺少 JSON chunk');
if (!bin) fail('缺少 BIN chunk');

const COMP = { 5126: 4, 5125: 4, 5123: 2 };
const NUM = { VEC3: 3, VEC4: 4, SCALAR: 1 };

let problems = 0;
for (const [i, a] of json.accessors.entries()) {
  const bv = json.bufferViews[a.bufferView];
  const need = COMP[a.componentType] * NUM[a.type] * a.count;
  if (bv.byteLength < need) {
    fail(`accessor ${i} 需要 ${need} 字节，bufferView 只有 ${bv.byteLength}`);
    problems++;
  }
  if (a.min && a.max) {
    if (a.min.length !== 3 || a.max.length !== 3) { fail(`accessor ${i} 的 min/max 不是 VEC3`); problems++; }
  }
}
for (const [i, bv] of json.bufferViews.entries()) {
  if (bv.byteOffset + bv.byteLength > bin.length) {
    fail(`bufferView ${i} 超出 BIN 长度`);
    problems++;
  }
}

// 顶点色必须是有限且在 [0,1] 的线性值
const colAcc = json.accessors.find((a) => a.type === 'VEC3' && json.bufferViews[a.bufferView].byteLength > 0);
for (const [meshIdx, mesh] of json.meshes.entries()) {
  const prim = mesh.primitives[0];
  const acc = json.accessors[prim.attributes.COLOR_0];
  const bv = json.bufferViews[acc.bufferView];
  const floats = new Float32Array(bin.buffer, bin.byteOffset + bv.byteOffset, bv.byteLength / 4);
  let bad = 0;
  for (const v of floats) if (!Number.isFinite(v) || v < -0.01 || v > 1.01) bad++;
  if (bad) { fail(`mesh ${meshIdx} 顶点色有 ${bad} 个非法值`); problems++; }
}

console.log(`✔ GLB 结构校验通过  (${buf.length} 字节, ${json.meshes.length} 网格, ${json.nodes.length} 节点)`);
console.log('  节点:', json.nodes.map((n) => n.name).join(', '));
console.log('  网格:', json.meshes.map((m) => m.name).join(', '));
if (problems) { console.error(`发现 ${problems} 处问题`); process.exit(1); }
