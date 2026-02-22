# 文档站点支持清单

> 更新日期：2026-02-22

## 提取策略

| 策略 | 说明 | 可靠性 |
|------|------|--------|
| **Sitemap** | 解析 sitemap.xml（XML 或纯文本格式） | ⭐⭐⭐ 最可靠，不受 UI 变化影响 |
| **DOM** | Content script 解析侧边栏链接 | ⭐⭐ 依赖 UI 结构，可能因改版失效 |
| **JSON** | 从页面内嵌 JSON（如 `__INITIAL_STATE__`）提取 | ⭐⭐⭐ 可靠，但格式可能变化 |
| **SPA** | 需等待 JS 渲染后再提取 | ⭐ 最不可靠，延迟高 |

---

## 通用框架支持

我们内置了以下文档框架的检测和提取逻辑：

| 框架 | 检测方式 | 提取策略 | 测试状态 | 代表站点 |
|------|---------|---------|---------|---------|
| Docusaurus | `meta[generator]` / `.docusaurus` | DOM 侧边栏 `.menu__list` | ✅ 已测 | react.dev, many OSS |
| MkDocs / Material | `meta[generator]` / `.md-nav` | DOM 侧边栏 | ✅ 已测 | |
| GitBook | `.gitbook-root` / `GITBOOK_RUNTIME` | DOM 侧边栏 | ✅ 已测 | |
| VitePress | `.VPSidebar` | DOM 侧边栏 | ✅ 已测 | vitepress.dev |
| Sphinx / ReadTheDocs | `meta[generator]` / `.wy-nav-side` | DOM 侧边栏 | ✅ 已测 | docs.python.org |
| Mintlify | `meta[generator="Mintlify"]` | DOM + Sitemap | ✅ 已测 | docs.openclaw.ai |
| Anthropic Docs | 特征 class（旧版） | DOM 侧边栏 | ⚠️ 已迁移 | 见下方 |

---

## 重点站点测试清单

### ✅ 已验证通过

| # | 站点 | URL | 框架 | 策略 | 页面数 | 备注 |
|---|------|-----|------|------|--------|------|
| 1 | **OpenClaw Docs** | docs.openclaw.ai | Mintlify | Sitemap (XML) | 159 | |
| 2 | **微信小程序文档** | developers.weixin.qq.com/miniprogram/dev/ | 自研 | Sitemap (纯文本) | 1,481 | 非标准 sitemap 格式 |
| 3 | **语雀知识库** | yuque.com/{user}/{book} | 自研 | JSON (TOC) | 75+ | `__INITIAL_STATE__` |
| 4 | **Stripe Docs** | docs.stripe.com | 自研 | Sitemap (XML) | 3,028 | 需路径过滤 |
| 5 | **OpenAI Docs** | platform.openai.com/docs | 自研 | Sitemap (XML) | 103 | |
| 6 | **Docker Docs** | docs.docker.com | 自研 | Sitemap Index | ~2,000+ | 需递归解析 |
| 7 | **Supabase Docs** | supabase.com/docs | 自研 | Sitemap Index | ~500+ | 需递归解析 |
| 8 | **Kubernetes Docs** | kubernetes.io/docs | Hugo | Sitemap (XML) | ~1,000+ | sitemap 在根域名 |
| 9 | **Next.js Docs** | nextjs.org/docs | 自研 | Sitemap (XML) | 700+ | sitemap 在根域名，需路径过滤 |

| 10 | **Anthropic Docs** | platform.claude.com/docs/en/ | Next.js | Sitemap (XML) | 725 (EN) / 2,905 (全语言) | 已从 docs.anthropic.com 迁移 |

### ⚠️ 需改进

| # | 站点 | URL | 框架 | 问题 | 优先级 |
|---|------|-----|------|------|--------|
| 11 | **鸿蒙开发文档** | developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ | Angular SPA | 初始 HTML 为空，sidebar 由 JS 渲染 | 🟡 中 |

### 📋 待测试

| # | 站点 | URL | 预期框架 | 预期策略 | 优先级 |
|---|------|-----|---------|---------|--------|
| 12 | **React 官方文档** | react.dev | 自研 | DOM（无 sitemap） | 🟡 中 |
| 13 | **Tailwind CSS Docs** | tailwindcss.com/docs | 自研 | DOM（无 sitemap） | 🟡 中 |
| 14 | **Vue.js Docs** | vuejs.org/guide/ | VitePress | DOM 侧边栏 | 🟡 中 |
| 15 | **GitHub Docs** | docs.github.com | 自研 | DOM（无 sitemap） | 🟡 中 |
| 16 | **Vercel Docs** | vercel.com/docs | 自研 | DOM（无 sitemap） | 🟢 低 |
| 17 | **Cursor Docs** | docs.cursor.com | 自研 | 待探测 | 🟢 低 |
| 18 | **LangChain/LangGraph** | langchain-ai.github.io/langgraph | MkDocs? | DOM 侧边栏 | 🟡 中 |

### 🇨🇳 中国特色站点

| # | 站点 | URL | 框架 | 策略 | 状态 | 优先级 |
|---|------|-----|------|------|------|--------|
| 19 | **微信小程序文档** | developers.weixin.qq.com/miniprogram/dev/ | 自研 | ✅ Sitemap | 已通过 | ✅ |
| 20 | **微信公众号文档** | developers.weixin.qq.com/doc/offiaccount/ | 自研 | Sitemap | 待测 | 🟡 中 |
| 21 | **语雀** | yuque.com/* | 自研 | ✅ JSON TOC | 已通过 | ✅ |
| 22 | **鸿蒙开发文档** | developer.huawei.com | Angular SPA | ⚠️ SPA | 需改进 | 🟡 中 |
| 23 | **飞书开发文档** | open.feishu.cn/document | 自研 | 待探测 | 🟡 中 |
| 24 | **钉钉开发文档** | open.dingtalk.com/document | 自研 | 待探测 | 🟢 低 |
| 25 | **支付宝小程序文档** | opendocs.alipay.com | 自研 | 待探测 | 🟢 低 |

---

## 测试流程

### 自动化验证（CLI）

```bash
# 运行单元测试
pnpm test

# 检查 sitemap 可用性
curl -sL -o /dev/null -w "%{http_code}" https://{site}/sitemap.xml
```

### 手动端到端测试

1. 在 Chrome 中打开目标文档站
2. 点击扩展图标 → "文档站点" Tab
3. 检查：
   - [ ] 框架是否正确检测
   - [ ] 页面列表是否完整
   - [ ] 页面标题是否正确
   - [ ] 勾选几个页面 → 点击导入
   - [ ] 验证 NotebookLM 中是否成功添加来源

### 验证标准

- **通过**：正确检测框架 + 提取 >80% 页面 + 标题可读 + 导入成功
- **部分通过**：检测正确但页面不全或标题不佳
- **失败**：无法检测或无法提取页面

---

## 已知限制

1. **SPA 站点**（如鸿蒙、Anthropic 新版）需等待 JS 渲染，目前 content script 注入时机可能太早
2. **大型 sitemap**（如 Stripe 3000+ 页）导入到 NotebookLM 时需要分批，NotebookLM 有来源数限制
3. **纯文本 sitemap** 无法获取页面标题，只能从 URL path 推断
4. **需要登录的文档**（如某些企业内部文档）无法通过 sitemap 访问
5. **Sitemap index 递归** 可能较慢，需要多次 HTTP 请求
