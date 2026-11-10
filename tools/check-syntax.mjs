/**
 * 语法自检：把 src/*.js 当作 ES module 做语法检查（node --check 仅按 .mjs 判定模块语法）
 * 用法: node tools/check-syntax.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const tmp = join(root, '.tmp-syntax');

mkdirSync(tmp, { recursive: true });

const files = readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js'));
let failed = 0;

for (const f of files) {
  const dest = join(tmp, f.replace(/\.js$/, '.mjs'));
  writeFileSync(dest, readFileSync(join(root, 'src', f)), 'utf8');
  try {
    execFileSync(process.execPath, ['--check', dest], { stdio: 'pipe' });
    console.log(`OK   ${f}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${f}`);
    console.log(String(err.stderr || err.message));
  }
}

rmSync(tmp, { recursive: true, force: true });
console.log('---');
console.log(failed === 0 ? `全部 ${files.length} 个模块语法通过` : `${failed} 个模块存在语法错误`);
process.exit(failed === 0 ? 0 : 1);
