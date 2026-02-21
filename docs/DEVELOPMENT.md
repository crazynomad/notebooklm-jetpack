# 开发指南

## 环境要求

- Node.js >= 18
- pnpm（推荐）或 npm
- Chrome 浏览器

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发模式（热更新）
pnpm dev

# Chrome 中加载扩展：
# 1. 打开 chrome://extensions/
# 2. 开启「开发者模式」
# 3. 点击「加载已解压的扩展程序」
# 4. 选择项目的 dist/ 目录
```

## 常用命令

```bash
pnpm dev          # 开发模式 (Chrome)
pnpm dev:firefox  # 开发模式 (Firefox)
pnpm build        # 生产构建
pnpm zip          # 打包为 .zip（上传 Web Store）
pnpm compile      # TypeScript 类型检查
pnpm lint         # ESLint 检查
pnpm lint:fix     # ESLint 自动修复
```

## 开发注意事项

### Content Script 调试

Content script 的 console 输出在**目标页面**的 DevTools 中查看，不在扩展的 DevTools 中。

- `notebooklm.content.ts` → 在 notebooklm.google.com 的 Console 中查看
- `claude.content.ts` → 在 claude.ai 的 Console 中查看
- `docs.content.ts` → 在任意文档站点的 Console 中查看

### Background Service Worker 调试

在 `chrome://extensions/` 页面，点击扩展卡片上的「Service Worker」链接打开 DevTools。

### DOM 选择器维护

`notebooklm.content.ts` 和 `claude.content.ts` 中的 DOM 选择器依赖第三方网站的页面结构。如果导入功能突然失效：

1. 打开目标网站的 DevTools
2. 检查按钮/输入框的选择器是否变化
3. 更新对应的 `findAddSourceButton()`、`findSubmitButton()` 等函数
4. 测试完整导入流程

### 添加新的导入源

1. 在 `lib/types.ts` 中添加新的 `MessageType`
2. 在 `services/` 下创建新的 service 文件
3. 在 `background.ts` 的 `handleMessage()` 中注册消息处理
4. 在 `components/` 下创建新的 UI 组件
5. 在 `App.tsx` 的 Tabs 中添加新 Tab
6. 如需 content script，在 `entrypoints/` 下创建并在 `wxt.config.ts` 中配置

### 添加新的文档框架

1. 在 `lib/types.ts` 的 `DocFramework` 类型中添加
2. 在 `services/docs-analyzer.ts` 中：
   - `detectFramework()` 添加检测逻辑
   - 添加 `extractXxxPages()` 提取函数
   - `extractPages()` switch 中注册

## Google OAuth 配置

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目 → 启用 **YouTube Data API v3**
3. 创建 OAuth 2.0 客户端 ID（类型：Chrome 扩展）
4. 填入扩展 ID（从 `chrome://extensions/` 获取）
5. 将 client_id 写入 `wxt.config.ts` 的 `manifest.oauth2.client_id`

## 构建产物

```
dist/
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── content-scripts/
│   ├── notebooklm.js
│   ├── claude.js
│   └── docs.js
├── icons/
└── chunks/          # 共享代码
```
