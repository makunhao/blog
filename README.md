# makunhao 的博客

基于 **Hexo 8.1.2 + Butterfly 5.7.2** 的静态博客，风格参考了常见的安全类个人博客：深色模式、全屏横幅、右侧个人卡片 / 公告 / 最新文章、文章目录、本地搜索、字数统计。

主题来自开源项目 [jerryc127/hexo-theme-butterfly](https://github.com/jerryc127/hexo-theme-butterfly)（GitHub 8.3k+ Star，持续维护），本项目只做了配置和内容层面的定制，没有改动主题源码。

## 环境要求

- Node.js 20.19 及以上（推荐安装 [LTS 版本](https://nodejs.org/zh-cn)）
- npm（随 Node.js 一起安装）

## 本地运行

双击 **`启动预览.bat`** 即可（首次运行会自动安装依赖，之后直接启动）。

或手动执行：

```bash
npm install
npx hexo server
```

然后浏览器打开 <http://localhost:4000>。

## 写文章

```bash
npx hexo new post "文章标题"
```

文件会生成在 `source/_posts/` 下，用任意 Markdown 编辑器编写即可。保存后刷新浏览器就能看到（`hexo server` 会热更新）。

`source/_posts/emergency-response-writeup-template.md` 是一篇现成的 WriteUp 写作模板，包含「现象 → 排查 → 处置 → 复盘」结构和代码块、表格、提示框示例，可以直接复制修改。

文章头部字段说明：

```yaml
---
title: 文章标题
date: 2026-11-27 16:30:00
updated: 2026-11-27 16:30:00
categories:
  - 原创
  - 网络安全
tags:
  - 靶场
  - 应急响应
top_img: /img/banner.jpg   # 文章页顶部横幅
cover: /img/banner.jpg     # 首页卡片封面
description: 首页卡片上显示的摘要
---
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npx hexo server` | 本地预览（localhost:4000） |
| `npx hexo new post "标题"` | 新建文章 |
| `npx hexo new page "名称"` | 新建页面 |
| `npx hexo generate` | 生成静态文件到 `public/` |
| `npx hexo clean` | 清理缓存和 `public/` |

`生成静态文件.bat` 就是执行 `hexo generate` 的快捷方式。

## 目录说明

```text
blog/
├── _config.yml             # 站点配置：标题、作者、网址、permalink
├── _config.butterfly.yml   # 主题配置：菜单、头像、横幅、侧边栏、夜间模式
├── scaffolds/              # 新建文章/页面的模板
├── source/
│   ├── _posts/             # 文章（Markdown）
│   ├── about/              # 关于我页面
│   ├── about-site/         # 关于本站页面
│   ├── link/               # 友链页面
│   ├── messageboard/       # 留言板页面
│   ├── css/custom.css      # 自定义样式
│   └── img/                # 头像、横幅、favicon 等素材
├── public/                 # 已生成的静态站点（可直接部署）
└── package.json
```

## 改哪里

- **站点标题 / 作者 / 网址**：`_config.yml` 顶部
- **导航菜单**：`_config.butterfly.yml` 的 `menu` 段（支持二级菜单）
- **头像 / 横幅 / 图标**：替换 `source/img/` 下的 `avatar.png`、`banner.jpg`、`favicon.png`
- **个人卡片 / 公告**：`_config.butterfly.yml` 的 `aside.card_author`、`aside.card_announcement`
- **夜间模式**：已设为默认深色（`display_mode: dark`），右上角可切换
- **自定义样式**：`source/css/custom.css`

### 文章里的「AI 摘要」卡片

样式已内置在 `custom.css`，在文章开头粘贴以下 HTML 即可（内容自己写）：

```html
<div class="ai-summary">
  <div class="ai-summary-head"><span class="emoji">🤖</span> AI 摘要 <span class="tag">TLDR</span></div>
  <div class="ai-summary-body">这里写摘要内容。</div>
</div>
```


## 个性化组件

| 组件 | 位置 | 说明 |
| --- | --- | --- |
| Live2D 看板娘 | `source/live2d/` | 本地资源，模型是 hijiki；换模型改 `waifu-tips.json` 里的 `models` 路径 |
| 悬浮音乐播放器 | `source/js/music.js` | APlayer + Meting 接口，歌单改 `API` 里的 `id`（网易云歌单 ID） |
| 问候语 / 每日一言 / 时间进度 | `source/js/fancy.js` | 纯前端实现，每日一言来自 hitokoto |
| IP 属地与距离 | `worker.js` | Cloudflare Worker 的 `/api/geo` 读取请求地理信息；本地预览时该项自动隐藏 |
| 点击爱心 / 背景飘带 | `_config.butterfly.yml` | `click_heart`、`canvas_ribbon`，可自行关闭 |

注意：看板娘和播放器在手机端自动隐藏；音乐依赖第三方 Meting 接口（`api.i-meto.com`），接口不可用时会自动隐藏播放器。


## 本地管理后台（admin/）

双击 **`启动管理台.bat`**，浏览器打开 <http://localhost:5173>（首次会自动安装后台依赖）。

功能：

- **概览**：文章/草稿/图片数量、当前分支与最近提交
- **文章**：新建、编辑、删除；封面/横幅/摘要/分类/标签；Markdown 编辑 + 实时预览；Ctrl+S 保存
- **分类**：文章编辑页用标签选择分类（可新建层级分类，如「技术/网络」）；侧边栏「分类」页可批量重命名、删除，自动同步所有文章
- **页面**：关于、友链、留言板等独立页面
- **媒体库**：批量上传、删除、复制路径；一键替换头像和横幅（浏览器端自动压缩：头像 400×400、横幅 1920 宽 JPEG，避免超过 Cloudflare Workers 20MiB 静态资源上限）
- **组件与个性化**：点击爱心/飘带/打字粒子/烟花/加载动画/夜间模式开关，签名、公告、歌单 ID、Live2D 模型路径
- **站点配置**：常用字段表单 + `_config.yml` 原始 YAML 全量编辑
- **主题配置**：常用字段表单 + `_config.butterfly.yml` 原始 YAML 全量编辑（任何一项都能改，改动会保留注释）
- **插件**：查看已装 npm 依赖、安装/卸载（Hexo 插件、渲染器、生成器）
- **构建与发布**：启动/停止本地预览、`hexo generate`、`git push`，实时输出日志

安全说明：后台只监听 `127.0.0.1`，不要改成 `0.0.0.0`；写配置/页面前会自动备份到 **`D:\blog\backups\`**（保留最近 30 份，文件名带时间戳）。`admin/` 目录不参与 Hexo 构建，也不会部署到线上。

### 空文章时的首页

文章全部删除后，Hexo 不会生成 `index.html`。`scripts/ensure-index.js` 会在构建结束时检查，缺失就自动写一个简洁的「暂无文章」首页，因此删光文章也不会 404。

### 构建体积

`npm run build` 会在生成后执行 `tools/prune-assets.js`，删除 `pluginsSrc` 里未使用的第三方库（mermaid、mathjax、评论系统、docsearch 等），当前产物约 3.3MB。如果以后启用了评论、数学公式、Mermaid 图表等功能，请把对应的库从脚本的 `KEEP` 列表里放行（脚本默认删除白名单之外的一切）。

## 部署到 Cloudflare Pages

1. 把项目推到 GitHub（`node_modules/`、`public/`、`db.json` 已在 `.gitignore` 中排除）；
2. Cloudflare 控制台 → Workers & Pages → 创建 Pages 项目 → 连接该仓库；
3. 构建命令填 `npm run build`，部署命令 `npx wrangler deploy`（仓库已带 `wrangler.jsonc` 和 `worker.js`，静态资源绑定为 `ASSETS`）；
4. 每次 `git push` 自动构建部署；
5. 在 Pages 项目的「自定义域」中添加 `makunhao.cn` / `blog.makunhao.cn`，按提示在域名服务商处配置 DNS。

也可以直接把 `public/` 目录上传到任意静态托管（阿里云 OSS、腾讯云 COS、Vercel 等）。

## 后续可以加的功能

- **评论**：推荐 Twikoo（Vercel 一键部署）或 Waline，在 `_config.butterfly.yml` 的 `comments` 中开启；
- **音乐播放器 / AI 聊天按钮 / FPS 显示**：参考站里的这些是作者自己注入的第三方组件，需要时可按需引入；
- **访问统计**：不蒜子默认关闭（第三方服务不稳定），可换 Umami / Cloudflare Analytics。

## 说明

> 若 Cloudflare 控制台只提供 Workers 流程，仓库已内置 `wrangler.jsonc`，可直接用默认的 `npm run build` + `npx wrangler deploy` 部署。

站内示例文章与页面均为占位内容，发布前请替换为自己的信息。渗透、应急响应类内容仅限授权环境与学习用途。