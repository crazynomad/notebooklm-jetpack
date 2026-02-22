/**
 * E2E test: fetch real doc pages and generate PDF using PDFKit
 * Run: node tests/pdf-e2e-test.mjs
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import { JSDOM } from 'jsdom';

// ─── Config ────────────────────────────────────────────────────
const TEST_SITE = {
  title: 'OpenClaw Documentation',
  baseUrl: 'https://docs.openclaw.ai',
};

const TEST_PAGES = [
  { url: 'https://docs.openclaw.ai/start/getting-started', title: 'Getting Started', path: '/start/getting-started', level: 0, section: 'First Steps' },
  { url: 'https://docs.openclaw.ai/concepts/features', title: 'Features', path: '/concepts/features', level: 0, section: 'Core Concepts' },
  { url: 'https://docs.openclaw.ai/channels/telegram', title: 'Telegram', path: '/channels/telegram', level: 0, section: 'Channels' },
  { url: 'https://docs.openclaw.ai/gateway/configuration', title: 'Configuration', path: '/gateway/configuration', level: 0, section: 'Gateway' },
  { url: 'https://docs.openclaw.ai/tools/browser', title: 'Browser', path: '/tools/browser', level: 0, section: 'Tools' },
];

// ─── Content Extraction ────────────────────────────────────────
function extractContent(html, url) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const selectors = ['article', 'main', '[role="main"]', '#content', '.prose'];
  let contentEl = null;
  for (const sel of selectors) {
    contentEl = doc.querySelector(sel);
    if (contentEl) break;
  }
  if (!contentEl) contentEl = doc.body;

  contentEl.querySelectorAll('script, style, nav, footer, header, .sidebar, .toc, .breadcrumb').forEach(el => el.remove());

  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || url;
  const text = contentEl.textContent?.replace(/\s+/g, ' ').trim() || '';

  return { title, text };
}

// ─── Fetch Pages ───────────────────────────────────────────────
async function fetchPages(pages) {
  const results = [];
  for (const page of pages) {
    process.stdout.write(`  Fetching: ${page.title}...`);
    try {
      const res = await fetch(page.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { console.log(` ❌ ${res.status}`); continue; }
      const html = await res.text();
      const { title, text } = extractContent(html, page.url);
      const wordCount = text.split(/\s+/).length;
      console.log(` ✅ ${wordCount} words, ${text.length} chars`);
      results.push({ ...page, title: title || page.title, text, wordCount });
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }
  return results;
}

// ─── Generate PDF with PDFKit ──────────────────────────────────
function generatePdf(siteTitle, pages, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    // Title page
    doc.fontSize(28).font('Helvetica-Bold').text(siteTitle, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica').fillColor('#666')
      .text(`${pages.length} pages · Generated ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#999')
      .text(`Total: ${pages.reduce((s, p) => s + p.wordCount, 0).toLocaleString()} words`, { align: 'center' });

    // TOC
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#000').text('Table of Contents');
    doc.moveDown(1);

    const sections = new Map();
    for (const page of pages) {
      const s = page.section || 'General';
      if (!sections.has(s)) sections.set(s, []);
      sections.get(s).push(page);
    }

    for (const [section, sPages] of sections) {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#333').text(section);
      for (const page of sPages) {
        doc.fontSize(10).font('Helvetica').fillColor('#555').text(`  • ${page.title}`, { indent: 10 });
      }
      doc.moveDown(0.5);
    }

    // Content pages
    for (const [section, sPages] of sections) {
      doc.addPage();
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#333').text(section);
      doc.moveDown(1);

      for (const page of sPages) {
        // Title
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(page.title);
        doc.fontSize(8).font('Helvetica').fillColor('#888').text(page.url);
        doc.moveDown(0.5);

        // Body - split into chunks to avoid overflow
        const chunks = page.text.match(/.{1,3000}/g) || [page.text];
        for (const chunk of chunks) {
          doc.fontSize(10).font('Helvetica').fillColor('#000').text(chunk, { lineGap: 3 });
        }

        // Separator
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#DDD').lineWidth(0.5).stroke();
        doc.moveDown(0.5);
      }
    }

    // Footer on each page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica').fillColor('#AAA')
        .text(`${siteTitle} — Page ${i + 1}`, 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔬 PDF Generation E2E Test');
  console.log('========================\n');

  console.log(`📖 Site: ${TEST_SITE.title}`);
  console.log(`📄 Pages: ${TEST_PAGES.length}\n`);

  // 1. Fetch
  console.log('1️⃣  Fetching pages...');
  const pages = await fetchPages(TEST_PAGES);
  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);
  console.log(`\n   ✅ Fetched: ${pages.length}/${TEST_PAGES.length} pages, ${totalWords.toLocaleString()} words\n`);

  if (pages.length === 0) { console.log('❌ No pages, aborting'); process.exit(1); }

  // 2. Generate PDF
  console.log('2️⃣  Generating PDF...');
  const outPath = '/tmp/openclaw-docs-test.pdf';
  await generatePdf(TEST_SITE.title, pages, outPath);

  const stats = fs.statSync(outPath);
  console.log(`   ✅ PDF: ${outPath} (${(stats.size / 1024).toFixed(1)} KB)\n`);

  // 3. Summary
  console.log('📊 Results:');
  console.log('┌─────────────────┬──────────────────────┬────────┐');
  console.log('│ Section         │ Title                │ Words  │');
  console.log('├─────────────────┼──────────────────────┼────────┤');
  for (const page of pages) {
    console.log(`│ ${page.section.padEnd(15)} │ ${page.title.padEnd(20)} │ ${String(page.wordCount).padStart(6)} │`);
  }
  console.log('├─────────────────┼──────────────────────┼────────┤');
  console.log(`│ TOTAL           │ ${String(pages.length + ' pages').padEnd(20)} │ ${String(totalWords).padStart(6)} │`);
  console.log('└─────────────────┴──────────────────────┴────────┘');
  console.log(`\n📦 PDF Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`📐 Avg words/page: ${Math.round(totalWords / pages.length)}`);
  
  // Estimate for full 159 pages
  const estimatedFullSize = (stats.size / pages.length) * 159;
  const estimatedFullWords = (totalWords / pages.length) * 159;
  console.log(`\n📈 Estimated full site (159 pages):`);
  console.log(`   Size: ~${(estimatedFullSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Words: ~${Math.round(estimatedFullWords).toLocaleString()}`);
  console.log(`   Within NLM limit (500k words): ${estimatedFullWords < 500000 ? '✅ YES' : '⚠️ May need splitting'}`);

  console.log('\n✅ Test passed!');
}

main().catch(console.error);
