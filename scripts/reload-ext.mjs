#!/usr/bin/env node
/**
 * Reload Chrome extension via CDP + chrome.developerPrivate API.
 * Requires chrome://extensions to be open in a Chrome instance with remote debugging.
 *
 * Usage: node scripts/reload-ext.mjs [extensionId]
 * Env: EXT_ID, CDP_PORT (default: tries 18800, 9222)
 */

const EXT_ID = process.argv[2] || process.env.EXT_ID || '';
const CDP_PORTS = (process.env.CDP_PORT || '18800,9222').split(',').map(p => p.trim());

if (!EXT_ID) {
  console.error('❌ No extension ID. Set EXT_ID env or pass as argument.');
  process.exit(1);
}

async function findExtensionsPage() {
  for (const port of CDP_PORTS) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await resp.json();
      const extPage = targets.find(t => t.url?.startsWith('chrome://extensions'));
      if (extPage) return { port, target: extPage };

      // No extensions page open — try to create one
      const createResp = await fetch(`http://127.0.0.1:${port}/json/new?chrome%3A%2F%2Fextensions`, { method: 'PUT' });
      if (createResp.ok) {
        const newTarget = await createResp.json();
        await new Promise(r => setTimeout(r, 1500)); // Wait for page load
        return { port, target: newTarget };
      }
    } catch { /* try next port */ }
  }
  return null;
}

async function reloadViaWs(wsUrl) {
  const { default: WebSocket } = await import('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `chrome.developerPrivate.reload('${EXT_ID}', {failQuietly: true}).then(() => 'ok').catch(e => 'error: ' + e.message)`,
          awaitPromise: true,
          returnByValue: true,
        },
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id === 1) {
        clearTimeout(timeout);
        ws.close();
        const value = msg.result?.result?.value;
        if (value === 'ok') resolve(true);
        else reject(new Error(value || 'Unknown error'));
      }
    });

    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

async function main() {
  console.log(`🔄 Reloading extension ${EXT_ID}...`);

  const found = await findExtensionsPage();
  if (!found) {
    console.log('⚠️  No Chrome with remote debugging found. Please reload manually.');
    process.exit(0);
  }

  console.log(`  CDP port ${found.port}, target: ${found.target.url}`);

  try {
    await reloadViaWs(found.target.webSocketDebuggerUrl);
    console.log('✅ Extension reloaded');
  } catch (err) {
    console.log(`⚠️  Reload failed: ${err.message}`);
  }
}

main().catch(console.error);
