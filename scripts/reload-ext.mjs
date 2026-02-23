#!/usr/bin/env node
/**
 * Reload the extension via CDP → chrome.runtime.sendMessage to the extension's
 * onMessageExternal handler.
 *
 * Usage: node scripts/reload-ext.mjs [extensionId]
 *
 * Requires: Chrome browser relay attached to a tab (OpenClaw), or
 *           Chrome launched with --remote-debugging-port=9222
 */

const EXT_ID = process.argv[2] || process.env.EXT_ID || '';
// Try multiple CDP ports: browser relay (18792), openclaw browser (18800), or custom
const CDP_PORTS = (process.env.CDP_PORT || '18792,18800').split(',').map(p => p.trim());

async function findExtensionId() {
  if (EXT_ID) return EXT_ID;

  // Try to discover from Chrome targets
  try {
    const resp = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
    const targets = await resp.json();
    for (const t of targets) {
      if (t.url?.startsWith('chrome-extension://') && t.url.includes('background')) {
        const id = t.url.split('/')[2];
        console.log(`  Found extension: ${id}`);
        return id;
      }
    }
  } catch { /* ignore */ }

  console.error('❌ No extension ID provided and could not auto-detect.');
  console.error('   Usage: node scripts/reload-ext.mjs <extensionId>');
  console.error('   Or set EXT_ID env var.');
  process.exit(1);
}

async function getPageTarget() {
  for (const port of CDP_PORTS) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/json`);
      const text = await resp.text();
      const targets = JSON.parse(text);
      const page = targets.find(t => t.type === 'page' && t.url?.startsWith('http'));
      if (page) {
        console.log(`  CDP connected on port ${port}`);
        return page;
      }
    } catch { /* try next port */ }
  }
  throw new Error('No page target found. Attach browser relay or start OpenClaw browser.');
}

async function sendCdpCommand(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 100000);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 5000);
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        clearTimeout(timeout);
        ws.removeEventListener('message', handler);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const extId = await findExtensionId();
  console.log(`🔄 Reloading extension ${extId}...`);

  const target = await getPageTarget();
  const { WebSocket } = await import('ws');
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  try {
    const result = await sendCdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage('${extId}', { type: 'DEV_RELOAD' }, (resp) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
            else resolve(resp);
          });
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result?.result?.value?.ok) {
      console.log('✅ Extension reload triggered');
    } else {
      console.log('⚠️  Response:', JSON.stringify(result?.result));
    }
  } catch (err) {
    console.error('❌ Reload failed:', err.message);
    console.error('   Make sure the extension has externally_connectable configured');
  }

  ws.close();
}

main().catch(console.error);
