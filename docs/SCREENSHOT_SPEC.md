# Chrome Web Store 截图规格

> 5 张截图，1280×800px，用于 Chrome Web Store listing

---

## 设计规范

### 画布
- **尺寸**: 1280 × 800 px
- **背景**: 线性渐变 `#EBF3FE` → `#F8FAFF`（左上到右下）
- **圆角**: 截图容器 16px 圆角，带 `0 8px 32px rgba(0,0,0,0.08)` 投影

### 排版
- **标题**: 32px, 700 weight, `#1A1A1A`, 居中，距顶部 60px
- **副标题**: 16px, 400 weight, `#666666`, 居中，标题下方 12px
- **字体**: 中文用 PingFang SC / Noto Sans SC，英文用 Inter
- **截图容器**: 居中，宽度 420px（模拟 popup 宽度），自然高度，距副标题 40px

### 品牌元素
- 左上角可选放 Jetpack icon (32×32) + "NotebookLM Jetpack" 文字
- 右下角: `github.com/crazynomad/notebooklm-jetpack` (10px, `#AAAAAA`)

---

## 截图 1：聚合来源

**标题（中）**: 20 篇文章，只占 1 个来源配额
**标题（英）**: 20 Articles, 1 Source Slot

**副标题（中）**: 收藏 → 聚合 → 导出 PDF → 突破 50 来源限制
**副标题（英）**: Bookmark → Merge → Export PDF → Break the 50-source limit

**画面**: 收藏夹 tab，列表中有 15-20 个真实文章书签，底部显示"聚合导出 PDF (18 篇)"按钮，部分项目被勾选

**准备数据**: 添加以下书签到扩展
```
https://blog.google/technology/ai/notebooklm-goes-global/
https://simonwillison.net/2024/Dec/search/?q=notebooklm
https://www.theverge.com/2024/12/11/ai-podcasts-notebooklm
https://arxiv.org/abs/2312.10997
https://paulgraham.com/writes.html
https://darioamodei.com/machines-of-loving-grace
https://lilianweng.github.io/posts/2024-11-28-reward-hacking/
https://karpathy.github.io/2024/12/15/llm-in-2025/
https://www.anthropic.com/research/building-effective-agents
https://openai.com/index/practices-for-governing-agentic-ai-systems/
https://huggingface.co/blog/open-source-llms-as-agents
https://www.deeplearning.ai/the-batch/
https://newsletter.pragmaticengineer.com/
https://stratechery.com/
https://every.to/chain-of-thought
```

---

## 截图 2：文档站导入

**标题（中）**: 整个文档站，一键导入
**标题（英）**: Import an Entire Doc Site in One Click

**副标题（中）**: 自动识别 14+ 框架，提取全站页面树
**副标题（英）**: Auto-detects 14+ frameworks, extracts the full page tree

**画面**: 文档站 tab，已分析完一个真实站点，展示页面树列表（200+ 页面），部分章节勾选，顶部显示框架名称和页面数

**建议站点**: 打开 https://vitepress.dev 或 https://docs.anthropic.com 进行分析

---

## 截图 3：AI 对话导入

**标题（中）**: AI 对话，秒变知识来源
**标题（英）**: Turn AI Conversations into Knowledge

**副标题（中）**: 支持 Claude · ChatGPT · Gemini，按问答对选择性导入
**副标题（英）**: Works with Claude · ChatGPT · Gemini — selectively import Q&A pairs

**画面**: AI 对话 tab，已提取一个真实对话，展示 8-10 个问答对列表，部分勾选，底部"导入选中的 6 个问答对"按钮

**建议**: 在 Claude 上开一段关于 NotebookLM 使用技巧的对话，然后提取

---

## 截图 4：多功能导入

**标题（中）**: 网页 · 播客 · YouTube · RSS，一站搞定
**标题（英）**: Web · Podcast · YouTube · RSS — All in One

**副标题（中）**: 粘贴链接即可导入，支持右键菜单快捷操作
**副标题（英）**: Paste a link to import — right-click menu included

**画面**: 拼接/并排展示多个 tab 的截图片段（不需要完整，裁剪关键区域）：
- 左侧：单个导入 tab，输入框里有一个 YouTube 链接
- 右侧：播客 tab，展示一个 Apple Podcasts 节目的单集列表

**或者**: 如果拼接复杂，单独展示播客 tab 有真实节目数据

---

## 截图 5：中英双语

**标题（中）**: 中英双语，自动适配
**标题（英）**: Bilingual UI, Auto-detected

**副标题（中）**: 根据浏览器语言自动切换，也可手动一键切换
**副标题（英）**: Auto-detects your browser language, one-click manual toggle

**画面**: 左右并排两个 popup 截图：
- 左侧：中文界面（收藏夹 tab）
- 右侧：英文界面（同样的 Bookmarks tab）
- 中间一个 → 箭头或 "EN / 中" 切换按钮高亮

---

## 制作流程

1. **Burn 准备数据**: 往扩展里添加书签、分析一个文档站、在 Claude 上开对话
2. **Burn 截图**: 每个场景截 popup 区域（macOS: Cmd+Shift+4）
3. **设计师排版**: 用 Figma/Keynote 按上述规格排版，加标题、背景、投影
4. **出两套**: 中文版 + 英文版（商店支持按 locale 展示不同截图）
