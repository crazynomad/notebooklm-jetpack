# Substack 内容提取优化 — 设计文档

## 背景

Substack 是英文互联网最重要的独立创作平台之一，被称为"海外微信公众号"。NotebookLM 的 Fast Research 频繁发现 Substack 文章，但导入质量参差不齐：

- 部分文章被 NotebookLM 服务端拒绝（反爬）→ 由 **rescue（抢救）** 功能处理
- 通过我们 fetch 拿到的 HTML，Turndown 转换时包含大量噪音 → 本文档解决此问题

## 问题分析

### 样本研究

分析了三篇不同类型的 Substack 文章：

| 文章 | 大小 | Paywall | 文章/噪音比 |
|------|------|---------|------------|
| [Aella - Dance Music & IQ](https://aella.substack.com/p/what-your-favorite-dance-music-says) | 518KB | ✅ 有（部分免费） | 优化前 96% |
| [Ruben - AI-holic](https://ruben.substack.com/p/ai-holic) | 224KB | ❌ 无 | 优化前 80% |
| [Patrick - Every Grammys Ever](https://patrickhicks.substack.com/p/every-grammys-ever) | 318KB | ❌ 无 | 优化前 90% |

### 噪音来源

优化前，Turndown 转换结果中包含的非正文内容：

1. **Subscribe 按钮**（2-6 处）— "Subscribe" / "Get more from..."
2. **Like / Share 按钮** — 心形按钮、分享对话框
3. **评论区入口** — "Comments" / 评论列表
4. **推荐文章** — 底部推荐、侧边栏
5. **导航按钮** — "Previous" / "Next"
6. **Paywall 引导**（付费文章）— "Continue reading this post for free" / "Claim my free post" / "purchase a paid subscription"
7. **Footer** — "© 2026 Author · Privacy ∙ Terms ∙ Collection notice" / "Start your Substack" / "Get the app"

### 根因

优化前的 offscreen Turndown 配置有两个缺陷：

**缺陷一：内容选择器不精确**

```
优化前：article → 捕获整个 <article>，包含 header、footer、按钮等全部内容
优化后：.available-content .body.markup → 精准定位正文区域
```

**缺陷二：缺少 Substack 噪音清理**

`REMOVE_SELECTORS` 中没有任何 Substack 相关的选择器，所有 UI 组件都被 Turndown 转为 Markdown 文本。

## Substack HTML 结构

所有 Substack 文章共享统一模板：

```html
<article class="single-post">
  ┌─ post-header ──────────────────────────────┐
  │  <h1 class="post-title">文章标题</h1>       │
  │  <h3 class="subtitle">副标题</h3>           │
  │  <div class="post-meta">作者 · 日期</div>   │
  └────────────────────────────────────────────┘
  
  ┌─ available-content ─── 【我们提取这里】 ────┐
  │  ┌─ body markup ──────────────────────────┐ │
  │  │  <p>正文段落</p>                        │ │
  │  │  <figure>                               │ │
  │  │    <img src="..." />                    │ │
  │  │    <figcaption>图片说明</figcaption>     │ │
  │  │  </figure>                              │ │
  │  │  <h2>小标题</h2>                        │ │
  │  │  <blockquote>引用</blockquote>          │ │
  │  │  <pre><code>代码块</code></pre>         │ │
  │  └────────────────────────────────────────┘ │
  └────────────────────────────────────────────┘
  
  ┌─ paywall ──── 【丢弃：付费墙之后】 ────────┐
  │  data-testid="paywall"                      │
  │  订阅引导、CTA 按钮                          │
  └────────────────────────────────────────────┘
  
  ┌─ post-footer ──── 【丢弃：噪音】 ──────────┐
  │  like-button-container                      │
  │  subscribe-widget                           │
  │  comments-section                           │
  │  recommendation-container                   │
  │  Previous / Next 导航                       │
  └────────────────────────────────────────────┘
</article>
```

## 优化方案

### 1. 内容选择器（CONTENT_SELECTORS）

新增 Substack 专用选择器，优先级高于通用 `article`：

```typescript
const CONTENT_SELECTORS = [
  '.devsite-article-body',
  // Substack — 优先精准匹配
  '.available-content .body.markup',  // 最精准：正文区域
  '.available-content',               // 次之：包含正文的容器
  '.body.markup',                     // 兜底：正文 class
  // 通用
  '.markdown-body',
  'article [itemprop="articleBody"]',
  'article',                          // 之前 Substack 走这里
  // ...
];
```

### 2. 噪音元素移除（REMOVE_SELECTORS）

新增 Substack 相关的 DOM 元素移除：

```typescript
// Substack 噪音
'[data-testid="paywall"]',           // Paywall 边界及内容
'.subscription-widget-wrap',          // 订阅组件
'.subscribe-widget',                  // 订阅按钮
'.subscribe-prompt',                  // 订阅提示
'.button-wrapper',                    // 各种按钮包装器
'.like-button-container',             // 点赞按钮
'.post-ufi',                          // 用户互动栏 (like/comment/share)
'.post-footer',                       // 文章底部
'.comments-section',                  // 评论区
'.recommendation-container',          // 推荐文章
'.footer-wrap',                       // 全局底部
'.pencraft.pc-display-flex.pc-gap-4', // Previous/Next 导航
'.share-dialog',                      // 分享对话框
'.social-share',                      // 社交分享
'[data-testid="navbar"]',            // 顶部导航
'.header-anchor-widget',              // 锚点组件
```

### 3. Turndown 规则

**Substack UI 组件过滤：**

```typescript
td.addRule('removeSubstackNoise', {
  filter: (node) => {
    const cl = node.getAttribute('class') || '';
    const testId = node.getAttribute('data-testid') || '';
    return (
      /subscribe-widget|button-wrapper|like-button|share-dialog|post-ufi|paywall/.test(cl) ||
      /paywall|navbar/.test(testId)
    );
  },
  replacement: () => '',
});
```

**图片说明格式化：**

```typescript
td.addRule('substackFigcaption', {
  filter: 'figcaption',
  replacement: (content) => content.trim() ? `\n*${content.trim()}*\n` : '',
});
```

### 4. 后处理正则

清除 Turndown 无法过滤的尾部文案：

```typescript
markdown = markdown
  .replace(/Continue reading this post for free.*$/s, '')
  .replace(/Claim my free post.*$/s, '')
  .replace(/Already a paid subscriber\?.*$/s, '')
  .replace(/Get more from .* in the Substack app.*$/s, '')
  .replace(/Start your Substack.*$/s, '')
  .replace(/This site requires JavaScript.*$/s, '')
  .replace(/© \d{4} .*?[·∙].*?Terms.*$/s, '')
```

## 优化效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 内容精度 | `<article>` 包含全部 | `.body.markup` 仅正文 |
| Aella 噪音 | ~500 chars (subscribe, like, share, paywall CTA) | ~0 chars |
| Ruben 噪音 | ~1900 chars (footer, comments, recommendation) | ~0 chars |
| Patrick 噪音 | ~300 chars (footer, JS warning) | ~0 chars |
| Paywall 处理 | 包含订阅引导文案 | 在 paywall 边界截断 |
| 图片说明 | 丢失或格式混乱 | `*斜体说明文字*` |

## Paywall 文章的处理

Substack 有三种文章类型：

| 类型 | `.available-content` | paywall | 处理方式 |
|------|---------------------|---------|---------|
| 免费文章 | 完整内容 | 无 | 直接提取 ✅ |
| 部分免费 | 免费部分 | 有，标记截断点 | 提取到 paywall 为止 ✅ |
| 完全付费 | 可能为空或仅有摘要 | 有 | 提取摘要，标记为不完整 ⚠️ |

对于部分免费文章（如 Aella 的），`[data-testid="paywall"]` 之前的内容是免费可读的，我们只提取这部分。这比什么都导入不了要好得多。

## 文件变更

| 文件 | 变更 |
|------|------|
| `entrypoints/offscreen/main.ts` | CONTENT_SELECTORS 新增 3 个选择器；REMOVE_SELECTORS 新增 14 个选择器；2 个 Turndown 规则；7 个后处理正则 |
