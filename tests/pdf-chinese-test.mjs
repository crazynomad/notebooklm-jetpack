/**
 * Test PDF generation with Chinese content
 * Run: node tests/pdf-chinese-test.mjs
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import { JSDOM } from 'jsdom';

const FONT_REGULAR = '/tmp/NotoSansSC-Regular.ttf';
const FONT_BOLD = '/tmp/NotoSansSC-Bold.ttf';

// Test with real Chinese doc pages
const TEST_PAGES = [
  { url: 'https://developers.weixin.qq.com/miniprogram/dev/framework/', title: '微信小程序框架', section: '框架', level: 0 },
  { url: 'https://docs.openclaw.ai/zh-CN/start/getting-started', title: '快速开始', section: '入门', level: 0 },
  { url: 'https://docs.openclaw.ai/zh-CN/channels/telegram', title: 'Telegram 频道', section: '消息渠道', level: 0 },
];

function extractContent(html, url) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const selectors = ['article', 'main', '[role="main"]', '#content', '.content', '.markdown-body'];
  let el = null;
  for (const sel of selectors) { el = doc.querySelector(sel); if (el) break; }
  if (!el) el = doc.body;
  el.querySelectorAll('script, style, nav, footer, header').forEach(e => e.remove());
  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || url;
  const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
  return { title, text };
}

async function fetchPages(pages) {
  const results = [];
  for (const page of pages) {
    process.stdout.write(`  ${page.title}...`);
    try {
      const res = await fetch(page.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { console.log(` ❌ ${res.status}`); continue; }
      const html = await res.text();
      const { title, text } = extractContent(html, page.url);
      console.log(` ✅ ${text.length} chars`);
      results.push({ ...page, title: title || page.title, text, wordCount: text.length });
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }
  return results;
}

async function generatePdf(pages, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    // Register Chinese fonts
    doc.registerFont('Chinese', FONT_REGULAR);
    doc.registerFont('ChineseBold', FONT_BOLD);

    // Title page
    doc.font('ChineseBold').fontSize(28).text('文档站 PDF 导出测试', { align: 'center' });
    doc.moveDown(1);
    doc.font('Chinese').fontSize(12).fillColor('#666')
      .text(`${pages.length} 个页面 · 生成日期 ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#999')
      .text('由 NotebookLM Jetpack 扩展生成', { align: 'center' });

    // TOC
    doc.addPage();
    doc.font('ChineseBold').fontSize(20).fillColor('#000').text('目录');
    doc.moveDown(1);

    const sections = new Map();
    for (const page of pages) {
      const s = page.section || '其他';
      if (!sections.has(s)) sections.set(s, []);
      sections.get(s).push(page);
    }

    for (const [section, sPages] of sections) {
      doc.font('ChineseBold').fontSize(13).fillColor('#333').text(section);
      for (const page of sPages) {
        doc.font('Chinese').fontSize(10).fillColor('#555').text(`  · ${page.title}`, { indent: 10 });
      }
      doc.moveDown(0.5);
    }

    // Content
    for (const [section, sPages] of sections) {
      doc.addPage();
      doc.font('ChineseBold').fontSize(22).fillColor('#333').text(section);
      doc.moveDown(1);

      for (const page of sPages) {
        doc.font('ChineseBold').fontSize(16).fillColor('#000').text(page.title);
        doc.font('Chinese').fontSize(8).fillColor('#888').text(page.url);
        doc.moveDown(0.5);

        // Body - truncate for test (first 3000 chars)
        const text = page.text.slice(0, 3000);
        doc.font('Chinese').fontSize(10).fillColor('#000').text(text, { lineGap: 4 });

        if (page.text.length > 3000) {
          doc.font('Chinese').fontSize(9).fillColor('#999').text(`... (${page.text.length - 3000} 字符被截断)`);
        }

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#DDD').lineWidth(0.5).stroke();
        doc.moveDown(0.5);
      }
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function main() {
  console.log('🔬 Chinese PDF Test');
  console.log('==================\n');

  // Check fonts exist
  if (!fs.existsSync(FONT_REGULAR)) {
    console.log('❌ Chinese font not found. Run:');
    console.log('curl -sL "https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf" -o /tmp/NotoSansSC-Regular.ttf');
    process.exit(1);
  }

  console.log('1️⃣  Fetching Chinese doc pages...');
  const pages = await fetchPages(TEST_PAGES);
  console.log(`   ✅ ${pages.length} pages fetched\n`);

  if (pages.length === 0) { console.log('❌ No pages'); process.exit(1); }

  console.log('2️⃣  Generating PDF with Chinese fonts...');
  const outPath = '/tmp/chinese-docs-test.pdf';
  await generatePdf(pages, outPath);

  const stats = fs.statSync(outPath);
  console.log(`   ✅ PDF: ${outPath} (${(stats.size / 1024).toFixed(1)} KB)\n`);

  console.log('📊 Results:');
  for (const page of pages) {
    console.log(`   ${page.section.padEnd(8)} │ ${page.title.padEnd(20)} │ ${page.text.length} chars`);
  }
  console.log(`\n📦 Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log('\n✅ Opening PDF...');

  // Open it
  const { execSync } = await import('child_process');
  execSync(`open "${outPath}"`);
}

main().catch(console.error);
