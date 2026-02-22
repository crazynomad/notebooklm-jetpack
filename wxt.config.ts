import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',

  dev: {
    server: {
      port: 3003,
      hostname: 'localhost',
    },
  },

  manifest: {
    name: 'NotebookLM Importer',
    description: '一键导入网页、RSS、文档站点、Claude 对话到 NotebookLM，支持批量导入，完全免费无需登录',
    version: '1.0.0',
    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'scripting',
      'contextMenus',
    ],
    host_permissions: [
      'https://notebooklm.google.com/*',
      'https://claude.ai/*',
    ],
    action: {
      default_title: 'NotebookLM Importer',
      default_popup: 'popup.html',
    },
    icons: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },

  vite: ({ mode }) => ({
    define: {
      'process.env': '{}',
      'process.env.NODE_ENV': mode === 'development' ? '"development"' : '"production"',
    },
  }),
});
