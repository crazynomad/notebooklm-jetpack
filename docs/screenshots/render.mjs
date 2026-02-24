// Render screenshot HTML files to 1280x800 PNG at 2x resolution
// Usage: node docs/screenshots/render.mjs
// Requires: npx playwright install chromium (first time only)

import { chromium } from 'playwright';
import { readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch();
  const files = readdirSync(__dirname)
    .filter((f) => f.startsWith('_') && f.endsWith('.html'))
    .sort();

  for (const file of files) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    await page.goto(`file://${resolve(__dirname, file)}`, {
      waitUntil: 'networkidle',
    });
    // Wait for Google Fonts to fully render
    await page.waitForTimeout(2000);

    const outName = file.replace(/^_/, '').replace('.html', '.png');
    await page.screenshot({
      path: resolve(__dirname, outName),
      type: 'png',
    });
    console.log(`✓ ${outName}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone! ${files.length} screenshots saved.`);
}

main().catch((e) => {
  console.error('Render failed:', e);
  process.exit(1);
});
