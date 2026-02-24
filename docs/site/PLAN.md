# 文档站规划 — NotebookLM Jetpack

## 技术方案
- **框架**: Mintlify (docs-as-code, mint.json 配置)
- **部署**: Mintlify 托管 或 GitHub Pages
- **语言**: 中文为主，关键页面提供英文版
- **仓库**: 在项目根目录创建 `docs-site/` 目录

## 站点结构

```
docs-site/
├── mint.json                    # Mintlify 配置 + 导航
├── introduction.mdx             # 首页：产品介绍 + 快速开始
├── getting-started/
│   ├── install.mdx              # 安装指南
│   └── first-import.mdx         # 第一次导入
├── features/
│   ├── bookmarks.mdx            # 收藏夹 & 聚合导出 PDF
│   ├── web-import.mdx           # 网页导入（单个 / 批量）
│   ├── docs-import.mdx          # 文档站导入
│   ├── podcast.mdx              # 播客下载
│   ├── ai-chat.mdx              # AI 对话导入
│   ├── rss.mdx                  # RSS 导入
│   └── rescue.mdx               # 失败来源抢救
├── guides/
│   ├── substack.mdx             # Substack 导入技巧
│   ├── wechat.mdx               # 微信公众号导入
│   ├── youtube.mdx              # YouTube 视频导入
│   └── source-limit.mdx         # 突破 50 来源限制技巧
├── faq.mdx                      # 常见问题
├── changelog.mdx                # 更新日志
└── privacy.mdx                  # 隐私政策
```

## 导航结构 (mint.json navigation)

```
1. 开始使用
   - 产品介绍
   - 安装扩展
   - 第一次导入

2. 核心功能
   - 收藏夹 & PDF 聚合
   - 网页导入
   - 文档站导入
   - 播客下载
   - AI 对话导入
   - RSS 导入
   - 失败来源抢救

3. 使用指南
   - Substack 导入
   - 微信公众号导入
   - YouTube 视频导入
   - 突破 50 来源限制

4. 其他
   - 常见问题
   - 更新日志
   - 隐私政策
```

## 页面内容要求

每个功能页面包含：
1. **一句话说明** — 这个功能解决什么问题
2. **使用步骤** — 带截图的 step-by-step
3. **支持范围** — 支持哪些平台/格式
4. **常见问题** — 该功能特有的 FAQ
5. **提示/注意** — 使用技巧和注意事项

## 执行计划

1. ✅ 规划站点结构
2. 创建 mint.json 配置
3. 逐页生成 Markdown 内容（按导航顺序）
4. 本地预览验证
5. 提交推送
