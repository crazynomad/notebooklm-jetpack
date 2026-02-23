# 内容提取策略 — 思考与方案

## 当前状态

我们有三层内容提取能力：

| 层级 | 方法 | 适用场景 | 速度 |
|------|------|---------|------|
| L1 | SW `fetch()` + Offscreen Turndown | 大部分网页、Substack、Medium | 快 (~2s) |
| L2 | 浏览器 Tab 渲染 + DOM 提取 | 微信公众号等需要 JS 渲染的页面 | 慢 (~8s) |
| L3 | NotebookLM 原生 URL 导入 | NotebookLM 自己能处理的页面 | 由 NLM 控制 |

## 核心思考

### 问题本质

NotebookLM 的来源导入本质上是一个**内容获取**问题。不同平台有不同的反爬策略，我们需要针对每个平台选择最优的提取路径。

### 平台分类

```
可以 fetch 直接拿 ─────────── 一般网站、博客、文档站
  └─ 需要 Turndown 优化 ──── Substack、Medium (有特定 DOM 结构)
  
需要浏览器渲染 ────────────── 微信公众号、SPA 应用
  └─ 需要登录态 ──────────── 部分付费文章、私密内容
  
完全无法获取 ──────────────── 强付费墙、需要 App 内打开
```

### Substack 深入分析

**Substack 是最值得优化的平台**，原因：

1. 大量高质量英文内容（独立创作者、深度分析）
2. 被称为"海外微信公众号"，用户基数大
3. NotebookLM 的 Fast Research 经常找到 Substack 文章
4. HTML 结构统一规范（统一模板），优化投入产出比高

**Substack HTML 结构：**

```html
<article class="single-post">
  <div class="post-header">
    <h1 class="post-title">文章标题</h1>
    <h3 class="subtitle">副标题</h3>
    <div class="post-meta">作者、日期</div>
  </div>
  
  <div class="available-content">        ← 【内容入口】
    <div class="body markup">            ← 【文章正文】
      <p>正文段落...</p>
      <figure>
        <img src="..."/>
        <figcaption>图片说明</figcaption>
      </figure>
      <h2>小标题</h2>
      <p>更多内容...</p>
    </div>
  </div>
  
  <div data-testid="paywall">            ← 【Paywall 边界】
    订阅引导内容...
  </div>
  
  <div class="post-footer">              ← 【噪音】
    <div class="like-button-container">
    <div class="subscribe-widget">
    <div class="comments-section">
  </div>
</article>
```

**已实现的优化：**

1. ✅ 内容选择器：`.available-content .body.markup` 优先
2. ✅ Paywall 边界：移除 `[data-testid="paywall"]` 及之后内容
3. ✅ 噪音清理：subscribe、like、share、comments、recommendation
4. ✅ Turndown 规则：Substack UI 组件过滤、figcaption 格式化
5. ✅ 尾部清理：正则移除 "Continue reading"、版权等文案

## 下一步计划

### Phase 1: Medium 优化（优先级高）

Medium 是另一个被 NotebookLM 经常发现但难以导入的平台。

**Medium 特点：**
- 部分文章有 member-only wall
- HTML 中有 `article` 标签包含正文
- 内容选择器：`article`, `section` 内的 `p` 标签
- 噪音：关注按钮、鼓掌按钮、推荐文章、footer

**计划：**
- [ ] 分析 3-5 篇 Medium 文章的 HTML 结构
- [ ] 添加 Medium 专用内容选择器
- [ ] 添加 Medium 噪音清理规则
- [ ] 处理 member-only 截断提示

### Phase 2: 通用内容质量评分

当前的 `detectBlockedContent()` 是简单的黑名单匹配。可以升级为评分机制：

```typescript
interface ContentQuality {
  score: number;        // 0-100
  wordCount: number;
  hasTitle: boolean;
  isBlocked: boolean;
  blockReason?: string;
  platform?: string;
}
```

用途：
- 导入前预检：分数低于阈值则拒绝导入
- 导入后提示：告知用户内容质量可能不佳
- 自动降级：L1 失败自动尝试 L2

### Phase 3: 平台自动检测 + 策略路由

```typescript
function detectPlatform(url: string): Platform {
  if (/substack\.com/.test(url)) return 'substack';
  if (/medium\.com|towardsai\.net/.test(url)) return 'medium';
  if (/mp\.weixin\.qq\.com/.test(url)) return 'wechat';
  if (/notion\.site/.test(url)) return 'notion';
  return 'generic';
}

function getExtractionStrategy(platform: Platform): Strategy {
  switch (platform) {
    case 'wechat': return 'tab-render';    // L2
    case 'substack': return 'fetch-optimized'; // L1 + 专用选择器
    case 'medium': return 'fetch-optimized';   // L1 + 专用选择器
    default: return 'fetch-generic';           // L1 通用
  }
}
```

### Phase 4: 用户体验提升

- 抢救/修复进度实时更新（每个 URL 独立状态）
- 支持单个 URL 重试
- 修复前预览提取到的内容（防止导入垃圾）
- Banner 支持手动添加 URL（不仅限于自动检测的）
