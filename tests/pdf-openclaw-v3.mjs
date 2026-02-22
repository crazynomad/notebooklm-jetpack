#!/usr/bin/env node
/**
 * OpenClaw Docs → PDF v3: fetch raw Markdown from GitHub
 * Uses docs.json for page list + GitHub raw content
 */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { execSync } from 'child_process';

const OUT = '/tmp/openclaw-docs-v3.pdf';
const GITHUB_RAW = 'https://raw.githubusercontent.com/openclaw/openclaw/main/docs';

// ─── Fetch docs.json for page structure ────────────────────────
async function getPageList() {
  const r = await fetch(`${GITHUB_RAW}/docs.json`);
  const config = await r.json();

  const pages = [];
  const nav = config.navigation?.languages?.[0]?.tabs || config.navigation?.tabs || [];

  for (const tab of nav) {
    for (const group of (tab.groups || [])) {
      for (const page of (group.pages || [])) {
        const slug = typeof page === 'string' ? page : page.page || page;
        if (slug === 'index') continue;
        pages.push({ slug, group: group.group, tab: tab.tab });
      }
    }
  }
  return pages;
}

// ─── Fetch raw markdown from GitHub ────────────────────────────
async function fetchRawMd(slug) {
  const r = await fetch(`${GITHUB_RAW}/${slug}.md`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  let md = await r.text();

  // Strip frontmatter
  md = md.replace(/^---[\s\S]*?---\n*/, '');

  // Strip Mintlify JSX components but keep their text content
  md = md.replace(/<CardGroup[^>]*>[\s\S]*?<\/CardGroup>/g, '');
  md = md.replace(/<Card[^>]*>[\s\S]*?<\/Card>/g, '');
  md = md.replace(/<Steps>\s*/g, '');
  md = md.replace(/<\/Steps>\s*/g, '');
  md = md.replace(/<Step\s+title="([^"]*)"[^>]*>/g, '### $1');
  md = md.replace(/<\/Step>\s*/g, '');
  md = md.replace(/<Note>\s*/g, '> **Note:** ');
  md = md.replace(/<\/Note>\s*/g, '\n');
  md = md.replace(/<Warning>\s*/g, '> **Warning:** ');
  md = md.replace(/<\/Warning>\s*/g, '\n');
  md = md.replace(/<Tip>\s*/g, '> **Tip:** ');
  md = md.replace(/<\/Tip>\s*/g, '\n');
  md = md.replace(/<Info>\s*/g, '> **Info:** ');
  md = md.replace(/<\/Info>\s*/g, '\n');
  md = md.replace(/<AccordionGroup>\s*/g, '');
  md = md.replace(/<\/AccordionGroup>\s*/g, '');
  md = md.replace(/<Accordion\s+title="([^"]*)"[^>]*>/g, '#### $1');
  md = md.replace(/<\/Accordion>\s*/g, '');
  md = md.replace(/<Tabs>\s*/g, '');
  md = md.replace(/<\/Tabs>\s*/g, '');
  md = md.replace(/<Tab\s+title="([^"]*)"[^>]*>/g, '**$1:**\n');
  md = md.replace(/<\/Tab>\s*/g, '');
  md = md.replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, ''); // self-closing components
  md = md.replace(/<\/?[A-Z][a-zA-Z]*[^>]*>/g, ''); // remaining components

  // Clean up excessive blank lines
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

// ─── Render Markdown → PDFKit ──────────────────────────────────
function renderMd(pdf, md) {
  const lines = md.split('\n');
  let inCode = false, codeBuf = [], codeLang = '';

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuf = [];
        continue;
      }
      // Flush code block
      if (codeBuf.length) {
        const text = codeBuf.join('\n');
        const lineH = 10, pad = 8;
        const bh = Math.min(codeBuf.length * lineH + pad * 2, 400);
        if (pdf.y + bh > pdf.page.height - 60) pdf.addPage();
        const y0 = pdf.y;
        if (codeLang) {
          pdf.font('Helvetica').fontSize(7).fillColor('#888').text(codeLang, 56, y0 - 10);
        }
        pdf.save().roundedRect(52, y0, 490, bh, 4).fill('#f5f5f5').restore();
        pdf.font('Courier').fontSize(7.5).fillColor('#333').text(text, 60, y0 + pad, { width: 474 });
        pdf.y = y0 + bh + 6;
      }
      inCode = false; codeBuf = []; codeLang = ''; continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (!line.trim()) { pdf.moveDown(0.15); continue; }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const sz = { 1: 17, 2: 14, 3: 12, 4: 11 }[hm[1].length] || 10;
      pdf.moveDown(0.5).font('Helvetica-Bold').fontSize(sz).fillColor('#111').text(hm[2].replace(/\*\*/g, '')).moveDown(0.2);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const qy = pdf.y;
      // Handle inline bold in blockquotes
      const text = line.slice(2);
      renderInline(pdf, text, 66, 470, 8.5, true);
      const qh = Math.max(pdf.y - qy, 12);
      pdf.save().rect(54, qy, 2.5, qh).fill('#3b82f6').restore();
      pdf.moveDown(0.1);
      continue;
    }

    // Unordered list
    if (line.match(/^[-*+]\s/)) {
      const indent = line.match(/^(\s*)/)[1].length;
      const bullet = indent > 1 ? '◦' : '•';
      renderInline(pdf, `  ${bullet}  ${line.replace(/^\s*[-*+]\s/, '')}`, 50 + indent * 4, 486 - indent * 4, 9);
      continue;
    }

    // Ordered list
    const ol = line.match(/^(\d+)\.\s(.+)/);
    if (ol) {
      renderInline(pdf, `  ${ol[1]}.  ${ol[2]}`, 50, 486, 9);
      continue;
    }

    // HR
    if (line.match(/^[-_*]{3,}\s*$/)) {
      pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#ddd').lineWidth(0.5).stroke().moveDown(0.4);
      continue;
    }

    // Regular paragraph
    renderInline(pdf, line, 50, 490, 9);
  }
}

// Render a line with inline **bold**, *italic*, `code`
function renderInline(pdf, text, x, width, fontSize, isQuote = false) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  let started = false;

  for (const part of parts) {
    if (!part) continue;

    const opts = started ? { continued: true } : { continued: true, width };

    if (part.startsWith('**') && part.endsWith('**')) {
      pdf.font('Helvetica-Bold').fontSize(fontSize).fillColor(isQuote ? '#4b5563' : '#333');
      pdf.text(part.slice(2, -2), started ? undefined : x, undefined, opts);
    } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      pdf.font('Helvetica-Oblique').fontSize(fontSize).fillColor(isQuote ? '#4b5563' : '#555');
      pdf.text(part.slice(1, -1), started ? undefined : x, undefined, opts);
    } else if (part.startsWith('`') && part.endsWith('`')) {
      pdf.font('Courier').fontSize(fontSize - 0.5).fillColor('#c7254e');
      pdf.text(part.slice(1, -1), started ? undefined : x, undefined, opts);
    } else {
      pdf.font('Helvetica').fontSize(fontSize).fillColor(isQuote ? '#4b5563' : '#333');
      pdf.text(part, started ? undefined : x, undefined, opts);
    }
    started = true;
  }
  if (started) pdf.text('', { continued: false });
  if (!started) pdf.moveDown(0.1);
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔬 OpenClaw Docs → PDF v3 (GitHub raw markdown)\n');

  // Get page list from docs.json
  console.log('1️⃣  Fetching docs.json...');
  const allPages = await getPageList();
  console.log(`   ${allPages.length} pages in navigation\n`);

  // Fetch first 15 pages for testing
  const pagesToFetch = allPages.slice(0, 15);
  console.log(`2️⃣  Fetching ${pagesToFetch.length} raw markdown files...`);
  const contents = [];

  for (const p of pagesToFetch) {
    process.stdout.write(`   ${p.slug}...`);
    const md = await fetchRawMd(p.slug);
    if (md) {
      // Extract title from first # heading
      const titleMatch = md.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1] : p.slug.split('/').pop();
      console.log(` ✅ ${md.length} chars`);
      contents.push({ ...p, title, markdown: md });
    } else {
      console.log(' ❌');
    }
  }
  console.log(`\n   ✅ ${contents.length}/${pagesToFetch.length}\n`);

  // Generate PDF
  console.log('3️⃣  Generating PDF...');
  const pdf = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true });
  const stream = fs.createWriteStream(OUT);
  pdf.pipe(stream);

  // Title
  pdf.font('Helvetica-Bold').fontSize(28).fillColor('#FF5A36').text('OpenClaw', { align: 'center' });
  pdf.font('Helvetica').fontSize(14).fillColor('#333').text('Documentation', { align: 'center' });
  pdf.moveDown(1.5);
  pdf.fontSize(10).fillColor('#666').text(`${contents.length} pages · ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
  pdf.moveDown(0.5);
  pdf.fontSize(9).fillColor('#999').text('Source: github.com/openclaw/openclaw/docs', { align: 'center' });
  pdf.moveDown(0.3);
  pdf.fontSize(9).fillColor('#999').text('Generated by NotebookLM Importer', { align: 'center' });

  // TOC
  pdf.addPage();
  pdf.font('Helvetica-Bold').fontSize(18).fillColor('#111').text('Table of Contents');
  pdf.moveDown(0.8);

  let lastTab = '';
  for (const c of contents) {
    if (c.tab !== lastTab) {
      pdf.moveDown(0.3);
      pdf.font('Helvetica-Bold').fontSize(11).fillColor('#FF5A36').text(c.tab);
      lastTab = c.tab;
    }
    pdf.font('Helvetica').fontSize(9).fillColor('#555').text(`    ${c.group} / ${c.title}`);
  }

  // Content
  for (const c of contents) {
    pdf.addPage();

    // Tab / Group breadcrumb
    pdf.font('Helvetica').fontSize(8).fillColor('#FF5A36').text(`${c.tab} › ${c.group}`);
    pdf.moveDown(0.3);

    // Render markdown
    renderMd(pdf, c.markdown);

    // Source URL
    pdf.moveDown(0.5);
    pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#eee').lineWidth(0.5).stroke();
    pdf.moveDown(0.3);
    pdf.font('Helvetica').fontSize(7).fillColor('#bbb').text(`Source: ${GITHUB_RAW}/${c.slug}.md`);
  }

  // Footer
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pdf.switchToPage(i);
    pdf.font('Helvetica').fontSize(7).fillColor('#bbb')
      .text(`OpenClaw Documentation — Page ${i + 1}`, 50, pdf.page.height - 35, { align: 'center', width: pdf.page.width - 100 });
  }

  pdf.end();
  await new Promise(r => stream.on('finish', r));
  const size = fs.statSync(OUT).size;
  console.log(`   ✅ ${OUT} (${(size / 1024).toFixed(1)} KB)\n`);

  console.log('📊 Contents:');
  for (const c of contents) console.log(`   ${c.tab.padEnd(14)} │ ${c.group.padEnd(16)} │ ${c.title}`);
  console.log(`\n✅ Opening...`);
  execSync(`open "${OUT}"`);
}

main().catch(console.error);
