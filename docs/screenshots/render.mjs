// Render screenshot HTML files to PNG (Chinese + English, full + 1280x800)
// Usage: node docs/screenshots/render.mjs
// Requires: npx playwright install chromium (first time only)

import { chromium } from 'playwright';
import { readdirSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch();

  // Ensure output directories exist
  const dirs = ['', 'en', '1280x800', '1280x800/en'];
  for (const d of dirs) {
    mkdirSync(resolve(__dirname, d), { recursive: true });
  }

  const files = readdirSync(__dirname)
    .filter((f) => f.startsWith('_') && f.endsWith('.html'))
    .sort();

  for (const file of files) {
    const isEn = file.includes('-en.html');
    const baseName = file
      .replace(/^_/, '')
      .replace('-en.html', '.png')
      .replace('.html', '.png');

    // Determine output paths
    const fullDir = isEn ? 'en' : '';
    const smallDir = isEn ? '1280x800/en' : '1280x800';

    // Render at 2x for high-res (2560x1600 actual pixels)
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    await page.goto(`file://${resolve(__dirname, file)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(2000);

    const fullPath = resolve(__dirname, fullDir, baseName);
    await page.screenshot({ path: fullPath, type: 'png' });
    console.log(`✓ ${fullDir ? fullDir + '/' : ''}${baseName}  (2x)`);

    // Render at 1x for 1280x800
    await page.setViewportSize({ width: 1280, height: 800 });
    // Force 1x by creating a new page
    await page.close();

    const page1x = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    await page1x.goto(`file://${resolve(__dirname, file)}`, {
      waitUntil: 'networkidle',
    });
    await page1x.waitForTimeout(1500);

    const smallPath = resolve(__dirname, smallDir, baseName);
    await page1x.screenshot({ path: smallPath, type: 'png' });
    console.log(`✓ ${smallDir}/${baseName}  (1x)`);
    await page1x.close();
  }

  await browser.close();
  console.log(`\nDone! ${files.length} slides × 2 resolutions = ${files.length * 2} screenshots.`);
}

main().catch((e) => {
  console.error('Render failed:', e);
  process.exit(1);
});
