import { launch } from 'puppeteer';
import { readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await launch({ headless: 'new', args: ['--no-sandbox'] });
  const files = readdirSync(__dirname).filter(f => f.startsWith('_') && f.endsWith('.html'));
  
  for (const file of files.sort()) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(`file://${resolve(__dirname, file)}`, { waitUntil: 'networkidle0', timeout: 15000 });
    const outName = file.replace(/^_/, '').replace('.html', '.png');
    await page.screenshot({ path: resolve(__dirname, outName), type: 'png' });
    console.log(`✅ ${outName}`);
    await page.close();
  }
  
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
