/* Hexo 插件脚本：文章数量为 0 时，index 生成器不会产出 index.html。
   这里在生成结束后检查，缺失就写一个简洁的「暂无文章」首页。 */
'use strict';

const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

hexo.extend.filter.register('after_generate', function () {
  const file = path.join(hexo.public_dir, 'index.html');
  if (fs.existsSync(file)) return;

  const title = esc(hexo.config.title || '我的博客');
  const author = esc(hexo.config.author || '');
  const html = [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + title + '</title>',
    '<style>',
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#141416;color:#e9e9ec;font:16px/1.7 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}',
    '.box{text-align:center;padding:40px 24px}',
    'h1{margin:0 0 12px;font-size:30px;background:linear-gradient(90deg,#f6cfd2,#ffe6bd 45%,#a9c7f0);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    'p{color:#8f8f9a;margin:6px 0 26px}',
    'a{display:inline-block;margin:0 8px;padding:9px 18px;border:1px solid #2a2a31;border-radius:10px;color:#e9e9ec;text-decoration:none;transition:.2s}',
    'a:hover{border-color:#c98d90;color:#eebfc3}',
    '</style>',
    '</head>',
    '<body><div class="box">',
    '<h1>' + title + '</h1>',
    '<p>还没有文章，去写第一篇吧' + (author ? ' · ' + author : '') + '</p>',
    '<a href="/archives/">文章归档</a><a href="/about/">关于我</a>',
    '</div></body></html>'
  ].join('');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
  hexo.log.info('已生成空首页 index.html（当前没有文章）');
});
