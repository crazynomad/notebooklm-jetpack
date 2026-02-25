# NotebookLM Jetpack 🚀

给 NotebookLM 装上喷射背包 — 一键导入网页、Substack、播客、文档站、AI 对话，聚合多篇突破来源限制。

📖 **文档站**：[jetpack.boing.work](https://jetpack.boing.work/)
🔒 **隐私政策**：[Privacy Policy](https://jetpack.boing.work/privacy)

**完全免费 · 无需登录 · 纯客户端运行 · 开源**

## 功能

| 功能 | 描述 |
|------|------|
| 🌐 网页导入 | 单个导入、批量导入、导入所有标签页 |
| 📑 收藏夹 & 聚合 | 内置「稍后阅读」，多篇聚合为一个 PDF，突破 50 来源限制 |
| 📚 文档站导入 | 自动识别 14+ 文档框架，批量导入或导出 PDF |
| 🎙️ 播客导入 | Apple Podcasts、小宇宙，下载音频拖入 NotebookLM |
| 🤖 AI 对话导入 | Claude、ChatGPT、Gemini 对话提取，按问答对选择导入 |
| 📡 RSS 导入 | RSS/Atom 源文章批量导入 |
| 🛟 失败抢救 | 自动检测导入失败和假性成功的来源，一键批量修复 |
| 🖱️ 右键菜单 | 浏览任意网页时右键直接导入 |
| 📋 导入历史 | 最近 100 条导入记录 |
| 🌐 双语界面 | 中英文自动适配，可手动切换 |

### 特殊平台支持

- **Substack** — 精准提取正文，14 种噪音过滤（Subscribe 按钮、评论区等）
- **微信公众号** — 浏览器内渲染后提取，绕过反爬机制
- **X.com (Twitter) 长文** — 自动识别 Article 格式，浏览器渲染提取

### 文档站框架

支持自动检测并提取以下框架：

Docusaurus · VitePress · MkDocs · GitBook · Mintlify · Sphinx · ReadTheDocs · Google DevSite · Anthropic Docs · 语雀 · 微信开发文档 · 鸿蒙文档

以及任何提供 `sitemap.xml` 或 `llms.txt` 的站点。

## 安装

### Chrome Web Store

*审核中，即将上线。*

### 从源码安装

```bash
git clone https://github.com/crazynomad/notebooklm-jetpack.git
cd notebooklm-jetpack
pnpm install
pnpm build
```

1. 打开 Chrome → `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/chrome-mv3` 目录

## 开发

```bash
pnpm dev        # 开发模式（热更新，端口 3003）
pnpm build      # 生产构建
pnpm test       # 运行测试
pnpm compile    # TypeScript 类型检查
pnpm lint       # 代码检查
```

## 技术栈

- [WXT](https://wxt.dev/) — Chrome Extension 框架 (Manifest V3)
- [React 18](https://react.dev/) — UI
- [TypeScript](https://www.typescriptlang.org/) — 类型安全
- [Tailwind CSS](https://tailwindcss.com/) — 样式
- [Vitest](https://vitest.dev/) — 测试

## 隐私

- 无需登录，不收集任何用户数据
- 所有操作在浏览器本地完成，不上传到第三方服务器
- 开源代码可审计
- 符合 Chrome Manifest V3 安全规范

详见 [隐私政策](https://jetpack.boing.work/privacy)。

## License

MIT

---

*Made by 绿皮火车 🚂*
