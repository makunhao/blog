---
title: 知攻善防实验室 8 个应急响应靶机 WriteUp（模板）
date: 2026-11-20 21:00:00
updated: 2026-11-27 10:00:00
categories:
  - 原创
  - 网络安全
tags:
  - 渗透
  - 靶场
  - 应急响应
top_img: /img/banner.jpg
cover: /img/banner.jpg
description: 8 台应急响应靶机的排查过程记录模板，可作为后续 WriteUp 的写作框架。
---

<div class="ai-summary">
  <div class="ai-summary-head"><span class="emoji">🤖</span> AI 摘要 <span class="tag">TLDR</span></div>
  <div class="ai-summary-body">本文是应急响应靶机 WriteUp 的写作模板，按「现象 → 排查 → 处置 → 复盘」组织每台靶机的记录，并给出代码块、表格、提示框等常用排版示例。</div>
</div>

> 这是一篇 **写作模板**：结构、排版、代码块、提示框都可以直接套用，把占位内容替换成真实排查记录即可。

## 1. 靶场下载

（填写靶场获取方式、镜像版本、下载地址等信息）

{% note warning 'fas fa-triangle-exclamation' %}
只在本地或授权环境中操作；靶机镜像不要直接暴露在公网。
{% endnote %}

## 2. 环境说明

| 靶机 | 操作系统 | 关键服务 | 初始现象 |
| --- | --- | --- | --- |
| Web1 | （填写） | （填写） | （填写） |
| Web2 | （填写） | （填写） | （填写） |

## 3. 靶机一：Web 服务器应急

### 3.1 现象描述

（填写发现的问题，例如页面被篡改、异常进程、异常外连等）

### 3.2 排查过程

先看监听端口和进程：

```bash
netstat -ano | findstr LISTENING
tasklist /svc
```

再看计划任务和启动项：

```bash
schtasks /query /fo LIST /v
reg query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run
```

### 3.3 处置与加固

（填写清除、封禁、补丁、账号处置等操作）

### 3.4 复盘

（填写根因分析与改进措施）

## 4. 靶机二：Linux 主机应急

### 4.1 现象描述

（填写）

### 4.2 排查过程

```bash
ps aux --sort=-%cpu | head -20
ss -antp
crontab -l
```

### 4.3 处置与加固

（填写）

## 5. 总结

（汇总共性失陷原因：弱口令、未打补丁、暴露管理端口等，并给出加固清单。）
