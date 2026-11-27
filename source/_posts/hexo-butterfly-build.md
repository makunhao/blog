---
title: Hexo + Butterfly 博客搭建记录
date: 2026-11-27 16:30:00
updated: 2026-11-27 16:30:00
categories:
  - 原创
  - 折腾日记
tags:
  - Hexo
  - Butterfly
  - 博客
top_img: /img/banner.jpg
cover: /img/banner.jpg
description: 记录用 Hexo 8 + Butterfly 5 搭建个人博客的全过程：选型、初始化、主题配置、本地预览与部署。
---

<div class="ai-summary">
  <div class="ai-summary-head"><span class="emoji">🤖</span> AI 摘要 <span class="tag">TLDR</span></div>
  <div class="ai-summary-body">本文记录了使用 Hexo 8 与 Butterfly 5 主题搭建个人博客的完整过程，涵盖技术选型、项目初始化、主题安装与核心配置、本地预览，以及部署到 Cloudflare Pages 的步骤。</div>
</div>

## 1. 技术选型

静态博客里 Hexo 生态最成熟、主题最多。在 GitHub 上按 Star 排序对比了几个主流主题：

| 主题 | Star | 最近更新 | 特点 |
| --- | --- | --- | --- |
| hexo-theme-butterfly | 8.3k | 持续更新 | 卡片式 UI、功能齐全、中文文档完善 |
| hexo-theme-fluid | 8.1k | 持续更新 | Material Design 风格 |
| hexo-theme-next | 8.2k | 维护放缓 | 老牌简洁 |

最终选择 **Butterfly**：深色模式、右侧个人信息卡片、文章目录、本地搜索、字数统计等功能开箱即用，配置项也覆盖得足够细。

## 2. 初始化项目

```bash
npm init -y
npm install hexo@8 hexo-cli hexo-theme-butterfly
```

Hexo 项目的基本目录结构：

```text
blog/
├── _config.yml           # 站点配置
├── _config.butterfly.yml # 主题覆盖配置
├── source/
│   ├── _posts/           # 文章（Markdown）
│   └── img/              # 图片素材
└── package.json
```

## 3. 主题配置要点

主题配置只需要写要覆盖的项，Hexo 会把它与主题自带的 `_config.yml` 深度合并：

```yaml
menu:
  文章: /archives/ || fas fa-book-open
  友链: /link/ || fas fa-link

darkmode:
  enable: true
  autoChangeMode: false

display_mode: dark
```

{% note blue 'fas fa-lightbulb' %}
提示：改配置后记得重启 `hexo server`，部分配置（如菜单、头像）不会热更新。
{% endnote %}

## 4. 本地预览

```bash
npx hexo server
```

浏览器打开 `http://localhost:4000` 即可预览。写文章的流程：

```bash
npx hexo new post "文章标题"
npx hexo generate   # 生成静态文件到 public/
```

## 5. 部署上线

把仓库推到 GitHub 后，在 Cloudflare Pages 里连接仓库，构建命令填 `npx hexo generate`，输出目录填 `public`，之后每次 push 都会自动构建部署。

绑定自定义域名时，在 Cloudflare Pages 的「自定义域」里添加域名，再按提示配置 DNS 即可。

{% note green 'fas fa-check' %}
整个流程的产物都是纯静态文件，托管费用为零，配合免费 HTTPS 足够个人博客长期使用。
{% endnote %}
