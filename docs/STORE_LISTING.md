# Chrome Web Store 产品说明

> 以下内容用于 Chrome Web Store 上架提交。

---

## 扩展名称

**NotebookLM Jetpack**

---

## 简短描述（132 字符以内，商店搜索结果显示）

给 NotebookLM 装上喷射背包 🚀 一键导入网页、Substack、播客、文档站、AI 对话，聚合多篇突破来源限制。

---

## 详细描述

NotebookLM 是最好的 AI 知识工具，但「把内容喂进去」这一步，太痛苦了。

---

### 痛点一：Substack 和微信公众号导入不了

你在 NotebookLM 里粘贴一篇 Substack 链接，点导入，结果要么被反爬拦截，要么拿到一堆订阅按钮、评论区的噪音文字。微信公众号更惨——看着"导入成功"，打开一看，内容是空的验证页面。

**Jetpack 方案：**
- Substack 文章：精准提取正文区域，自动过滤 Subscribe 按钮、评论区、推荐文章等 14 种噪音元素，Paywall 文章也能提取免费部分
- 微信公众号：在浏览器中渲染完整页面后提取内容，绕过反爬机制。扩展自动检测"假性成功"的来源，蓝色横幅一键修复全部
- 导入失败的来源？琥珀色横幅一键抢救，无需逐个重试

---

### 痛点二：50 个来源上限，免费用户很快就用完

NotebookLM 免费版每个笔记本只有 50 个来源配额。你想导入 20 篇博客文章做一个专题研究，就用掉了将近一半。

**Jetpack 方案：多篇聚合为一个来源**
1. 日常浏览中看到好文章 → 一键收藏到扩展内置的"稍后阅读"
2. 积累够了 → 勾选 10-20 篇 → 点击"聚合导出 PDF"
3. 扩展自动抓取每篇内容、转为 Markdown、合并为一个 PDF
4. 把这一个 PDF 拖入 NotebookLM → 只占一个来源配额 = 20 篇文章的知识

搭配分组管理功能，按项目或主题分类收藏，告别手忙脚乱。

---

### 痛点三：想把整个文档站导入，手动粘贴 200 个链接？

你刚开始学一个新框架，想把官方文档全丢进 NotebookLM 用 AI 问答的方式学习。但文档有 200 个页面，手动复制粘贴要一下午。

**Jetpack 方案：文档站智能导入**
- 打开文档站任意页面 → 点击"分析当前站点"
- 自动识别文档框架，提取全站页面树
- 勾选需要的章节 → 一键批量导入，或导出为 PDF

**已支持 14 种文档框架：**
Docusaurus、VitePress、MkDocs、GitBook、Mintlify、Sphinx、ReadTheDocs、Google DevSite、Anthropic Docs、语雀、微信开发文档、鸿蒙文档，以及任何有 sitemap.xml 或 llms.txt 的站点。

还支持 AI 原生的 llms.txt 标准 —— 越来越多站点提供此文件，扩展会优先使用它获取完整结构化内容。

---

### 痛点四：听了一期好播客，想让 NotebookLM 帮忙做笔记

两小时的播客，靠手动总结太累。你想把音频丢进 NotebookLM 让 AI 生成摘要。但 NotebookLM 不支持直接输入播客链接。

**Jetpack 方案：播客音频下载导入**
- 粘贴 Apple Podcasts 或小宇宙的节目链接
- 自动获取节目信息和单集列表
- 选择要下载的单集 → 一键下载音频文件
- 将音频拖入 NotebookLM → AI 生成完整笔记

---

### 痛点五：和 AI 聊出了好内容，怎么存进知识库？

你和 ChatGPT 讨论了一个技术方案，和 Gemini 做了一轮头脑风暴，和 Claude 深入分析了一篇论文。这些来回的对话就是知识，但 NotebookLM 不能直接导入 AI 对话。

**Jetpack 方案：AI 对话一键导入**
- 在 Claude / ChatGPT / Gemini 的对话页面打开扩展
- 自动识别平台，提取所有问答对
- 以问答对为单位勾选，只导入有价值的部分
- 格式化为结构化 Markdown 存入 NotebookLM

支持三大平台：Claude (claude.ai)、ChatGPT (chatgpt.com)、Google Gemini (gemini.google.com)。

---

### 痛点六：YouTube 视频内容想快速学习

你在 YouTube 上看到一个两小时的技术演讲，不想从头看完，想让 AI 帮你提炼重点。

**Jetpack 方案：YouTube 视频自动导入**
- 粘贴 YouTube 链接，自动提取字幕文本
- 导入 NotebookLM，一个来源就涵盖整个视频的知识
- 配合 NotebookLM 的 AI 功能，快速问答、总结、提炼

---

### 更多实用能力

**RSS 源导入** — 粘贴博客或 Newsletter 的 RSS 地址，自动解析文章列表，批量导入到 NotebookLM。支持 Substack、Medium 等主流 RSS 格式。

**右键菜单快捷导入** — 浏览任意网页时，右键 → "导入到 NotebookLM"，无需打开扩展弹窗。

**导入历史记录** — 自动记录最近 100 条导入，随时回溯。

**智能失败检测与修复** — 在 NotebookLM 页面自动扫描导入失败或假性成功的来源，一键批量抢救。

**中英文双语界面** — 自动适配浏览器语言，也可手动切换。

---

### 安全与隐私

- 完全免费，无需注册登录
- 纯客户端运行，不上传任何数据到第三方服务器
- 开源代码，可审计：github.com/crazynomad/notebooklm-jetpack
- 符合 Chrome Manifest V3 最新安全规范

---

*Made by 绿皮火车*

---

## English Version (for international listing)

### Extension Name

**NotebookLM Jetpack**

### Short Description (132 chars)

Supercharge NotebookLM 🚀 Import web pages, Substack, podcasts, doc sites & AI chats. Merge articles into one source to save slots.

### Detailed Description

NotebookLM is an incredible AI knowledge tool — but getting your content into it shouldn't be the hard part.

---

**Problem: Articles won't import cleanly**

Paste a Substack link into NotebookLM and you get subscribe buttons, comment sections, and paywall noise mixed into your source.

Jetpack fixes this. Substack articles are extracted with surgical precision — 14 noise filters strip out everything except the actual article. Paywall articles? The free portion is still extracted. Failed imports are auto-detected on the NotebookLM page and rescued with one click.

---

**Problem: 50 source slots fill up fast**

Free-tier NotebookLM gives you 50 sources per notebook. Import 20 blog posts for a research project and you've used nearly half.

Jetpack's solution: **Aggregate multiple articles into one source.**
1. Save articles to your built-in read-later list as you browse
2. Select 10-20 articles → export as a single merged PDF
3. Upload one PDF to NotebookLM → 20 articles, one source slot

Organize by collection for different projects or topics.

---

**Problem: Importing an entire documentation site**

You want to study a framework by importing its 200-page docs into NotebookLM. Manually pasting 200 URLs? No thanks.

Jetpack auto-detects **14+ documentation frameworks**: Docusaurus, VitePress, MkDocs, GitBook, Mintlify, Sphinx, ReadTheDocs, Google DevSite, Anthropic Docs, and more. Open any doc page → "Analyze Site" → select chapters → batch import or export as PDF.

Also supports the emerging **llms.txt** standard for AI-native content discovery.

---

**Problem: Great podcast, no easy way to get it into NotebookLM**

You listened to a 2-hour podcast and want AI-generated notes. But NotebookLM doesn't accept podcast URLs.

Paste an Apple Podcasts link → pick episodes → download audio → drag into NotebookLM. Done.

---

**Problem: Your best AI conversations are trapped in chat windows**

That brilliant ChatGPT brainstorm, that deep Claude analysis, that creative Gemini session — all locked inside their respective platforms.

Open the extension on any **Claude, ChatGPT, or Gemini** conversation page. It auto-detects the platform, extracts Q&A pairs, and lets you selectively import the valuable exchanges into NotebookLM as structured markdown.

---

**Problem: YouTube videos you want to learn from quickly**

A 2-hour tech talk on YouTube — you don't want to watch the whole thing, you want AI to extract the key points.

Paste a YouTube link → subtitles are extracted automatically → import to NotebookLM → ask questions, get summaries, extract insights.

---

**Also includes:**
- **RSS feed import** — Substack, Medium, any standard RSS/Atom feed
- **Right-click context menu** for instant single-page import
- **Import history** — last 100 entries, always accessible
- **Smart failure detection** — auto-scans for failed/silently broken imports on the NotebookLM page, one-click batch rescue
- **Bilingual UI** — Chinese and English, auto-detects browser language with manual toggle

**Privacy & Security:**
- 100% free, no account required
- Runs entirely in your browser — zero data sent to third-party servers
- Open source: github.com/crazynomad/notebooklm-jetpack
- Chrome Manifest V3 compliant

*Made by Green Train Podcast*
