'use strict';

const $ = (s, el) => (el || document).querySelector(s);
const content = $('#content');
const titleEl = $('#view-title');
const subEl = $('#view-sub');
const actionsEl = $('#top-actions');
let cmInstance = null;
let currentPost = null;

/* ---------------- 基础 ---------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(url, opts) {
  opts = opts || {};
  if (opts.body && typeof opts.body !== 'string' && !(typeof FormData !== 'undefined' && opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  }
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.indexOf('json') >= 0 ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
  return data;
}

function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = ''; }, 2600);
}

function setHeader(title, sub, actions) {
  titleEl.textContent = title;
  subEl.textContent = sub || '';
  actionsEl.innerHTML = '';
  (actions || []).forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.onclick = a.onClick;
    actionsEl.appendChild(b);
  });
}

function splitList(v) {
  return String(v || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
}

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function disposeEditor() {
  if (cmInstance) { try { cmInstance.toTextArea(); } catch (e) {} cmInstance = null; }
}

/* ---------------- 导航 ---------------- */

document.querySelectorAll('#nav a').forEach(a => {
  a.onclick = () => navigate(a.dataset.view);
});

async function refreshStatus() {
  try {
    const d = await api('/api/overview');
    $('#side-status').textContent = (d.branch || 'no-git') + ' · ' + d.posts + ' 篇';
    document.querySelector('.status-dot').classList.add('ok');
  } catch (e) {}
}

function navigate(view) {
  refreshStatus();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  disposeEditor();
  currentPost = null;
  const map = {
    overview: renderOverview,
    posts: renderPosts,
    pages: renderPages,
    media: renderMedia,
    features: renderFeatures,
    site: () => renderConfig('site'),
    theme: () => renderConfig('theme'),
    plugins: renderPlugins,
    publish: renderPublish
  };
  (map[view] || renderOverview)();
}

/* ---------------- 概览 ---------------- */

async function renderOverview() {
  setHeader('概览', '本地管理后台 · 仅监听 127.0.0.1', [
    { label: '写新文章', cls: 'btn-primary', onClick: newPost },
    { label: '构建', onClick: () => navigate('publish') }
  ]);
  try {
    const d = await api('/api/overview');
    $('#side-status').textContent = (d.branch || 'no-git') + ' · ' + d.posts + ' 篇';
    $('.status-dot').classList.add('ok');
    content.innerHTML =
      '<div class="grid grid-4">' +
        '<div class="stat"><small>文章</small><b>' + d.posts + '</b><div class="hint">已发布</div></div>' +
        '<div class="stat"><small>草稿</small><b>' + d.drafts + '</b><div class="hint">source/_drafts</div></div>' +
        '<div class="stat"><small>图片</small><b>' + d.images + '</b><div class="hint">source/img</div></div>' +
        '<div class="stat"><small>分支</small><b style="font-size:18px">' + esc(d.branch || '-') + '</b><div class="hint">' + esc(d.lastCommit || '无提交') + '</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px">' +
        '<h3 class="section-title">站点</h3>' +
        '<div class="hint">标题：' + esc(d.site.title) + ' · 作者：' + esc(d.site.author) + '</div>' +
        '<div class="hint" style="margin-top:6px">目录：' + esc(d.root) + '</div>' +
        '<div class="divider"></div>' +
        '<div class="row">' +
          '<button class="btn" onclick="navigate(\'posts\')">管理文章</button>' +
          '<button class="btn" onclick="navigate(\'media\')">媒体库</button>' +
          '<button class="btn" onclick="navigate(\'features\')">组件开关</button>' +
          '<button class="btn" onclick="navigate(\'publish\')">构建 / 推送</button>' +
        '</div>' +
      '</div>';
  } catch (e) {
    content.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
  }
}

/* ---------------- 文章 ---------------- */

async function newPost(draft) {
  const title = prompt(draft ? '草稿标题' : '文章标题');
  if (!title) return;
  const slug = prompt('文件名（英文/数字，可留空自动生成）', '') || '';
  try {
    const r = await api('/api/posts', { method: 'POST', body: { title, slug, draft: !!draft } });
    toast('已创建');
    openPost(r.slug, r.draft);
  } catch (e) { toast(e.message, true); }
}

async function renderPosts() {
  setHeader('文章', '增删改文章与草稿', [
    { label: '新建文章', cls: 'btn-primary', onClick: () => newPost(false) },
    { label: '新建草稿', onClick: () => newPost(true) }
  ]);
  try {
    const { posts, drafts } = await api('/api/posts');
    content.innerHTML =
      '<div class="card"><h3 class="section-title">已发布（' + posts.length + '）</h3>' +
      postTable(posts, false) + '</div>' +
      '<div class="card" style="margin-top:16px"><h3 class="section-title">草稿（' + drafts.length + '）</h3>' +
      postTable(drafts, true) + '</div>';
    bindPostRows();
  } catch (e) { content.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}

function postTable(list, draft) {
  if (!list.length) return '<div class="empty">暂无</div>';
  return '<table class="table"><thead><tr><th>标题</th><th>日期</th><th>分类 / 标签</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
    list.map(p =>
      '<tr><td><div class="title">' + esc(p.title) + '</div><div class="muted">' + esc(p.file) + '</div></td>' +
      '<td class="muted">' + esc(p.date || '-') + '</td>' +
      '<td>' + (p.categories || []).map(c => '<span class="pill">' + esc(c) + '</span>').join('') +
      (p.tags || []).map(t => '<span class="pill">#' + esc(t) + '</span>').join('') + '</td>' +
      '<td><div class="ops">' +
      '<button class="btn btn-sm" data-edit="' + esc(p.slug) + '">编辑</button>' +
      '<button class="btn btn-sm btn-danger" data-del="' + esc(p.slug) + '">删除</button>' +
      '</div></td></tr>'
    ).join('') + '</tbody></table>';
}

function bindPostRows() {
  content.querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = () => {
      const card = b.closest('.card');
      const isDraft = card.querySelector('.section-title').textContent.indexOf('草稿') >= 0;
      openPost(b.dataset.edit, isDraft);
    };
  });
  content.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      const card = b.closest('.card');
      const isDraft = card.querySelector('.section-title').textContent.indexOf('草稿') >= 0;
      if (!confirm('确定删除「' + b.dataset.del + '」？')) return;
      try { await api('/api/posts/' + encodeURIComponent(b.dataset.del) + '?draft=' + (isDraft ? 1 : 0), { method: 'DELETE' }); toast('已删除'); renderPosts(); }
      catch (e) { toast(e.message, true); }
    };
  });
}

async function openPost(slug, draft) {
  try {
    const p = await api('/api/posts/' + encodeURIComponent(slug) + '?draft=' + (draft ? 1 : 0));
    currentPost = p;
    setHeader(p.meta.title || slug, p.file, [
      { label: '返回列表', onClick: () => renderPosts() }
    ]);
    content.innerHTML = postEditorHtml(p, draft);
    bindEditor(p, draft);
  } catch (e) { toast(e.message, true); }
}

function editorFields(p) {
  const m = p.meta || {};
  return '<div class="ed-fields">' +
    '<div class="field wide"><label>标题</label><input type="text" id="f-title" value="' + esc(m.title) + '"></div>' +
    '<div class="field"><label>发布日期</label><input type="text" id="f-date" value="' + esc(m.date) + '" placeholder="2026-11-27 20:00:00"></div>' +
    '<div class="field"><label>更新日期（可空）</label><input type="text" id="f-updated" value="' + esc(m.updated) + '"></div>' +
    '<div class="field"><label>文件名 slug</label><input type="text" id="f-slug" value="' + esc(p.slug) + '"></div>' +
    '<div class="field"><label>分类（逗号分隔）</label><input type="text" id="f-cats" value="' + esc((m.categories || []).join(', ')) + '"></div>' +
    '<div class="field"><label>标签（逗号分隔）</label><input type="text" id="f-tags" value="' + esc((m.tags || []).join(', ')) + '"></div>' +
    '<div class="field wide"><label>摘要 description（首页显示）</label><input type="text" id="f-desc" value="' + esc(m.description) + '"></div>' +
    '<div class="field"><label>横幅 top_img</label><input type="text" id="f-top" value="' + esc(m.top_img) + '" placeholder="/img/banner.jpg"></div>' +
    '<div class="field"><label>封面 cover</label><input type="text" id="f-cover" value="' + esc(m.cover) + '" placeholder="/img/banner.jpg"></div>' +
    '</div>';
}

function postEditorHtml(p, draft) {
  return '<div class="editor">' +
    '<div class="ed-bar"><span class="pill ' + (draft ? 'draft' : '') + '">' + (draft ? '草稿' : '文章') + '</span>' +
    '<span class="hint">Ctrl+S 保存</span><span class="spacer"></span>' +
    '<button class="btn btn-primary" id="ed-save">保存</button>' +
    '<button class="btn btn-danger" id="ed-del">删除</button></div>' +
    editorFields(p) +
    '<div class="ed-body"><div class="ed-src"><textarea id="ed-md">' + esc(p.body) + '</textarea></div>' +
    '<div class="ed-prev" id="ed-prev"></div></div>' +
    '</div>';
}

function bindEditor(p, draft) {
  cmInstance = CodeMirror.fromTextArea($('#ed-md'), {
    mode: 'markdown', theme: 'material-darker', lineWrapping: true, lineNumbers: true
  });
  const renderPreview = () => {
    $('#ed-prev').innerHTML = marked.parse(cmInstance.getValue() || '');
  };
  cmInstance.on('change', () => { clearTimeout(bindEditor._t); bindEditor._t = setTimeout(renderPreview, 200); });
  renderPreview();

  const save = async () => {
    const meta = {
      title: $('#f-title').value.trim(),
      date: $('#f-date').value.trim(),
      updated: $('#f-updated').value.trim(),
      categories: splitList($('#f-cats').value),
      tags: splitList($('#f-tags').value),
      top_img: $('#f-top').value.trim(),
      cover: $('#f-cover').value.trim(),
      description: $('#f-desc').value.trim()
    };
    if (!meta.updated) delete meta.updated;
    try {
      const r = await api('/api/posts/' + encodeURIComponent(p.slug) + '?draft=' + (draft ? 1 : 0), {
        method: 'PUT', body: { meta, body: cmInstance.getValue(), newSlug: $('#f-slug').value.trim() }
      });
      toast('已保存');
      p.slug = r.slug;
      setHeader(meta.title, p.file, [{ label: '返回列表', onClick: () => renderPosts() }]);
    } catch (e) { toast(e.message, true); }
  };

  $('#ed-save').onclick = save;
  $('#ed-del').onclick = async () => {
    if (!confirm('确定删除这篇文章？')) return;
    try {
      await api('/api/posts/' + encodeURIComponent(p.slug) + '?draft=' + (draft ? 1 : 0), { method: 'DELETE' });
      toast('已删除'); renderPosts();
    } catch (e) { toast(e.message, true); }
  };
  document.onkeydown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  };
}

/* ---------------- 页面 ---------------- */

async function renderPages() {
  setHeader('页面', '关于 / 友链 / 留言板等独立页面', []);
  try {
    const pages = await api('/api/pages');
    content.innerHTML = '<div class="card"><table class="table"><thead><tr><th>页面</th><th>文件</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
      pages.map(p => '<tr><td class="title">' + esc(p.title) + '</td><td class="muted">' + esc(p.file) + '</td>' +
        '<td><div class="ops"><button class="btn btn-sm" data-page="' + esc(p.name) + '">编辑</button></div></td></tr>').join('') +
      '</tbody></table></div>';
    content.querySelectorAll('[data-page]').forEach(b => b.onclick = () => openPage(b.dataset.page));
  } catch (e) { content.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}

async function openPage(name) {
  try {
    const p = await api('/api/pages/' + encodeURIComponent(name));
    setHeader(p.meta.title || name, 'source/' + name + '/index.md', [{ label: '返回', onClick: () => renderPages() }]);
    content.innerHTML = '<div class="editor">' +
      '<div class="ed-bar"><span class="spacer"></span><button class="btn btn-primary" id="pg-save">保存</button></div>' +
      '<div class="ed-fields">' +
        '<div class="field wide"><label>标题</label><input type="text" id="pg-title" value="' + esc(p.meta.title || '') + '"></div>' +
        '<div class="field"><label>日期</label><input type="text" id="pg-date" value="' + esc(p.meta.date || '') + '"></div>' +
        '<div class="field"><label>横幅 top_img</label><input type="text" id="pg-top" value="' + esc(p.meta.top_img || '') + '"></div>' +
      '</div>' +
      '<div class="ed-body"><div class="ed-src"><textarea id="pg-md">' + esc(p.body) + '</textarea></div>' +
      '<div class="ed-prev" id="pg-prev"></div></div></div>';
    cmInstance = CodeMirror.fromTextArea($('#pg-md'), { mode: 'markdown', theme: 'material-darker', lineWrapping: true, lineNumbers: true });
    const prev = () => { $('#pg-prev').innerHTML = marked.parse(cmInstance.getValue() || ''); };
    cmInstance.on('change', () => { clearTimeout(openPage._t); openPage._t = setTimeout(prev, 200); });
    prev();
    $('#pg-save').onclick = async () => {
      try {
        await api('/api/pages/' + encodeURIComponent(name), {
          method: 'PUT',
          body: { meta: { title: $('#pg-title').value.trim(), date: $('#pg-date').value.trim(), top_img: $('#pg-top').value.trim() }, body: cmInstance.getValue() }
        });
        toast('已保存');
      } catch (e) { toast(e.message, true); }
    };
  } catch (e) { toast(e.message, true); }
}

/* ---------------- 媒体库 ---------------- */

async function renderMedia() {
  setHeader('媒体库', '上传 / 删除图片，头像与横幅可一键替换', [
    { label: '上传图片', cls: 'btn-primary', onClick: () => pickFiles('media') }
  ]);
  try {
    const files = await api('/api/media');
    const feats = await api('/api/features');
    content.innerHTML =
      '<div class="grid grid-2">' +
        '<div class="card"><h3 class="section-title">头像</h3><div class="row" style="align-items:center">' +
          '<img src="' + esc(feats.avatar || '/img/avatar.png') + '" style="flex:0 0 auto;width:72px;height:72px;border-radius:50%;object-fit:cover;background:#0c0c0f">' +
          '<button class="btn" id="up-avatar">上传头像</button>' +
          '<span class="hint">' + esc(feats.avatar) + '</span>' +
        '</div></div>' +
        '<div class="card"><h3 class="section-title">横幅</h3><div class="row" style="align-items:center">' +
          '<div style="flex:0 0 auto;width:140px;height:72px;border-radius:10px;background:url(\'' + esc(feats.banner || '/img/banner.jpg') + '\') center/cover"></div>' +
          '<button class="btn" id="up-banner">上传横幅</button>' +
          '<span class="hint">index_img / default_top_img</span>' +
        '</div></div>' +
      '</div>' +
      '<div class="media-grid" style="margin-top:16px">' +
        '<div class="media-upload" id="upload-tile"><div style="font-size:26px">＋</div><div>点击上传图片</div><div class="hint">支持多选，最大 20MB</div></div>' +
        files.map(f => '<div class="media-item">' +
          '<div class="thumb" style="background-image:url(\'' + esc(f.url) + '\')"></div>' +
          '<div class="meta"><b>' + esc(f.name) + '</b>' + fmtSize(f.size) + '</div>' +
          '<div class="ops"><button class="btn btn-sm" data-copy="' + esc(f.url) + '">复制路径</button>' +
          '<button class="btn btn-sm btn-danger" data-rm="' + esc(f.name) + '">删除</button></div></div>').join('') +
      '</div>';
    $('#upload-tile').onclick = () => pickFiles('media');
    $('#up-avatar').onclick = () => pickFiles('avatar');
    $('#up-banner').onclick = () => pickFiles('banner');
    content.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
      navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy);
      toast('已复制 ' + b.dataset.copy);
    });
    content.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      if (!confirm('删除 ' + b.dataset.rm + '？')) return;
      try { await api('/api/media/' + encodeURIComponent(b.dataset.rm), { method: 'DELETE' }); toast('已删除'); renderMedia(); }
      catch (e) { toast(e.message, true); }
    });
  } catch (e) { content.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}

function pickFiles(kind) {
  const input = $('#hidden-file');
  input.value = '';
  input.multiple = kind === 'media';
  input.onchange = async () => {
    if (!input.files.length) return;
    const fd = new FormData();
    if (kind === 'media') {
      Array.from(input.files).forEach(f => fd.append('files', f));
      try { await api('/api/media', { method: 'POST', body: fd }); toast('上传完成'); renderMedia(); }
      catch (e) { toast(e.message, true); }
    } else {
      fd.append('file', input.files[0]);
      try { await api(kind === 'avatar' ? '/api/avatar' : '/api/banner', { method: 'POST', body: fd }); toast('已替换'); renderMedia(); }
      catch (e) { toast(e.message, true); }
    }
  };
  input.click();
}

/* ---------------- 组件与个性化 ---------------- */

async function renderFeatures() {
  setHeader('组件与个性化', '头像、签名、公告、特效开关、音乐与看板娘', [
    { label: '保存设置', cls: 'btn-primary', onClick: saveFeatures }
  ]);
  try {
    const f = await api('/api/features');
    const toggle = (key, name, desc) =>
      '<div class="toggle-row"><div><div class="name">' + name + '</div><div class="desc">' + desc + '</div></div>' +
      '<label class="switch"><input type="checkbox" data-toggle="' + key + '"' + (f.toggles[key] ? ' checked' : '') + '><span></span></label></div>';
    content.innerHTML =
      '<div class="grid grid-2">' +
        '<div class="card"><h3 class="section-title">站点</h3>' +
          '<div class="field"><label>站点标题</label><input id="ft-title" value="' + esc(f.siteTitle) + '"></div>' +
          '<div class="field"><label>我的签名（作者卡片描述）</label><textarea id="ft-sign">' + esc(f.signature) + '</textarea></div>' +
          '<div class="field"><label>公告内容（支持 HTML）</label><textarea id="ft-ann" style="min-height:110px">' + esc(f.announcement) + '</textarea></div>' +
        '</div>' +
        '<div class="card"><h3 class="section-title">特效开关</h3>' +
          toggle('click_heart', '点击爱心', '鼠标点击处出现爱心') +
          toggle('canvas_ribbon', '背景飘带', '动态彩带背景') +
          toggle('activate_power_mode', '打字粒子', '输入时粒子特效') +
          toggle('fireworks', '点击烟花', '点击出现烟花（与爱心二选一）') +
          toggle('preloader', '加载动画', '进入页面时的加载动画') +
          toggle('darkmode', '夜间模式按钮', '右上角切换按钮') +
        '</div>' +
      '</div>' +
      '<div class="grid grid-2" style="margin-top:16px">' +
        '<div class="card"><h3 class="section-title">音乐播放器</h3>' +
          '<div class="field"><label>网易云歌单 ID</label><input id="ft-music" value="' + esc(f.musicId) + '"></div>' +
          '<div class="hint">当前歌单：https://music.163.com/#/playlist?id=' + esc(f.musicId) + '</div>' +
        '</div>' +
        '<div class="card"><h3 class="section-title">Live2D 看板娘</h3>' +
          '<div class="field"><label>模型路径</label><input id="ft-model" value="' + esc(f.live2dModel) + '"></div>' +
          '<div class="hint">把模型放进 source/live2d/models/&lt;名字&gt;/，然后填 .../&lt;名字&gt;.model.json</div>' +
        '</div>' +
      '</div>';
  } catch (e) { content.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}

async function saveFeatures() {
  const toggles = {};
  content.querySelectorAll('[data-toggle]').forEach(c => { toggles[c.dataset.toggle] = c.checked; });
  try {
    await api('/api/features', {
      method: 'PUT',
      body: {
        siteTitle: $('#ft-title').value.trim(),
        signature: $('#ft-sign').value,
        announcement: $('#ft-ann').value,
        toggles,
        musicId: $('#ft-music').value.trim(),
        live2dModel: $('#ft-model').value.trim()
      }
    });
    toast('已保存');
  } catch (e) { toast(e.message, true); }
}

/* ---------------- 配置文件 ---------------- */

function getIn(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setIn(obj, path, val) {
  const keys = String(path).split('.');
  let o = obj;
  keys.slice(0, -1).forEach(k => { o = o[k] = o[k] || {}; });
  o[keys[keys.length - 1]] = val;
}

async function renderConfig(name) {
  const isSite = name === 'site';
  setHeader(isSite ? '站点配置' : '主题配置', isSite ? '_config.yml' : '_config.butterfly.yml', []);
  try {
    const data = await api('/api/config/' + name);
    const parsed = await api('/api/config/' + name + '/parsed');
    const fields = isSite ? [
      ['title', '站点标题', 'text'], ['subtitle', '副标题', 'text'], ['description', '描述', 'text'],
      ['keywords', '关键词', 'text'], ['author', '作者', 'text'], ['language', '语言', 'text'],
      ['timezone', '时区', 'text'], ['url', '站点地址', 'text'], ['permalink', '链接格式', 'text']
    ] : [
      ['avatar.img', '头像', 'text'], ['index_img', '首页横幅', 'text'], ['default_top_img', '默认横幅', 'text'],
      ['display_mode', '默认模式（light/dark）', 'text'], ['darkmode.enable', '夜间模式', 'bool'],
      ['code_blocks.theme', '代码主题', 'text'], ['index_post_content.method', '首页摘要方式', 'text'],
      ['search.use', '搜索方式', 'text'], ['aside.card_author.description', '作者签名', 'text']
    ];
    content.innerHTML =
      '<div class="tabs"><div class="tab active" data-tab="form">常用表单</div><div class="tab" data-tab="raw">原始 YAML（全量）</div></div>' +
      '<div id="tab-form"><div class="card"><div class="grid grid-2">' +
      fields.map(([p, label, type]) => {
        const v = getIn(parsed, p);
        if (type === 'bool') {
          return '<div class="field"><label>' + label + '</label><select data-path="' + p + '">' +
            '<option value="true"' + (v === true ? ' selected' : '') + '>开启</option>' +
            '<option value="false"' + (v === false ? ' selected' : '') + '>关闭</option></select></div>';
        }
        return '<div class="field"><label>' + label + ' <span class="hint">' + p + '</span></label>' +
          '<input type="text" data-path="' + p + '" value="' + esc(v == null ? '' : v) + '"></div>';
      }).join('') +
      '</div><div class="divider"></div><button class="btn btn-primary" id="cfg-save">保存表单</button> ' +
      '<span class="hint">只改上面这些字段，其余原样保留（注释不丢）</span></div></div>' +
      '<div id="tab-raw" style="display:none"><div class="card"><textarea id="cfg-raw">' + esc(data.content) + '</textarea>' +
      '<div class="divider"></div><button class="btn btn-primary" id="raw-save">写入整个文件</button> ' +
      '<span class="hint">在这里可以改任何一项（会覆盖整个文件）</span></div></div>';
    content.querySelectorAll('.tab').forEach(t => t.onclick = () => {
      content.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
      $('#tab-form').style.display = t.dataset.tab === 'form' ? '' : 'none';
      $('#tab-raw').style.display = t.dataset.tab === 'raw' ? '' : 'none';
    });
    $('#cfg-save').onclick = async () => {
      try {
        const inputs = content.querySelectorAll('[data-path]');
        for (const el of inputs) {
          const p = el.dataset.path;
          let v = el.value;
          if (el.tagName === 'SELECT') v = v === 'true';
          await api('/api/config/' + name + '/patch', { method: 'POST', body: { path: p, value: v } });
        }
        toast('已保存');
      } catch (e) { toast(e.message, true); }
    };
    const rawCm = CodeMirror.fromTextArea($('#cfg-raw'), { mode: 'yaml', theme: 'material-darker', lineWrapping: true, lineNumbers: true });
    $('#raw-save').onclick = async () => {
      try {
        await api('/api/config/' + name, { method: 'PUT', body: { content: rawCm.getValue() } });
        toast('已写入');
      } catch (e) { toast(e.message, true); }
    };
  } catch (e) { content.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}

/* ---------------- 插件 ---------------- */

async function renderPlugins() {
  setHeader('插件', 'npm 依赖管理（Hexo 插件、渲染器、生成器）', []);
  try {
    const list = await api('/api/plugins');
    content.innerHTML =
      '<div class="card"><h3 class="section-title">安装插件</h3><div class="row">' +
      '<input id="pkg-name" placeholder="例如 hexo-generator-searchdb"><button class="btn btn-primary" id="pkg-install">安装</button></div>' +
      '<div class="hint" style="margin-top:8px">安装后如需启用，可能还要改 _config.yml 或主题配置</div></div>' +
      '<div class="card" style="margin-top:16px"><h3 class="section-title">已安装（' + list.length + '）</h3>' +
      '<table class="table"><thead><tr><th>包名</th><th>版本</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
      list.map(p => '<tr><td>' + esc(p.name) + '</td><td class="muted">' + esc(p.version) + '</td>' +
        '<td><div class="ops"><button class="btn btn-sm btn-danger" data-uninstall="' + esc(p.name) + '">卸载</button></div></td></tr>').join('') +
      '</tbody></table></div>' +
      '<pre class="log empty" id="pkg-log" style="margin-top:16px">操作日志会显示在这里</pre>';
    $('#pkg-install').onclick = async () => {
      const name = $('#pkg-name').value.trim();
      if (!name) return;
      const log = $('#pkg-log');
      await runStream('/api/run', { action: 'install', name }, log);
      toast('安装流程结束'); renderPlugins();
    };
    content.querySelectorAll('[data-uninstall]').forEach(b => b.onclick = async () => {
      if (!confirm('卸载 ' + b.dataset.uninstall + '？')) return;
      const log = $('#pkg-log');
      await runStream('/api/run', { action: 'uninstall', name: b.dataset.uninstall }, log);
      toast('卸载流程结束'); renderPlugins();
    });
  } catch (e) { content.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}

/* ---------------- 构建与发布 ---------------- */

async function renderPublish() {
  setHeader('构建与发布', '本地预览、生成静态文件、推送到 GitHub', []);
  content.innerHTML =
    '<div class="grid grid-3">' +
      '<div class="card"><h3 class="section-title">本地预览</h3><p class="hint">启动 hexo server，浏览器打开 4000 端口</p>' +
        '<div class="row" style="margin-top:10px"><button class="btn btn-primary" id="pv-start">启动</button>' +
        '<button class="btn" id="pv-stop">停止</button><a class="btn" href="http://localhost:4000" target="_blank">打开</a></div></div>' +
      '<div class="card"><h3 class="section-title">构建</h3><p class="hint">hexo clean + generate，输出到 public/</p>' +
        '<div class="row" style="margin-top:10px"><button class="btn btn-primary" id="do-build">开始构建</button></div></div>' +
      '<div class="card"><h3 class="section-title">发布</h3><p class="hint">git add / commit / push，Cloudflare 自动部署</p>' +
        '<div class="row" style="margin-top:10px"><button class="btn btn-primary" id="do-push">推送上线</button></div></div>' +
    '</div>' +
    '<pre class="log empty" id="run-log" style="margin-top:16px">操作日志会显示在这里</pre>';

  $('#pv-start').onclick = async () => {
    try { const r = await api('/api/preview/start', { method: 'POST' }); toast('已启动 ' + r.url); }
    catch (e) { toast(e.message, true); }
  };
  $('#pv-stop').onclick = async () => {
    try { await api('/api/preview/stop', { method: 'POST' }); toast('已停止'); }
    catch (e) { toast(e.message, true); }
  };
  $('#do-build').onclick = () => runStream('/api/run', { action: 'build' }, $('#run-log'));
  $('#do-push').onclick = () => runStream('/api/run', { action: 'push' }, $('#run-log'));
}

async function runStream(url, body, logEl) {
  logEl.classList.remove('empty');
  logEl.textContent = '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok || !res.body) { logEl.textContent = '请求失败：HTTP ' + res.status; return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      logEl.textContent += dec.decode(value, { stream: true });
      logEl.scrollTop = logEl.scrollHeight;
    }
  } catch (e) { logEl.textContent += '\n错误：' + e.message; }
}

/* ---------------- 启动 ---------------- */

window.navigate = navigate;
navigate('overview');
