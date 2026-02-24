# 2025-02-24

## NotebookLM Jetpack 开发进展

### 今日完成
- ImportPanel.tsx i18n 转换（最后一个遗漏组件）
- 手动语言切换（EN/中）+ localStorage 持久化 + useSyncExternalStore 响应式
- AI Chat tab 新增引导说明（4 步 onboarding）
- Icon 更新：蓝底圆形 + 白色 jetpack 小人（scale 0.9x）
- Popup header 使用实际 extension icon
- 新增 37 个测试（bookmarks 21 + i18n 11 + podcast 6），总计 99 个测试全部通过
- 优化 STORE_LISTING.md：精简名称、新增 YouTube/i18n 段落、英文版优化
- 当前版本：b598fa2 (未 release)，上一个 release 是 v1.1.41

### Chrome Web Store 发布 TODO

#### 1. 发布前准备
- [ ] `pnpm release` bump 版本、构建、提交、推送
- [ ] 确认 `dist/chrome-mv3/` 内容正确
- [ ] 打包 ZIP：`cd dist/chrome-mv3 && zip -r ../../notebooklm-jetpack.zip .`

#### 2. 商店素材
- [ ] 应用图标 128×128 PNG ✅ 已有
- [ ] 商店宣传图 1280×800 或 640×400（需设计）🔴 需要 Burn
- [ ] 截图 3-5 张 1280×800（收藏夹、文档站、AI 对话、批量导入、中英切换）
- [ ] 商店描述 ✅ 已有 docs/STORE_LISTING.md
- [ ] 分类：Productivity
- [ ] 隐私政策 URL（如需要）🔴 需要 Burn 决定

#### 3. 提交审核
- [ ] 登录 Chrome Web Store Developer Dashboard
- [ ] 上传 ZIP
- [ ] 填写 listing + 截图
- [ ] 填写隐私声明（权限用途）
- [ ] 提交（1-3 工作日）

#### 4. 发布后
- [ ] GitHub README 加 Chrome Web Store 链接/badge
- [ ] 创建 GitHub Release tag
- [ ] 社交媒体宣传
