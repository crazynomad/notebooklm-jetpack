/**
 * Chrome Web Store Promotional Image Capture Script
 *
 * Captures promotional images from promo-images.html at exact pixel dimensions.
 * Uses Playwright to render and screenshot each design element.
 *
 * Usage:
 *   npx playwright install chromium   # first time only
 *   node docs/promo/capture.mjs
 *
 * Output:
 *   docs/promo/small-tile-en.png      (440×280)
 *   docs/promo/small-tile-cn.png      (440×280)
 *   docs/promo/marquee-en.png         (1400×560)
 *   docs/promo/marquee-cn.png         (1400×560)
 *   docs/promo/screenshot-en.png      (1280×800)
 *   docs/promo/screenshot-cn.png      (1280×800)
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGES = [
  { id: 'small-tile-en', file: 'small-tile-en.png', width: 440, height: 280 },
  { id: 'small-tile-cn', file: 'small-tile-cn.png', width: 440, height: 280 },
  { id: 'marquee-en', file: 'marquee-en.png', width: 1400, height: 560 },
  { id: 'marquee-cn', file: 'marquee-cn.png', width: 1400, height: 560 },
  { id: 'screenshot-en', file: 'screenshot-en.png', width: 1280, height: 800 },
  { id: 'screenshot-cn', file: 'screenshot-cn.png', width: 1280, height: 800 },
];

async function main() {
  const htmlPath = join(__dirname, 'promo-images.html');
  const browser = await chromium.launch();
  // Use a large viewport to fit the widest image (1400px marquee)
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  // Wait for Google Fonts to load
  await page.waitForTimeout(2000);

  for (const img of IMAGES) {
    const element = page.locator(`#${img.id}`);
    const box = await element.boundingBox();
    if (!box) {
      console.error(`  ✗ Element #${img.id} not found`);
      continue;
    }

    const outPath = join(__dirname, img.file);
    await element.screenshot({ path: outPath });

    console.log(`  ✓ ${img.file} (${img.width}×${img.height})`);
  }

  await browser.close();
  console.log(`\nDone! ${IMAGES.length} images saved to docs/promo/`);
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
