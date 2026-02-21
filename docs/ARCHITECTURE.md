# 架构文档

## 技术栈

| 技术 | 用途 |
|------|------|
| WXT 0.19 | Chrome Extension 框架 (Manifest V3) |
| React 18 | Popup UI |
| TypeScript 5 | 类型安全 |
| Tailwind CSS 3 | 样式 |
| Radix UI | Tabs 组件 |
| Lucide | 图标 |
| Vite | 构建工具（WXT 内置） |

## 项目结构

```
notebooklm-importer/
├── wxt.config.ts                  # WXT + Manifest 配置
├── package.json
├── tsconfig.json
├── tailwind.config.js
│
├── entrypoints/                   # Chrome Extension 入口
│   ├── background.ts              # Service Worker - 消息中枢
│   ├── notebooklm.content.ts      # Content Script - NotebookLM 页面 DOM 自动化
│   ├── claude.content.ts          # Content Script - Claude 对话提取
│   ├── docs.content.ts            # Content Script - 文档站点分析（动态注入）
│   └── popup/                     # Popup UI
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx                # 主组件，6 Tab 布局
│       └── style.css
│
├── components/                    # React 组件
│   ├── SingleImport.tsx           # 单个 URL 导入 (144行)
│   ├── BatchImport.tsx            # 批量 URL / 全标签页导入 (269行)
│   ├── PlaylistImport.tsx         # YouTube 播放列表导入 (324行) - 需订阅验证
│   ├── RssImport.tsx              # RSS 源导入 (231行)
│   ├── DocsImport.tsx             # 文档站点分析+导入 (299行)
│   ├── ClaudeImport.tsx           # Claude 对话提取+导入 (311行)
│   └── HistoryPanel.tsx           # 导入历史记录 (151行)
│
├── services/                      # 业务逻辑层
│   ├── notebooklm.ts              # 核心导入逻辑（找 Tab、发消息、批量导入）
│   ├── youtube-api.ts             # YouTube OAuth + 订阅检查 + 播放列表获取
│   ├── rss-parser.ts              # RSS/Atom 解析
│   ├── docs-site.ts               # 文档站点分析调度（注入 content script）
│   ├── docs-analyzer.ts           # 文档框架检测 + 页面提取（7 框架 + generic）
│   ├── claude-conversation.ts     # Claude 对话提取+格式化
│   └── history.ts                 # 导入历史 CRUD（chrome.storage.local）
│
├── lib/                           # 公共库
│   ├── types.ts                   # 所有 TypeScript 类型定义
│   ├── utils.ts                   # 工具函数（URL 解析、延时等）
│   └── config.ts                  # 配置常量（频道 ID、缓存策略、API URL）
│
├── public/icons/                  # 扩展图标
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
│
└── docs/                          # 项目文档
    ├── ARCHITECTURE.md            # 本文档
    ├── competitive-analysis.md    # 竞品分析
    └── ROADMAP.md                 # 开发计划
```

## 数据流

### 导入流程（URL）

```
用户输入 URL
    ↓
[Popup UI] → chrome.runtime.sendMessage({ type: 'IMPORT_URL', url })
    ↓
[Background Service Worker]
    ├── 查找/创建 NotebookLM 标签页
    ├── 注入 notebooklm.content.ts
    └── chrome.tabs.sendMessage({ type: 'IMPORT_URL', url })
        ↓
[NotebookLM Content Script]
    ├── 点击 "Add Source" 按钮
    ├── 选择 "Website" 选项
    ├── 填入 URL
    ├── 点击 Submit
    └── 返回 success/failure
        ↓
[Background] → 记录到 history → 返回结果给 Popup
```

### 导入流程（Claude 对话）

```
[Popup] → EXTRACT_CLAUDE_CONVERSATION
    ↓
[Background] → chrome.tabs.sendMessage → [Claude Content Script]
    ├── 解析 DOM 提取 title + messages
    └── 返回 ClaudeConversation 对象
        ↓
[Popup] → 用户选择消息 → IMPORT_CLAUDE_CONVERSATION
    ↓
[Background] → formatConversationForImport() → importText()
    ↓
[NotebookLM Content Script] → 选 "Copied text" → 粘贴 → Submit
```

### 导入流程（文档站点）

```
[Popup] → ANALYZE_DOC_SITE(tabId)
    ↓
[Background] → chrome.scripting.executeScript 注入 docs.content.ts
    ↓
[Docs Content Script]
    ├── detectFramework() → 识别文档框架
    ├── extractPages() → 提取侧边栏链接
    └── 返回 DocSiteInfo { framework, pages[] }
        ↓
[Popup] → 用户勾选页面 → IMPORT_BATCH(urls)
    ↓
[Background] → 逐个导入 + 进度回调
```

## 消息类型

所有 Popup ↔ Background 通信通过 `chrome.runtime.sendMessage`，类型定义在 `lib/types.ts`：

| 消息类型 | 方向 | 用途 |
|----------|------|------|
| `CHECK_SUBSCRIPTION` | Popup → BG | OAuth 检查 YouTube 订阅 |
| `GET_CACHED_SUBSCRIPTION` | Popup → BG | 读取缓存的订阅状态 |
| `IMPORT_URL` | Popup/BG → Content | 导入单个 URL |
| `IMPORT_BATCH` | Popup → BG | 批量导入 |
| `IMPORT_TEXT` | BG → Content | 导入文本内容 |
| `GET_PLAYLIST_VIDEOS` | Popup → BG | 获取播放列表视频 |
| `PARSE_RSS` | Popup → BG | 解析 RSS 源 |
| `GET_CURRENT_TAB` | Popup → BG | 获取当前标签 URL |
| `GET_ALL_TABS` | Popup → BG | 获取所有标签 URL |
| `ANALYZE_DOC_SITE` | Popup → BG | 分析文档站点 |
| `EXTRACT_CLAUDE_CONVERSATION` | Popup → BG → Content | 提取 Claude 对话 |
| `IMPORT_CLAUDE_CONVERSATION` | Popup → BG | 导入选中的对话消息 |
| `GET_HISTORY` | Popup → BG | 获取导入历史 |
| `CLEAR_HISTORY` | Popup → BG | 清空历史 |

## 权限

| 权限 | 用途 |
|------|------|
| `storage` | 存储订阅缓存 + 导入历史 |
| `activeTab` | 获取当前标签信息 |
| `tabs` | 查找/创建 NotebookLM 标签页 |
| `identity` | Google OAuth（YouTube 订阅检查） |
| `scripting` | 动态注入 docs content script |
| `contextMenus` | 右键菜单导入 |
| `notifications` | 导入状态通知 |

## 已知脆弱点

1. **DOM 选择器依赖** — `notebooklm.content.ts` 依赖 Google 页面结构，随时可能因 NotebookLM 改版失效
2. **Claude 对话提取** — 同样依赖 claude.ai 的 DOM 结构，较为脆弱
3. **OAuth client_id** — `wxt.config.ts` 中仍为占位符
4. **无错误上报** — 没有 Sentry 或类似的错误追踪
5. **无单元测试** — 整个项目没有测试覆盖
