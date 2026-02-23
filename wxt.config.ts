import { defineConfig } from 'wxt';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version as string;
const gitHash = execSync('git rev-parse --short HEAD').toString().trim();
const buildTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

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
    version,
    version_name: `${version}+${gitHash}`,
    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'scripting',
      'contextMenus',
      'downloads',
      'debugger',
      'offscreen',
    ],
    host_permissions: [
      'https://notebooklm.google.com/*',
      'https://claude.ai/*',
      'https://platform.claude.com/*',
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
      __GIT_HASH__: JSON.stringify(gitHash),
      __BUILD_TIME__: JSON.stringify(buildTime),
      __VERSION__: JSON.stringify(version),
    },
  }),
});
