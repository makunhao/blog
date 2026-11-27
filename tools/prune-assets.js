/* 构建后清理 public/pluginsSrc 中未使用的第三方库，控制 Workers 资源体积 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'pluginsSrc');

// 实际会被页面加载的库：图标、egjs、Butterfly 自带特效/分享，以及若干轻量增强
const KEEP = [
  '@fortawesome',
  '@egjs',
  'butterfly-extsrc',
  'pjax',
  'instant.page',
  'vanilla-lazyload',
  'node-snackbar',
  'blueimp-md5',
  'typed.js',
  'pace-js'
];

function sizeOf(p) {
  let total = 0;
  const st = fs.statSync(p);
  if (st.isFile()) return st.size;
  for (const f of fs.readdirSync(p)) total += sizeOf(path.join(p, f));
  return total;
}

function run() {
if (!fs.existsSync(DIR)) { console.log('public/pluginsSrc 不存在，跳过清理'); return; }

let saved = 0;
for (const name of fs.readdirSync(DIR)) {
  if (KEEP.indexOf(name) !== -1) continue;
  const full = path.join(DIR, name);
  const size = sizeOf(full);
  fs.rmSync(full, { recursive: true, force: true });
  saved += size;
  console.log('pruned pluginsSrc/' + name + ' (' + (size / 1024 / 1024).toFixed(2) + ' MB)');
}
console.log('pluginsSrc 清理完成，共释放 ' + (saved / 1024 / 1024).toFixed(2) + ' MB');
}

module.exports = { run };
if (require.main === module) run();
