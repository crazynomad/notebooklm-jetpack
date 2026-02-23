# NotebookLM Jetpack — 产品介绍

> 让 NotebookLM 吃掉互联网上的一切知识。

## 一句话介绍

**NotebookLM Jetpack** 是一款 Chrome 扩展，解决 Google NotebookLM "喂不进去"的问题——帮你把各种来源的内容（文档站、AI 对话、播客、微信公众号……）一键导入 NotebookLM，让它真正成为你的第二大脑。

---

## 🎯 解决什么问题？

NotebookLM 是 Google 推出的 AI 笔记工具，能对你上传的资料进行深度分析、问答和生成播客。但它有一个痛点：

**导入来源太麻烦了。**

- 想导入一个文档站的 50 个页面？手动粘贴 50 次 URL。
- 导入微信公众号文章？NotebookLM 根本抓不到内容（反爬）。
- 想把 Claude/ChatGPT 的对话存进去？没有官方支持。
- 批量导入失败了？一个个重试。

**NotebookLM Jetpack 就是来解决这些问题的。**

---

## ✨ 核心功能

### 📚 文档站智能导入

**场景**：你发现一个技术文档站（比如 React 文档、OpenClaw 文档），想把整站内容导入 NotebookLM 做深度学习。

**怎么用**：
1. 打开文档站任意页面
2. 点击扩展 → 「分析当前站点」
3. 自动识别框架、提取所有页面链接
4. 勾选要导入的页面，一键批量导入
5. 或者导出为一个 PDF 文件上传到 NotebookLM

**支持 14 种文档框架**：Docusaurus、VitePress、MkDocs、GitBook、Mintlify、Sphinx、ReadTheDocs、Google DevSite、Anthropic Docs、语雀、微信开发文档、鸿蒙文档，以及任何有 sitemap.xml 的站点。

**在 NotebookLM 页面也能用**：自动切换为 URL 输入模式，输入文档站地址即可分析。

---

### 🤖 AI 对话导入

**场景**：你和 Claude 讨论了一个技术方案，想把这段对话作为知识来源存入 NotebookLM。

**怎么用**：
1. 在 Claude / ChatGPT / Gemini 的对话页面
2. 打开扩展（自动定位到「AI 对话」标签）
3. 点击「提取当前对话」
4. 以问答对为单位，勾选要导入的内容
5. 一键导入到已打开的 NotebookLM 笔记本

**支持三大平台**：Claude (claude.ai)、ChatGPT (chatgpt.com)、Google Gemini (gemini.google.com)。

**智能识别**：自动检测当前页面属于哪个平台，弹出扩展时直接定位到 AI 对话标签。

---

### 🎙️ 播客导入

**场景**：你在小宇宙听到一期很好的播客，想把内容导入 NotebookLM 生成笔记。

**怎么用**：
1. 打开 Apple Podcasts 或小宇宙的节目页面
2. 扩展自动识别播客 URL
3. 提取节目信息、单集列表
4. 选择要导入的单集

**支持平台**：Apple Podcasts、小宇宙 FM（通过 `__NEXT_DATA__` SSR 提取 + RSS fallback）。

**自适应主题**：Apple Podcasts 紫色主题，小宇宙翡翠绿主题。

---

### 🔧 智能修复

**场景**：你往 NotebookLM 导入了一批 URL，有些失败了（红色错误），有些"假性成功"（比如微信公众号文章，标题显示为 URL）。

#### 🟠 抢救失败来源

NotebookLM 页面自动检测失败来源，弹出琥珀色横幅：
- 一键抢救：扩展自己去抓取页面内容 → 转为 Markdown → 以"粘贴文字"方式导入
- 抢救完自动重命名来源（从"粘贴的文字"改为实际标题）
- 支持批量抢救

#### 🔵 修复微信公众号

微信公众号文章有反爬机制，NotebookLM 的 URL 导入会"假性成功"（拿到的是验证页面）。扩展自动检测这种情况，弹出蓝色横幅：
- 一键修复：在浏览器 tab 中渲染微信页面 → 提取 `#js_content` DOM → 转为文本 → 重新导入
- 自动检测新导入的微信来源（无需刷新页面）

#### 🛡️ 反爬检测

内置智能反爬检测（`detectBlockedContent()`），识别：
- Cloudflare 人机验证页面
- 需要登录/付费墙页面
- 空壳页面（JS 渲染失败）
- 避免将反爬页面误导入为来源

---

### 📥 平台优化提取

不同平台的页面结构差异很大，通用的 HTML → Markdown 转换效果不好。扩展针对主流平台做了专项优化：

| 平台 | 优化策略 |
|------|---------|
| Substack | 精准选择器 `.available-content .body.markup`，识别付费墙边界，14 个噪声过滤规则 |
| 微信公众号 | 浏览器渲染 + DOM 提取（反爬绕过） |
| Google DevSite | `.devsite-article-body` 优先选择器，自定义元素检测 |
| Medium | （计划中）针对性内容提取 |

---

### 📄 PDF 导出

**场景**：有些内容太多（比如整个文档站 200 页），不适合逐个 URL 导入，想生成一个 PDF 直接上传。

**怎么用**：
1. 分析文档站 → 选择页面
2. 点击「导出为 PDF」
3. 实时显示抓取进度
4. 自动下载 PDF 文件
5. 拖入 NotebookLM 即可

**技术亮点**：通过 Service Worker + Offscreen Document 实现，HTML → Markdown（Turndown.js）→ PDF 渲染，全程后台运行。

---

## 🏗️ 技术特点

- **纯客户端运行**：无服务器、无账号、无数据上传，内容处理全在浏览器内完成
- **Chrome MV3**：使用最新 Manifest V3 规范，符合 Chrome 安全要求
- **WXT + React + TypeScript**：现代化技术栈，代码可维护性强
- **Offscreen Document**：巧妙利用 MV3 的 offscreen API 做 HTML→Markdown 转换（Service Worker 无法使用 DOMParser）
- **智能 DOM 自动化**：深度适配 NotebookLM 的 Angular Material UI，处理对话框状态、按钮等待、来源重命名等复杂交互

---

## 📊 与原生 NotebookLM 的对比

| 能力 | NotebookLM 原生 | + Importer |
|------|----------------|------------|
| 单个 URL 导入 | ✅ | ✅ |
| 批量 URL 导入 | ✅（手动多次） | ✅ 一键批量 |
| 文档站整站导入 | ❌ | ✅ 自动分析 + 批量 |
| 微信公众号 | ❌ 假性成功 | ✅ 自动修复 |
| 失败来源抢救 | ❌ 只能删除 | ✅ 自动抢救 |
| AI 对话导入 | ❌ | ✅ Claude/ChatGPT/Gemini |
| 播客导入 | ❌ | ✅ Apple Podcasts/小宇宙 |
| PDF 导出 | ❌ | ✅ 文档站 → PDF |
| RSS 导入 | ❌ | ✅ |
| 来源自动重命名 | ❌ 显示"粘贴的文字" | ✅ 自动改为实际标题 |

---

## 🎬 使用场景

### 场景 1：技术学习
> 我在学习一个新框架，想把它的官方文档全部导入 NotebookLM，这样就能用 AI 问答的方式学习。

→ 文档站智能导入：打开文档首页 → 分析 → 全选 → 导入。5 分钟搞定 200 页文档。

### 场景 2：研究课题
> 我在研究一个话题，已经和 Claude 讨论了很多轮，想把讨论结果也纳入 NotebookLM 的知识库。

→ AI 对话导入：在 Claude 页面打开扩展 → 提取 → 选择有价值的问答对 → 导入。

### 场景 3：内容创作
> 我关注了几个微信公众号，想把一批好文章导入 NotebookLM，让它帮我总结和生成播客。

→ 逐个导入微信文章 URL → 修复横幅自动出现 → 一键修复全部 → 生成播客。

### 场景 4：播客笔记
> 我在小宇宙听了一期两小时的播客，想快速了解核心内容。

→ 播客导入：粘贴小宇宙链接 → 导入到 NotebookLM → 让 AI 生成摘要和笔记。

### 场景 5：信息聚合
> 我想把散落在各处的信息（博客文章、技术文档、AI 对话、播客）统一放到一个 NotebookLM 笔记本里做交叉分析。

→ 多来源导入：文档站 + 微信文章 + Claude 对话 + 播客 → 全部导入同一笔记本 → AI 交叉分析。

---

## 📦 安装方式

### 从源码安装（当前）

```bash
git clone https://github.com/crazynomad/notebooklm-jetpack.git
cd notebooklm-jetpack
pnpm install
pnpm build
```

Chrome → `chrome://extensions/` → 开发者模式 → 加载 `dist/chrome-mv3`

### Chrome Web Store（计划中）

即将发布。

---

## 🔗 链接

- **GitHub**: [github.com/crazynomad/notebooklm-jetpack](https://github.com/crazynomad/notebooklm-jetpack)
- **YouTube**: [绿皮火车播客](https://www.youtube.com/@greentrainpodcast)

---

## 💡 设计哲学

1. **降低门槛**：NotebookLM 最大的价值在于"喂进足够多的好内容"，但导入门槛太高会让人放弃。我们就是来降低这个门槛的。
2. **智能兜底**：不是所有导入都能一次成功。失败了能抢救，假性成功能修复，来源名称能自动修正。
3. **平台适配**：不同平台有不同的反爬策略和 DOM 结构，通用方案不够好，就做专项优化。
4. **纯本地运行**：用户的数据不离开浏览器，不需要信任任何第三方服务。
5. **渐进增强**：先保证基础功能稳定，再一层层加上智能检测和自动化。

---

*Made with ❤️ by 绿皮火车播客*
