/* 本地博客管理后台 —— 仅监听 127.0.0.1 */
'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const AdmZip = require('adm-zip');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts');
const DRAFTS_DIR = path.join(ROOT, 'source', '_drafts');
const SRC_DIR = path.join(ROOT, 'source');
const IMG_DIR = path.join(ROOT, 'source', 'img');
const MUSIC_JS = path.join(ROOT, 'source', 'js', 'music.js');
const WAIFU_JSON = path.join(ROOT, 'source', 'live2d', 'waifu-tips.json');
const BACKUP_DIR = path.join(ROOT, 'backups');
const MODELS_DIR = path.join(ROOT, 'source', 'live2d', 'models');
const CONFIGS = {
  site: path.join(ROOT, '_config.yml'),
  theme: path.join(ROOT, '_config.butterfly.yml')
};
const PORT = Number(process.env.ADMIN_PORT || 5173);

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(IMG_DIR));
app.use('/vendor/codemirror', express.static(path.join(__dirname, 'node_modules', 'codemirror')));
app.use('/vendor/marked', express.static(path.join(__dirname, 'node_modules', 'marked')));

/* ---------------- 工具函数 ---------------- */

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function fmtDate(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function splitMd(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text || '');
  if (!m) return { meta: {}, body: text || '', hasFm: false };
  let meta = {};
  try { meta = YAML.parse(m[1]) || {}; } catch (e) { meta = { _yamlerror: e.message }; }
  return { meta, body: m[2] || '', hasFm: true };
}

const FM_ORDER = ['title', 'date', 'updated', 'categories', 'tags', 'top_img', 'cover', 'description'];

function buildMd(meta, body) {
  const out = {};
  FM_ORDER.forEach(k => {
    if (meta[k] !== undefined && meta[k] !== null && meta[k] !== '') out[k] = meta[k];
  });
  Object.keys(meta).forEach(k => {
    if (!(k in out) && !k.startsWith('_') && meta[k] !== undefined && meta[k] !== '') out[k] = meta[k];
  });
  const y = YAML.stringify(out, { lineWidth: 0 }).replace(/\n$/, '');
  return '---\n' + y + '\n---\n\n' + (body || '').replace(/^\n+/, '') + '\n';
}

function safeSlug(s) {
  return String(s || '').trim().replace(/\.md$/i, '').replace(/[\\/:*?"<>|\s]+/g, '-');
}

function listMd(dir, draft) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.md'))
    .map(f => {
      const full = path.join(dir, f);
      const raw = fs.readFileSync(full, 'utf8');
      const { meta } = splitMd(raw);
      return {
        slug: f.replace(/\.md$/i, ''),
        file: path.relative(ROOT, full).replace(/\\/g, '/'),
        title: meta.title || f.replace(/\.md$/i, ''),
        date: fmtDate(meta.date),
        updated: fmtDate(meta.updated),
        categories: meta.categories || [],
        tags: meta.tags || [],
        description: meta.description || '',
        draft: !!draft,
        size: fs.statSync(full).size
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function getPost(slug, draft) {
  const dir = draft ? DRAFTS_DIR : POSTS_DIR;
  const full = path.join(dir, safeSlug(slug) + '.md');
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, 'utf8');
  const { meta, body } = splitMd(raw);
  return { slug: safeSlug(slug), draft: !!draft, meta: normalizeMeta(meta), body, raw };
}

function normalizeMeta(meta) {
  const m = Object.assign({}, meta);
  if (m.date) m.date = fmtDate(m.date);
  if (m.updated) m.updated = fmtDate(m.updated);
  if (!Array.isArray(m.categories)) m.categories = m.categories ? [m.categories] : [];
  if (!Array.isArray(m.tags)) m.tags = m.tags ? [m.tags] : [];
  return m;
}

function moveToTrash(file) {
  const trash = path.join(BACKUP_DIR, 'trash');
  fs.mkdirSync(trash, { recursive: true });
  const target = path.join(trash, Date.now() + '-' + path.basename(file));
  fs.renameSync(file, target);
  return target;
}

function backup(file) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const name = path.basename(file) + '.' + Date.now() + '.bak';
    fs.copyFileSync(file, path.join(BACKUP_DIR, name));
    const files = fs.readdirSync(BACKUP_DIR).sort();
    while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  } catch (e) { /* ignore */ }
}

function loadYamlDoc(file) {
  return YAML.parseDocument(fs.readFileSync(file, 'utf8'));
}

function saveYamlDoc(file, doc) {
  backup(file);
  fs.writeFileSync(file, doc.toString({ lineWidth: 0 }), 'utf8');
}

/* ---------------- 概览 ---------------- */

app.get('/api/overview', (req, res) => {
  const posts = listMd(POSTS_DIR, false);
  const drafts = listMd(DRAFTS_DIR, true);
  const images = fs.existsSync(IMG_DIR) ? fs.readdirSync(IMG_DIR).filter(f => /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(f)) : [];
  let branch = '', lastCommit = '';
  try {
    branch = execSyncText('git branch --show-current');
    lastCommit = execSyncText('git log -1 --oneline');
  } catch (e) { /* ignore */ }
  let site = { title: '', author: '' };
  try {
    const doc = YAML.parse(fs.readFileSync(CONFIGS.site, 'utf8'));
    site = { title: doc.title || '', author: doc.author || '' };
  } catch (e) { /* ignore */ }
  res.json({
    site,
    posts: posts.length,
    drafts: drafts.length,
    images: images.length,
    branch,
    lastCommit,
    root: ROOT
  });
});

function execSyncText(cmd) {
  const r = require('child_process').spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf8' });
  return ((r.stdout || '') + (r.stderr || '')).trim();
}

app.post('/api/posts/import', (req, res) => {
  const { filename = 'import.md', content = '', category = '' } = req.body || {};
  if (!String(content).trim()) return res.status(400).json({ error: '文件内容为空' });
  const { meta, body } = splitMd(String(content));
  const base = path.basename(String(filename)).replace(/\.(md|markdown)$/i, '');
  const title = meta.title || base || '导入的文章';
  let slug = safeSlug(meta.slug || base) || ('import-' + Date.now());
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  let full = path.join(POSTS_DIR, slug + '.md');
  let i = 1;
  while (fs.existsSync(full)) { full = path.join(POSTS_DIR, slug + '-' + i + '.md'); i++; }
  const m = Object.assign({}, meta);
  if (!m.date) m.date = fmtDate(new Date());
  if (!m.categories || !m.categories.length) {
    m.categories = category ? String(category).split('/').filter(Boolean) : ['未分类'];
  }
  if (!Array.isArray(m.categories)) m.categories = [m.categories];
  fs.writeFileSync(full, buildMd(m, body), 'utf8');
  res.json({ ok: true, slug: path.basename(full, '.md'), title });
});

/* ---------------- 分类 ---------------- */

function categoryPathOf(meta) {
  const c = meta && meta.categories;
  if (!c) return '';
  const arr = Array.isArray(c) ? c : [c];
  return arr.filter(Boolean).join('/');
}

function allPostFiles() {
  const files = [];
  [POSTS_DIR, DRAFTS_DIR].forEach(d => {
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).filter(f => f.toLowerCase().endsWith('.md')).forEach(f => files.push(path.join(d, f)));
  });
  return files;
}

function collectCategories() {
  const map = {};
  allPostFiles().forEach(f => {
    const { meta } = splitMd(fs.readFileSync(f, 'utf8'));
    const p = categoryPathOf(meta);
    if (p) map[p] = (map[p] || 0) + 1;
  });
  return Object.keys(map).map(p => ({ path: p, count: map[p] })).sort((a, b) => b.count - a.count);
}

app.get('/api/categories', (req, res) => res.json(collectCategories()));

app.post('/api/categories/rename', (req, res) => {
  const from = String((req.body || {}).from || '').trim();
  const to = String((req.body || {}).to || '').trim();
  if (!from || !to) return res.status(400).json({ error: '缺少分类名' });
  let changed = 0;
  allPostFiles().forEach(f => {
    const raw = fs.readFileSync(f, 'utf8');
    const { meta, body } = splitMd(raw);
    const p = categoryPathOf(meta);
    if (!p || !(p === from || p.indexOf(from + '/') === 0)) return;
    const arr = Array.isArray(meta.categories) ? meta.categories : [meta.categories];
    const rest = arr.slice(from.split('/').length);
    meta.categories = to.split('/').filter(Boolean).concat(rest);
    backup(f);
    fs.writeFileSync(f, buildMd(meta, body), 'utf8');
    changed++;
  });
  res.json({ ok: true, changed });
});

app.post('/api/categories/delete', (req, res) => {
  const target = String((req.body || {}).path || '').trim();
  if (!target) return res.status(400).json({ error: '缺少分类名' });
  let changed = 0;
  allPostFiles().forEach(f => {
    const raw = fs.readFileSync(f, 'utf8');
    const { meta, body } = splitMd(raw);
    const p = categoryPathOf(meta);
    if (!p || !(p === target || p.indexOf(target + '/') === 0)) return;
    const arr = Array.isArray(meta.categories) ? meta.categories : [meta.categories];
    const rest = arr.slice(target.split('/').length);
    meta.categories = rest.length ? rest : ['未分类'];
    backup(f);
    fs.writeFileSync(f, buildMd(meta, body), 'utf8');
    changed++;
  });
  res.json({ ok: true, changed });
});

/* ---------------- 文章 ---------------- */

app.get('/api/posts', (req, res) => {
  res.json({ posts: listMd(POSTS_DIR, false), drafts: listMd(DRAFTS_DIR, true) });
});

app.get('/api/posts/:slug', (req, res) => {
  const p = getPost(req.params.slug, req.query.draft === '1');
  if (!p) return res.status(404).json({ error: '文章不存在' });
  res.json(p);
});

app.post('/api/posts', (req, res) => {
  const { title, slug, draft, category } = req.body || {};
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  let s = safeSlug(slug || '') || 'post-' + Date.now();
  const dir = draft ? DRAFTS_DIR : POSTS_DIR;
  fs.mkdirSync(dir, { recursive: true });
  let full = path.join(dir, s + '.md');
  let i = 1;
  while (fs.existsSync(full)) { full = path.join(dir, s + '-' + i + '.md'); i++; }
  const meta = {
    title,
    date: fmtDate(new Date()),
    categories: category ? String(category).split('/').filter(Boolean) : ['未分类'],
    tags: [],
    top_img: '/img/banner.jpg',
    cover: '/img/banner.jpg',
    description: ''
  };
  fs.writeFileSync(full, buildMd(meta, ''), 'utf8');
  res.json({ ok: true, slug: path.basename(full, '.md'), draft: !!draft });
});

app.put('/api/posts/:slug', (req, res) => {
  const slug = safeSlug(req.params.slug);
  const draft = req.query.draft === '1';
  const dir = draft ? DRAFTS_DIR : POSTS_DIR;
  const oldPath = path.join(dir, slug + '.md');
  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: '文章不存在' });
  const { meta = {}, body = '', newSlug } = req.body || {};
  if (meta.date) meta.date = fmtDate(meta.date);
  if (meta.updated) meta.updated = fmtDate(meta.updated);
  let target = oldPath;
  if (newSlug && safeSlug(newSlug) && safeSlug(newSlug) !== slug) {
    target = path.join(dir, safeSlug(newSlug) + '.md');
    if (fs.existsSync(target)) return res.status(400).json({ error: '目标文件名已存在' });
  }
  fs.writeFileSync(target, buildMd(meta, body), 'utf8');
  if (target !== oldPath) fs.unlinkSync(oldPath);
  res.json({ ok: true, slug: path.basename(target, '.md') });
});

app.delete('/api/posts/:slug', (req, res) => {
  const draft = req.query.draft === '1';
  const full = path.join(draft ? DRAFTS_DIR : POSTS_DIR, safeSlug(req.params.slug) + '.md');
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文章不存在' });
  moveToTrash(full);
  res.json({ ok: true, trashed: true });
});

/* ---------------- 页面 ---------------- */

app.get('/api/pages', (req, res) => {
  const dirs = fs.readdirSync(SRC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(SRC_DIR, name, 'index.md')));
  res.json(dirs.map(name => {
    const raw = fs.readFileSync(path.join(SRC_DIR, name, 'index.md'), 'utf8');
    const { meta } = splitMd(raw);
    return { name, file: 'source/' + name + '/index.md', title: meta.title || name };
  }));
});

app.get('/api/pages/:name', (req, res) => {
  const name = safeSlug(req.params.name);
  const full = path.join(SRC_DIR, name, 'index.md');
  if (!fs.existsSync(full)) return res.status(404).json({ error: '页面不存在' });
  const { meta, body, raw } = splitMd(fs.readFileSync(full, 'utf8'));
  res.json({ name, meta: normalizeMeta(meta), body, raw });
});

app.put('/api/pages/:name', (req, res) => {
  const name = safeSlug(req.params.name);
  const full = path.join(SRC_DIR, name, 'index.md');
  if (!fs.existsSync(full)) return res.status(404).json({ error: '页面不存在' });
  const { meta = {}, body = '' } = req.body || {};
  backup(full);
  fs.writeFileSync(full, buildMd(meta, body), 'utf8');
  res.json({ ok: true });
});

/* ---------------- 媒体 ---------------- */

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(IMG_DIR, { recursive: true }); cb(null, IMG_DIR); },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      let base = path.basename(file.originalname, ext).replace(/[^\w一-龥.-]+/g, '-');
      let name = base + ext;
      let i = 1;
      while (fs.existsSync(path.join(IMG_DIR, name))) { name = base + '-' + i + ext; i++; }
      cb(null, name);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.get('/api/media', (req, res) => {
  if (!fs.existsSync(IMG_DIR)) return res.json([]);
  const files = fs.readdirSync(IMG_DIR)
    .filter(f => /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(f))
    .map(f => {
      const st = fs.statSync(path.join(IMG_DIR, f));
      return { name: f, url: '/img/' + encodeURIComponent(f), size: st.size, mtime: st.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map(f => ({ name: f.name, url: f.url, size: f.size, mtime: f.mtime }));
  res.json(files);
});

app.post('/api/media', upload.array('files', 20), (req, res) => {
  res.json({ ok: true, files: (req.files || []).map(f => '/img/' + f.filename) });
});

app.delete('/api/media/:name', (req, res) => {
  const name = path.basename(req.params.name);
  const full = path.join(IMG_DIR, name);
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' });
  moveToTrash(full);
  res.json({ ok: true, trashed: true });
});

/* 头像 / 横幅上传 */
app.post('/api/avatar', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件' });
  const ext = path.extname(req.file.filename).toLowerCase();
  const target = path.join(IMG_DIR, 'avatar' + ext);
  fs.renameSync(req.file.path, target);
  fs.readdirSync(IMG_DIR).filter(f => /^avatar\./i.test(f) && f !== 'avatar' + ext).forEach(f => {
    try { fs.unlinkSync(path.join(IMG_DIR, f)); } catch (e) {}
  });
  const doc = loadYamlDoc(CONFIGS.theme);
  doc.setIn(['avatar', 'img'], '/img/avatar' + ext);
  saveYamlDoc(CONFIGS.theme, doc);
  res.json({ ok: true, url: '/img/avatar' + ext });
});

app.post('/api/banner', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件' });
  const ext = path.extname(req.file.filename).toLowerCase();
  const target = path.join(IMG_DIR, 'banner' + ext);
  fs.renameSync(req.file.path, target);
  fs.readdirSync(IMG_DIR).filter(f => /^banner\./i.test(f) && f !== 'banner' + ext).forEach(f => {
    try { fs.unlinkSync(path.join(IMG_DIR, f)); } catch (e) {}
  });
  const doc = loadYamlDoc(CONFIGS.theme);
  doc.setIn(['index_img'], '/img/banner' + ext);
  doc.setIn(['default_top_img'], '/img/banner' + ext);
  saveYamlDoc(CONFIGS.theme, doc);
  res.json({ ok: true, url: '/img/banner' + ext });
});

/* ---------------- 配置文件 ---------------- */

app.get('/api/config/:name', (req, res) => {
  const file = CONFIGS[req.params.name];
  if (!file) return res.status(404).json({ error: '未知配置' });
  res.json({ name: req.params.name, path: path.relative(ROOT, file), content: fs.readFileSync(file, 'utf8') });
});

app.get('/api/config/:name/parsed', (req, res) => {
  const file = CONFIGS[req.params.name];
  if (!file) return res.status(404).json({ error: '未知配置' });
  try { res.json(YAML.parse(fs.readFileSync(file, 'utf8')) || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/config/:name', (req, res) => {
  const file = CONFIGS[req.params.name];
  if (!file) return res.status(404).json({ error: '未知配置' });
  const content = String((req.body || {}).content || '');
  try { YAML.parse(content); } catch (e) { return res.status(400).json({ error: 'YAML 语法错误：' + e.message }); }
  backup(file);
  fs.writeFileSync(file, content, 'utf8');
  res.json({ ok: true });
});

app.post('/api/config/:name/patch', (req, res) => {
  const file = CONFIGS[req.params.name];
  if (!file) return res.status(404).json({ error: '未知配置' });
  const { path: keyPath, value } = req.body || {};
  if (keyPath === undefined) return res.status(400).json({ error: '缺少 path' });
  const doc = loadYamlDoc(file);
  const segs = String(keyPath).split('.').map(s => /^\d+$/.test(s) ? Number(s) : s);
  doc.setIn(segs, value);
  saveYamlDoc(file, doc);
  res.json({ ok: true });
});

/* ---------------- 组件与个性化设置 ---------------- */

function readMusicId() {
  try {
    const m = /[?&]id=(\d+)/.exec(fs.readFileSync(MUSIC_JS, 'utf8'));
    return m ? m[1] : '';
  } catch (e) { return ''; }
}

function readLive2dModel() {
  try {
    const j = JSON.parse(fs.readFileSync(WAIFU_JSON, 'utf8'));
    return (j.models && j.models[0] && j.models[0].paths && j.models[0].paths[0]) || '';
  } catch (e) { return ''; }
}

app.get('/api/features', (req, res) => {
  const theme = YAML.parse(fs.readFileSync(CONFIGS.theme, 'utf8')) || {};
  const site = YAML.parse(fs.readFileSync(CONFIGS.site, 'utf8')) || {};
  res.json({
    siteTitle: site.title || '',
    avatar: theme.avatar && theme.avatar.img || '',
    banner: theme.index_img || '',
    signature: theme.aside && theme.aside.card_author && theme.aside.card_author.description || '',
    announcement: theme.aside && theme.aside.card_announcement && theme.aside.card_announcement.content || '',
    toggles: {
      click_heart: !!(theme.click_heart && theme.click_heart.enable),
      canvas_ribbon: !!(theme.canvas_ribbon && theme.canvas_ribbon.enable),
      activate_power_mode: !!(theme.activate_power_mode && theme.activate_power_mode.enable),
      fireworks: !!(theme.fireworks && theme.fireworks.enable),
      preloader: !!(theme.preloader && theme.preloader.enable),
      darkmode: !!(theme.darkmode && theme.darkmode.enable)
    },
    musicId: readMusicId(),
    live2dModel: readLive2dModel()
  });
});

app.put('/api/features', (req, res) => {
  const b = req.body || {};
  const doc = loadYamlDoc(CONFIGS.theme);
  if (typeof b.avatar === 'string' && b.avatar) doc.setIn(['avatar', 'img'], b.avatar);
  if (typeof b.signature === 'string') doc.setIn(['aside', 'card_author', 'description'], b.signature);
  if (typeof b.announcement === 'string') doc.setIn(['aside', 'card_announcement', 'content'], b.announcement);
  if (b.toggles && typeof b.toggles === 'object') {
    Object.keys(b.toggles).forEach(k => doc.setIn([k, 'enable'], !!b.toggles[k]));
  }
  saveYamlDoc(CONFIGS.theme, doc);

  if (typeof b.siteTitle === 'string' && b.siteTitle) {
    const sdoc = loadYamlDoc(CONFIGS.site);
    sdoc.set('title', b.siteTitle);
    saveYamlDoc(CONFIGS.site, sdoc);
  }
  if (b.musicId && /^\d+$/.test(String(b.musicId))) {
    const js = fs.readFileSync(MUSIC_JS, 'utf8').replace(/([?&]id=)\d+/, '$1' + b.musicId);
    fs.writeFileSync(MUSIC_JS, js, 'utf8');
  }
  if (b.live2dModel && (/^\/live2d\/models\//.test(b.live2dModel) || /^https:\/\//.test(b.live2dModel))) {
    const j = JSON.parse(fs.readFileSync(WAIFU_JSON, 'utf8'));
    if (j.models && j.models[0]) j.models[0].paths = [b.live2dModel];
    fs.writeFileSync(WAIFU_JSON, JSON.stringify(j, null, 2) + '\n', 'utf8');
  }
  res.json({ ok: true });
});

/* ---------------- Live2D 模型 ---------------- */

function dirSize(p) {
  let total = 0;
  const st = fs.statSync(p);
  if (st.isFile()) return st.size;
  for (const f of fs.readdirSync(p)) total += dirSize(path.join(p, f));
  return total;
}

function findModelJson(dir, depth) {
  depth = depth || 0;
  if (depth > 4 || !fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile() && /\.model3?\.json$/i.test(e.name)) return path.join(dir, e.name);
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const r = findModelJson(path.join(dir, e.name), depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function activeModel() {
  try {
    const j = JSON.parse(fs.readFileSync(WAIFU_JSON, 'utf8'));
    return (j.models && j.models[0] && j.models[0].paths && j.models[0].paths[0]) || '';
  } catch (e) { return ''; }
}

function setActiveModel(p) {
  const j = JSON.parse(fs.readFileSync(WAIFU_JSON, 'utf8'));
  if (!j.models || !j.models.length) j.models = [{ name: 'model', paths: [p], message: '你好呀～' }];
  j.models[0].paths = [p];
  fs.writeFileSync(WAIFU_JSON, JSON.stringify(j, null, 2) + '\n', 'utf8');
}

app.get('/api/live2d/models', (req, res) => {
  const active = activeModel();
  const list = [];
  if (fs.existsSync(MODELS_DIR)) {
    fs.readdirSync(MODELS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).forEach(d => {
      const dir = path.join(MODELS_DIR, d.name);
      const json = findModelJson(dir);
      if (!json) return;
      const rel = '/live2d/models/' + d.name + '/' + path.relative(dir, json).split(path.sep).join('/');
      list.push({ name: d.name, path: rel, size: dirSize(dir), active: rel === active });
    });
  }
  res.json(list);
});

const modelUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, 'l2d-' + Date.now() + '.zip')
  }),
  limits: { fileSize: 12 * 1024 * 1024 }
});

app.post('/api/live2d', modelUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件' });
  const zipPath = req.file.path;
  let tmp = null;
  try {
    const zip = new AdmZip(zipPath);
    zip.getEntries().forEach(e => {
      if (e.entryName.indexOf('..') !== -1) throw new Error('压缩包路径非法');
    });
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l2d-'));
    zip.extractAllTo(tmp, true);
    const json = findModelJson(tmp);
    if (!json) throw new Error('压缩包里没有找到 .model.json / .model3.json');
    const root = path.dirname(json);
    const name = safeSlug(path.basename(root)) || ('model-' + Date.now());
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    let target = path.join(MODELS_DIR, name);
    let i = 1;
    while (fs.existsSync(target)) { target = path.join(MODELS_DIR, name + '-' + i); i++; }
    if (root === tmp) {
      fs.cpSync(tmp, target, { recursive: true });
      fs.rmSync(tmp, { recursive: true, force: true });
      tmp = null;
    } else {
      fs.cpSync(root, target, { recursive: true });
      fs.rmSync(root, { recursive: true, force: true });
    }
    const size = dirSize(target);
    if (size > 12 * 1024 * 1024) throw new Error('模型解压后超过 12MB，会挤爆 Cloudflare 资源额度');
    const rel = '/live2d/models/' + path.basename(target) + '/' + path.basename(json);
    setActiveModel(rel);
    res.json({ ok: true, model: rel, size });
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    try { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    try { fs.unlinkSync(zipPath); } catch (e) {}
  }
});

app.post('/api/live2d/use', (req, res) => {
  const p = String((req.body || {}).path || '');
  if (!/^\/live2d\/models\//.test(p)) return res.status(400).json({ error: '路径非法' });
  setActiveModel(p);
  res.json({ ok: true });
});

app.delete('/api/live2d/models/:name', (req, res) => {
  const name = path.basename(req.params.name);
  const dir = path.join(MODELS_DIR, name);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: '模型不存在' });
  const active = activeModel();
  moveToTrash(dir);
  if (active.indexOf('/live2d/models/' + name + '/') === 0) {
    const rest = fs.existsSync(MODELS_DIR) ? fs.readdirSync(MODELS_DIR) : [];
    if (rest.length) setActiveModel('/live2d/models/' + rest[0] + '/' + path.relative(path.join(MODELS_DIR, rest[0]), findModelJson(path.join(MODELS_DIR, rest[0]))).split(path.sep).join('/'));
    else setActiveModel('/live2d/models/hijiki/hijiki.model.json');
  }
  res.json({ ok: true });
});

/* ---------------- 运行命令 / 构建 / 推送 ---------------- */

function stream(res, cmd, opts = {}) {
  return new Promise(resolve => {
    res.write('\n$ ' + cmd + '\n');
    const child = spawn(cmd, { shell: true, cwd: ROOT, env: process.env });
    child.stdout.pipe(res, { end: false });
    child.stderr.pipe(res, { end: false });
    child.on('close', code => {
      res.write('\n[exit ' + code + ']\n');
      resolve(code);
    });
  });
}

app.post('/api/run', async (req, res) => {
  const { action } = req.body || {};
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  if (action === 'build') {
    await stream(res, 'npx hexo clean');
    await stream(res, 'npm run build');
  } else if (action === 'push') {
    await stream(res, 'git add -A');
    await stream(res, 'git status --short');
    const code = await stream(res, 'git commit -m "后台更新"');
    if (code !== 0) res.write('\n没有新的文件改动，直接尝试推送…\n');
    let pushCode = 1;
    for (let i = 1; i <= 3 && pushCode !== 0; i++) {
      if (i > 1) res.write('\n第 ' + i + ' 次重试推送…\n');
      pushCode = await stream(res, 'git push');
      if (pushCode !== 0 && i < 3) await new Promise(r => setTimeout(r, 3000));
    }
    if (pushCode !== 0) {
      res.write('\n[提示] 连不上 github.com 时：检查网络/代理，或给 git 配置代理：\n');
      res.write('  git config --global http.proxy http://127.0.0.1:7890\n');
      res.write('  git config --global https.proxy http://127.0.0.1:7890\n');
      res.write('  代理端口按你实际用的软件改，推送成功后可以 --unset 掉。\n');
    }
  } else if (action === 'install' && req.body.name) {
    await stream(res, 'npm install ' + req.body.name + ' --registry=https://registry.npmmirror.com');
  } else if (action === 'uninstall' && req.body.name) {
    await stream(res, 'npm uninstall ' + req.body.name);
  } else {
    res.write('未知操作\n');
  }
  res.end();
});

let previewProc = null;
app.post('/api/preview/start', (req, res) => {
  if (previewProc) return res.json({ ok: true, already: true, url: 'http://localhost:4000' });
  previewProc = spawn('npx hexo server', { shell: true, cwd: ROOT, detached: false });
  previewProc.on('close', () => { previewProc = null; });
  res.json({ ok: true, url: 'http://localhost:4000' });
});
app.post('/api/preview/stop', (req, res) => {
  if (!previewProc) return res.json({ ok: true, already: true });
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(previewProc.pid), '/T', '/F']);
  } else {
    previewProc.kill('SIGTERM');
  }
  previewProc = null;
  res.json({ ok: true });
});

/* ---------------- 插件（package.json 依赖） ---------------- */

app.get('/api/plugins', (req, res) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  res.json(Object.keys(pkg.dependencies || {}).map(name => ({
    name,
    version: pkg.dependencies[name],
    type: name.startsWith('hexo-') ? 'plugins' : 'base'
  })));
});

/* ---------------- 启动 ---------------- */

try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) {}

app.listen(PORT, '127.0.0.1', () => {
  console.log('\n  博客管理后台已启动：http://localhost:' + PORT + '\n');
});
