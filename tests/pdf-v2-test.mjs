/**
 * Test PDF v2 with Turndown markdown + proper formatting
 * Run: node tests/pdf-v2-test.mjs
 */

import PDFDocument from 'pdfkit';
import TurndownService from 'turndown';
import fs from 'fs';
import { JSDOM } from 'jsdom';

const FONT_REGULAR = '/tmp/NotoSansSC-Regular.ttf';
const FONT_BOLD = '/tmp/NotoSansSC-Bold.ttf';

const TEST_PAGES = [
  { url: 'https://docs.openclaw.ai/start/getting-started', title: 'Getting Started', section: 'First Steps', level: 0 },
  { url: 'https://docs.openclaw.ai/concepts/features', title: 'Features', section: 'Core Concepts', level: 0 },
  { url: 'https://docs.openclaw.ai/channels/telegram', title: 'Telegram', section: 'Channels', level: 0 },
  { url: 'https://docs.openclaw.ai/gateway/configuration', title: 'Configuration', section: 'Gateway', level: 0 },
  { url: 'https://docs.openclaw.ai/tools/browser', title: 'Browser', section: 'Tools', level: 0 },
];

// ─── Turndown extraction ───────────────────────────────────────
function createTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  td.addRule('fencedCodeBlock', {
    filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
    replacement: (_content, node) => {
      const code = node.querySelector('code');
      const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
      const text = code?.textContent || '';
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    },
  });
  td.addRule('removeImages', { filter: 'img', replacement: () => '' });
  return td;
}

function extractContent(html, url) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const selectors = ['article', 'main', '[role="main"]', '#content', '.prose', '.content'];
  let el = null;
  for (const sel of selectors) { el = doc.querySelector(sel); if (el) break; }
  if (!el) el = doc.body;
  el.querySelectorAll('script, style, nav, footer, header, .sidebar, .toc, .breadcrumb, .pagination, .edit-page, .prev-next').forEach(e => e.remove());
  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || url;
  const td = createTurndown();
  const markdown = td.turndown(el.innerHTML);
  return { title, markdown };
}

async function fetchPages(pages) {
  const results = [];
  for (const page of pages) {
    process.stdout.write(`  ${page.title}...`);
    try {
      const res = await fetch(page.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { console.log(` ❌ ${res.status}`); continue; }
      const html = await res.text();
      const { title, markdown } = extractContent(html, page.url);
      console.log(` ✅ ${markdown.length} chars, ${markdown.split('\n').filter(l => l.startsWith('#')).length} headings`);
      results.push({ ...page, title: title || page.title, markdown });
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }
  return results;
}

// ─── Markdown → PDF (PDFKit) ───────────────────────────────────
function renderMarkdownToPdf(doc, markdown) {
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = '';

  for (const line of lines) {
    // Code block
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
        continue;
      } else {
        // Render code block
        const codeText = codeLines.join('\n');
        if (codeText.trim()) {
          doc.moveDown(0.3);
          const x = doc.x;
          const startY = doc.y;
          // Background rect
          doc.save();
          doc.font('Courier').fontSize(8).fillColor('#1a1a1a');
          if (codeLang) {
            doc.fillColor('#888').text(`[${codeLang}]`, x + 8, doc.y, { width: 440 });
          }
          // Code text
          doc.fillColor('#1a1a1a').text(codeText, x + 8, doc.y, { width: 440 });
          const endY = doc.y + 4;
          // Draw background behind (as a rect)
          doc.save().rect(x, startY - 2, 460, endY - startY + 4).fillColor('#f5f5f5').fill().restore();
          // Re-render text on top
          doc.y = startY;
          doc.font('Courier').fontSize(8).fillColor('#555');
          if (codeLang) {
            doc.text(`[${codeLang}]`, x + 8, doc.y, { width: 440 });
          }
          doc.fillColor('#1a1a1a').text(codeText, x + 8, doc.y, { width: 440 });
          doc.restore();
          doc.moveDown(0.5);
        }
        inCodeBlock = false;
        codeLines = [];
        codeLang = '';
        continue;
      }
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Empty line = spacing
    if (!line.trim()) { doc.moveDown(0.3); continue; }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].replace(/\*\*/g, '');
      const sizes = { 1: 18, 2: 15, 3: 13, 4: 11, 5: 10, 6: 10 };
      doc.moveDown(level <= 2 ? 0.8 : 0.5);
      doc.font('ChineseBold').fontSize(sizes[level] || 11).fillColor('#1a1a1a').text(text);
      doc.moveDown(0.3);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const text = line.slice(2).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
      const x = doc.x;
      doc.save();
      doc.rect(x + 8, doc.y, 2, 14).fill('#3b82f6');
      doc.font('Chinese').fontSize(10).fillColor('#4b5563').text(text, x + 16, doc.y, { width: 430 });
      doc.restore();
      doc.moveDown(0.2);
      continue;
    }

    // List items
    if (line.match(/^[-*+]\s/)) {
      const text = stripInline(line.replace(/^[-*+]\s/, ''));
      doc.font('Chinese').fontSize(10).fillColor('#333');
      doc.text(`  •  ${text}`, { indent: 8, lineGap: 2 });
      continue;
    }
    const olMatch = line.match(/^(\d+)\.\s(.+)/);
    if (olMatch) {
      doc.font('Chinese').fontSize(10).fillColor('#333');
      doc.text(`  ${olMatch[1]}.  ${stripInline(olMatch[2])}`, { indent: 8, lineGap: 2 });
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}\s*$/)) {
      doc.moveDown(0.3);
      doc.moveTo(doc.x, doc.y).lineTo(doc.x + 460, doc.y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      continue;
    }

    // Regular paragraph — render with inline formatting
    renderInlineText(doc, line);
    doc.moveDown(0.2);
  }
}

function stripInline(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}

function renderInlineText(doc, text) {
  // Parse bold, italic, code inline
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;
  const parts = [];

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), type: 'normal' });
    }
    if (match[2]) parts.push({ text: match[2], type: 'bold' });
    else if (match[3]) parts.push({ text: match[3], type: 'italic' });
    else if (match[4]) parts.push({ text: match[4], type: 'code' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), type: 'normal' });

  if (parts.length === 0) {
    doc.font('Chinese').fontSize(10).fillColor('#333').text(text, { lineGap: 3 });
    return;
  }

  // Render as continued text
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const continued = i < parts.length - 1;
    if (p.type === 'bold') {
      doc.font('ChineseBold').fontSize(10).fillColor('#1a1a1a').text(p.text, { continued, lineGap: 3 });
    } else if (p.type === 'italic') {
      doc.font('Chinese').fontSize(10).fillColor('#555').text(p.text, { continued, lineGap: 3 });
    } else if (p.type === 'code') {
      doc.font('Courier').fontSize(9).fillColor('#c7254e').text(p.text, { continued, lineGap: 3 });
    } else {
      doc.font('Chinese').fontSize(10).fillColor('#333').text(p.text, { continued, lineGap: 3 });
    }
  }
}

// ─── Generate PDF ──────────────────────────────────────────────
async function generatePdf(siteTitle, pages, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.registerFont('Chinese', FONT_REGULAR);
    doc.registerFont('ChineseBold', FONT_BOLD);

    // Title page
    doc.font('ChineseBold').fontSize(28).fillColor('#1a1a1a').text(siteTitle, { align: 'center' });
    doc.moveDown(1);
    doc.font('Chinese').fontSize(12).fillColor('#666').text(`${pages.length} pages · ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#999').text('Generated by NotebookLM Importer', { align: 'center' });

    // TOC
    doc.addPage();
    doc.font('ChineseBold').fontSize(20).fillColor('#1a1a1a').text('Table of Contents');
    doc.moveDown(1);

    const sections = new Map();
    for (const page of pages) { const s = page.section || 'General'; if (!sections.has(s)) sections.set(s, []); sections.get(s).push(page); }

    for (const [section, sPages] of sections) {
      doc.font('ChineseBold').fontSize(12).fillColor('#333').text(section);
      for (const page of sPages) {
        doc.font('Chinese').fontSize(10).fillColor('#555').text(`  · ${page.title}`, { indent: 10 });
      }
      doc.moveDown(0.3);
    }

    // Content pages
    for (const [section, sPages] of sections) {
      doc.addPage();
      doc.font('ChineseBold').fontSize(22).fillColor('#333').text(section);
      doc.moveDown(0.5);

      for (const page of sPages) {
        doc.font('ChineseBold').fontSize(16).fillColor('#1a1a1a').text(page.title);
        doc.font('Chinese').fontSize(8).fillColor('#888').text(page.url);
        doc.moveDown(0.5);

        renderMarkdownToPdf(doc, page.markdown);

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        doc.moveDown(0.5);
      }
    }

    // Page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Chinese').fontSize(8).fillColor('#aaa')
        .text(`${siteTitle} — Page ${i + 1}`, 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔬 PDF v2 Test (Turndown + Markdown rendering)');
  console.log('==============================================\n');

  if (!fs.existsSync(FONT_REGULAR)) { console.log('❌ Need Chinese fonts'); process.exit(1); }

  console.log('1️⃣  Fetching pages with Turndown...');
  const pages = await fetchPages(TEST_PAGES);
  console.log(`\n   ✅ ${pages.length} pages\n`);

  // Show markdown sample
  console.log('📝 Markdown sample (first page, first 500 chars):');
  console.log('─'.repeat(50));
  console.log(pages[0]?.markdown.slice(0, 500));
  console.log('─'.repeat(50));

  console.log('\n2️⃣  Generating PDF...');
  const outPath = '/tmp/openclaw-docs-v2.pdf';
  await generatePdf('OpenClaw Documentation', pages, outPath);

  const stats = fs.statSync(outPath);
  console.log(`   ✅ ${outPath} (${(stats.size / 1024).toFixed(1)} KB)\n`);

  console.log('📊 Per-page stats:');
  for (const p of pages) {
    const headings = p.markdown.split('\n').filter(l => l.match(/^#{1,6}\s/)).length;
    const codeBlocks = (p.markdown.match(/```/g) || []).length / 2;
    const lists = p.markdown.split('\n').filter(l => l.match(/^[-*+]\s|^\d+\.\s/)).length;
    console.log(`   ${p.section.padEnd(14)} │ ${p.title.padEnd(22)} │ ${String(headings).padStart(2)} headings │ ${String(Math.floor(codeBlocks)).padStart(2)} code │ ${String(lists).padStart(3)} list items`);
  }

  console.log('\n✅ Opening PDF...');
  const { execSync } = await import('child_process');
  execSync(`open "${outPath}"`);
}

main().catch(console.error);
