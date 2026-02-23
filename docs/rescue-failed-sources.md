# Rescue Failed Sources — 设计文档

## 问题

NotebookLM 的 Fast Research 功能会自动搜索与主题相关的网页并导入为来源。但有一类页面会**始终导入失败**：

- **Substack** — 反爬机制，服务端请求被拦截
- **Medium** — 付费墙 / member-only 文章
- **微信公众号** — 强反爬，需要微信生态内的 cookie
- 其他有 Cloudflare 防护或登录墙的站点

这些页面在 NotebookLM 的来源面板里显示为**红色错误状态**，用户只能手动复制粘贴内容——如果有 10 个失败来源，这个过程极其痛苦。

## 核心洞察

> NotebookLM 服务端抓不到的页面，**浏览器扩展能抓到**。

原因：
1. 扩展的 Service Worker `fetch()` 走的是用户本地网络，很多反爬策略对浏览器请求更宽松
2. 扩展有 `host_permissions`，不受同源策略限制
3. 即使拿到的是部分内容（如 Medium 的前几段），也比完全没有强

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    NotebookLM 页面                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Content Script (notebooklm.content.ts)           │   │
│  │                                                    │   │
│  │  1. 检测失败来源 (.single-source-error-container)  │   │
│  │  2. 注入抢救 Banner                                │   │
│  │  3. 接收结果 → 操作对话框导入文本                    │   │
│  │  4. 完成后移除原始失败来源                           │   │
│  └──────────┬───────────────────────────┬────────────┘   │
│             │ chrome.runtime.sendMessage │                │
└─────────────┼───────────────────────────┼────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│              Background Service Worker                    │
│                                                          │
│  1. fetch(url) — 直接请求目标页面                         │
│  2. 将 HTML 发给 Offscreen Document                      │
│  3. 拿到 Markdown 后调用 importText()                    │
│     → 找到 NotebookLM tab                                │
│     → 发送 IMPORT_TEXT 消息给 content script             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│             Offscreen Document                            │
│                                                          │
│  HTML → DOMParser → 清理噪音 → Turndown → Markdown      │
│                                                          │
│  为什么需要 Offscreen？                                   │
│  Service Worker 没有 DOM API (无 DOMParser, 无 document) │
│  Offscreen 是 MV3 提供的隐藏页面，拥有完整 DOM 环境       │
└─────────────────────────────────────────────────────────┘
```

## 用户体验流程

```
用户打开 NotebookLM notebook
    ↓
来源面板有 2 个红色失败来源
    ↓
来源列表顶部自动出现琥珀色 Banner：
「⚠ 2 个来源导入失败，可尝试抢救  [↻ 抢救] [×]」
    ↓
用户点击「抢救」
    ↓
Banner 变为「抢救中...」，展开显示每个 URL 的状态
    ↓
逐个处理：fetch → 转 Markdown → 导入为"复制的文字"
    ↓
完成后 Banner 显示结果：
「抢救完成：2 成功」
  ✓ OpenClaw Explained: The Fastest...
  ✓ The Product Channel By Sid Sal...

  ☑ 移除已抢救的失败来源    [✓ 完成]
    ↓
用户点击「完成」
    ↓
自动触发 NotebookLM 的「移除所有失败的来源」菜单
Banner 消失，页面回到干净状态
```

## 关键设计决策

### 1. 为什么用"复制的文字"而不是"网站 URL"导入？

NotebookLM 的 URL 导入是**服务端抓取**——正是这个环节失败了。我们绕过它，直接把内容以文本形式导入。文本导入不经过服务端抓取，100% 可控。

### 2. 为什么用 Offscreen Document 做 HTML→Markdown？

| 方案 | 可行性 | 问题 |
|------|--------|------|
| Service Worker 里用 regex | ❌ | 用户明确拒绝（"不要"），且对复杂 HTML 不可靠 |
| Service Worker 里用 Turndown | ❌ | Turndown 依赖 DOM API，SW 没有 |
| Content Script 里转换 | ⚠️ | 可行但会污染页面 DOM，且大 HTML 可能卡 UI |
| **Offscreen Document** | ✅ | 独立 DOM 环境，不影响任何页面，后台静默执行 |

### 3. 为什么在页面内注入 Banner 而不是放在 Popup？

- **可见性**：用户不需要特意打开扩展就能看到有失败来源可抢救
- **上下文**：Banner 就在失败来源旁边，操作直觉清晰
- **操作链路短**：看到 → 点一下 → 完成，无需切换界面

### 4. 如何检测失败来源？

NotebookLM 使用 Angular + Material Design。通过逆向分析 DOM 结构发现：

```
正常来源: .single-source-container
失败来源: .single-source-container.single-source-error-container
                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                   这个 class 是关键标识
```

URL 存储在 `.source-title` span 的 `textContent` 中。

### 5. 如何自动操作 NotebookLM 的对话框？

NotebookLM 是 Angular 应用，使用 Material Dialog 组件。关键坑点：

- **Dialog 选择器**：不能用 `[role="dialog"]`（会匹配到 emoji keyboard），必须用 `mat-dialog-container`
- **按钮文字**：在 `span.mdc-button__label` 里，不在 `button.textContent` 直接层
- **Dialog 子页面状态**：对话框可能已经在某个子页面（如"网站 URL"输入），需要先检测当前状态再决定操作路径
- **输入填充**：需要用 native setter + dispatch 多种事件（input, change, InputEvent）来触发 Angular 的数据绑定
- **按钮激活**：填入内容后"插入"按钮可能还是 disabled，需要轮询等待

### 6. 防止 Content Script 多次注入

Background 的 `executeScript` 会在每次消息发送前注入 content script，加上页面自身的 `document_idle` 注入，导致多个 listener 并发响应同一消息。

解决：使用 `window.__NLM_IMPORTER_LOADED__` 标记，确保只有第一次注入的脚本注册 listener。

## 局限性

1. **微信公众号**：即使浏览器 fetch 也可能拿不到完整内容（需要微信登录态），内容可能不完整
2. **强付费墙**：如果页面完全需要登录才能看到内容，fetch 只能拿到登录页
3. **JavaScript 渲染的页面**：fetch 只拿到初始 HTML，SPA 动态渲染的内容无法获取
4. **NotebookLM UI 变更**：对话框操作依赖 DOM 结构和 class name，NotebookLM 更新可能导致失效

## 文件清单

| 文件 | 职责 |
|------|------|
| `entrypoints/notebooklm.content.ts` | 失败来源检测、Banner 注入、对话框自动化操作 |
| `entrypoints/background.ts` → `rescueSources()` | 协调 fetch → 转换 → 导入流程 |
| `entrypoints/offscreen/main.ts` | DOMParser + Turndown HTML→Markdown 转换 |
| `services/notebooklm.ts` → `importText()` | 文本导入到 NotebookLM 的通用逻辑 |
| `services/pdf-generator.ts` → `convertHtmlToMarkdown()` | Offscreen 通信封装（rescue 复用此函数） |
