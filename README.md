# NotebookLM Jetpack

一键导入网页、RSS、文档站点、Claude 对话到 NotebookLM 的 Chrome 扩展。

**完全免费，无需登录注册，纯客户端运行。**

## 功能

| 功能 | 描述 |
|------|------|
| 单个导入 | 当前网页一键导入到 NotebookLM |
| 批量导入 | 多个 URL 或所有浏览器标签页批量导入 |
| RSS 导入 | RSS/Atom 源文章批量导入 |
| 文档站点导入 | 自动分析文档站点结构，批量导入所有页面 |
| Claude 对话导入 | 提取 Claude 对话内容并导入 |
| 右键菜单 | 右键快速导入当前页面或链接 |
| 导入历史 | 查看最近 100 条导入记录 |

### 文档站点导入

支持自动检测并提取以下框架的文档站点：

- [Docusaurus](https://docusaurus.io/)
- [MkDocs / Material for MkDocs](https://www.mkdocs.org/)
- [GitBook](https://www.gitbook.com/)
- [VitePress](https://vitepress.dev/)
- [ReadTheDocs / Sphinx](https://readthedocs.org/)
- [Mintlify](https://mintlify.com/)
- [Anthropic Docs](https://docs.anthropic.com/)

## 安装

### 从源码安装

```bash
# 克隆项目
git clone https://github.com/crazynomad/notebooklm-jetpack.git
cd notebooklm-jetpack

# 安装依赖
pnpm install

# 构建
pnpm build
```

1. 打开 Chrome → `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/chrome-mv3` 目录

## 开发

```bash
# 开发模式（热更新）
pnpm dev

# 运行测试
pnpm test

# 类型检查
pnpm compile

# 代码检查
pnpm lint
```

## 技术栈

- [WXT](https://wxt.dev/) — Chrome Extension 框架 (Manifest V3)
- [React 18](https://react.dev/) — UI
- [TypeScript](https://www.typescriptlang.org/) — 类型安全
- [Tailwind CSS](https://tailwindcss.com/) — 样式
- [Vitest](https://vitest.dev/) — 测试

## 隐私

- 无需登录，不收集用户数据
- 所有操作在本地完成
- 开源代码可审计

## License

MIT
