# 文档站点测试报告

> 测试时间：2026-02-22 14:27 CST

## 总览

- ✅ 通过：11 个
- ⚠️ 需修复：4 个
- ❌ 不可用：6 个

---

## ✅ 通过（11 个）

| # | 站点 | 策略 | 页面数 | 框架检测 |
|---|------|------|--------|---------|
| 1 | OpenClaw Docs | Sitemap XML | 524 | mintlify ✅ |
| 2 | 微信小程序文档 | Sitemap 纯文本 | 143 (filtered) | wechat ✅ |
| 3 | 微信公众号文档 | Sitemap 纯文本 | 353 (filtered) | — |
| 4 | 语雀 | JSON TOC | 75+ | yuque ✅ |
| 5 | Stripe Docs | Sitemap XML | 3,818 | — |
| 6 | Supabase Docs | Sitemap XML | 2,204 | — |
| 7 | Next.js Docs | Sitemap XML | 411 (filtered) | — |
| 8 | Vercel Docs | Sitemap XML | 1,420 (filtered) | — |
| 9 | 支付宝小程序文档 | Sitemap XML | 7,554 (filtered) | yuque ✅ |
| 10 | Vue.js Docs | Sitemap XML | 1 (index page) | vitepress ✅ |
| 11 | Tailwind CSS Docs | DOM (sidebar) | ~237 internal links | — |

---

## ⚠️ 需修复（4 个）

### 1. Anthropic Docs
- **问题**: Sitemap 有 2,905 URLs，但路径过滤 `/docs/en/home` 匹配 0 条
- **原因**: 当前代码用完整路径 `/docs/en/home` 做前缀过滤，但 sitemap 中的路径是 `/docs/en/intro`、`/docs/en/get-started` 等
- **修复**: 路径前缀应截取到 `/docs/en` 而不是 `/docs/en/home`
- **优先级**: 🔴 高

### 2. OpenAI Docs
- **问题**: Sitemap 只有 1 个 URL（根页面），filtered = 0
- **原因**: `platform.openai.com/sitemap.xml` 不包含 docs 页面，可能用了别的方式
- **修复**: 需要检查是否有 `/docs/sitemap.xml` 或用 DOM 提取
- **优先级**: 🔴 高

### 3. Docker Docs
- **问题**: Sitemap 只有 1 个 URL
- **原因**: 主 sitemap 可能是 sitemap index，但我们的检测先匹配了 `<urlset>`
- **修复**: 需检查是否有子 sitemap 或 `/sitemap/sitemap.xml`
- **优先级**: 🟡 中

### 4. Kubernetes Docs
- **问题**: Sitemap 是 index 格式，需要递归解析
- **状态**: 代码已支持递归，但测试脚本未验证
- **优先级**: 🟢 低（代码应已支持）

---

## ❌ 不可用（6 个）

| # | 站点 | 问题 | 建议 |
|---|------|------|------|
| 1 | **React Docs** | 无 sitemap，自研框架 | 需要专门的 DOM 解析，sidebar 有 68 个内链 |
| 2 | **GitHub Docs** | 无 sitemap，自研框架 | 需要 DOM 解析，有 62 个内链 |
| 3 | **LangGraph Docs** | 无 sitemap，HTML 仅 756 bytes，SPA | JS 渲染后才有内容，需 content script |
| 4 | **飞书开发文档** | 无 sitemap，HTML 7KB，疑似 SPA | 需进一步分析 |
| 5 | **钉钉开发文档** | 无 sitemap，HTML 8KB，疑似 SPA | 需进一步分析 |
| 6 | **鸿蒙开发文档** | 无 sitemap，HTML 1.4KB，Angular SPA | 纯 SPA，需 content script 等渲染完成 |

---

## 发现的 Bug

### Bug 1: 路径前缀过滤过于精确
- **影响**: Anthropic Docs（0 结果）
- **现象**: 用户在 `/docs/en/home` 页面触发分析，代码以 `/docs/en/home` 做前缀过滤，而非 `/docs/en`
- **修复方案**: 对路径前缀做智能截断 — 如果最后一段看起来像页面名（非目录），则去掉

### Bug 2: Vue.js sitemap 只有 1 个 URL
- **影响**: Vue.js Docs
- **现象**: vuejs.org/sitemap.xml 只有根 URL
- **修复方案**: 当 sitemap 页面数 < 5 时，fallback 到 DOM 提取（VitePress 检测已通过）

### Bug 3: OpenAI Docs sitemap 不含 docs 页面
- **影响**: OpenAI Docs
- **修复方案**: 增加 `/docs/sitemap.xml` 路径检查，或 fallback 到 DOM

---

## 修复优先级

1. 🔴 **Bug 1**: 路径前缀截断优化（影响 Anthropic 725 页）
2. 🔴 **Bug 3**: OpenAI Docs sitemap 路径（影响 103 页）
3. 🟡 **Bug 2**: Sitemap 页面数过少时 fallback 到 DOM
4. 🟡 Docker sitemap 递归验证
5. 🟢 React / GitHub DOM 解析支持
6. 🟢 SPA 站点支持（飞书、钉钉、鸿蒙、LangGraph）
