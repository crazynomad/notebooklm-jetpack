# 收藏夹 & 批量 PDF 聚合功能

> 设计文档 — 2026-02-24

## 概述

新增一级 tab「收藏」，提供"稍后再读"收藏功能，并支持将收藏的多篇文章聚合生成一个 PDF 导入 NotebookLM。

## 用户场景

1. **日常浏览收集**：看到好文章 → 一键收藏 → 晚上统一处理
2. **主题研究**：围绕某个主题收集 10-20 篇文章 → 聚合成一个 PDF → 上传到 NotebookLM 做交叉分析
3. **分组管理**：不同项目/主题建不同集合

## 功能设计

### Tab 布局
```
文档站 | 播客 | AI 对话 | 收藏 | 更多
```

### 收藏操作
- **一键收藏当前页面**：在任意网页打开 popup → 收藏 tab 显示当前页面信息 → 点击「+ 收藏」
- **收藏信息**：URL、页面标题、收藏时间、缩略图（favicon）
- **集合管理**：默认集合「未分类」，可新建集合（如"AI 研究"、"前端技术"）

### 收藏列表
- 按集合分组显示
- 每项显示：favicon + 标题 + URL（truncate）+ 收藏时间
- 勾选/取消勾选
- 删除单项
- 搜索/筛选

### 批量操作
- **聚合导出 PDF**：选中多篇 → 抓取内容 → 合并为一个 PDF → 下载
- **批量导入 NotebookLM**：选中多篇 → 逐个以文本方式导入
- **清空已选/全选**

### 存储
- 使用 `chrome.storage.local`（无大小限制困扰，比 sync 大得多，10MB+）
- 数据结构：

```typescript
interface BookmarkItem {
  id: string;          // nanoid
  url: string;
  title: string;
  favicon?: string;
  collection: string;  // 集合名称，默认 'default'
  addedAt: number;     // timestamp
}

interface BookmarkStore {
  items: BookmarkItem[];
  collections: string[];  // 集合名称列表
}
```

## 实现计划

### 文件结构
```
services/bookmarks.ts        — 存储 CRUD
components/BookmarkPanel.tsx  — 收藏 tab UI
```

### 依赖
- 复用 `services/pdf-generator.ts` 的 PDF 导出能力
- 复用 `services/notebooklm.ts` 的 importText 导入能力
- 复用 offscreen document 的 HTML→Markdown 转换
