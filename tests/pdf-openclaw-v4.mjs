#!/usr/bin/env node
/**
 * OpenClaw Docs → PDF v4
 * Fix: no continued:true, strip emoji, parse markdown links, safe y tracking
 */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { execSync } from 'child_process';

const OUT = '/tmp/openclaw-docs-v4.pdf';
const GITHUB_RAW = 'https://raw.githubusercontent.com/openclaw/openclaw/main/docs';

// ─── Page list from docs.json ──────────────────────────────────
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

// ─── Fetch + clean raw markdown ────────────────────────────────
async function fetchRawMd(slug) {
  const r = await fetch(`${GITHUB_RAW}/${slug}.md`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  let md = await r.text();

  // Strip frontmatter
  md = md.replace(/^---[\s\S]*?---\n*/, '');

  // Strip Mintlify components
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
  md = md.replace(/<Frame[^>]*>[\s\S]*?<\/Frame>/g, '');
  md = md.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  md = md.replace(/<video[^>]*>[\s\S]*?<\/video>/gi, '');
  md = md.replace(/<img[^>]*\/?>/gi, '');
  md = md.replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, '');
  md = md.replace(/<\/?[A-Z][a-zA-Z]*[^>]*>/g, '');

  // Convert markdown links [text](url) → "text (url)"
  md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // Strip emoji (surrogate pairs and common emoji ranges)
  md = md.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
  md = md.replace(/[\u{2600}-\u{27BF}]/gu, '');
  md = md.replace(/[\u{FE00}-\u{FE0F}]/gu, '');
  md = md.replace(/[\u{200D}]/gu, '');
  md = md.replace(/[\u{E0020}-\u{E007F}]/gu, '');

  // Clean excessive blank lines
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

// ─── Safe text rendering (NO continued:true) ───────────────────

function ensureSpace(pdf, needed = 40) {
  if (pdf.y + needed > pdf.page.height - 60) pdf.addPage();
}

function stripInlineMd(text) {
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '$1');
  // Inline code - keep as is
  text = text.replace(/`([^`]+)`/g, '$1');
  return text;
}

function renderMd(pdf, md) {
  const lines = md.split('\n');
  let inCode = false, codeBuf = [], codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence
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
        const lineCount = codeBuf.length;
        const bh = Math.min(lineCount * 10 + 16, 500);
        ensureSpace(pdf, bh + 20);

        if (codeLang) {
          pdf.font('Helvetica').fontSize(7).fillColor('#888').text(codeLang);
          pdf.moveDown(0.1);
        }
        const y0 = pdf.y;
        pdf.save().roundedRect(52, y0, 490, bh, 4).fill('#f5f5f5').restore();
        pdf.font('Courier').fontSize(7.5).fillColor('#333');
        pdf.text(text, 60, y0 + 8, { width: 474 });
        // IMPORTANT: manually set y after code block
        pdf.x = 50;
        pdf.y = y0 + bh + 8;
      }
      inCode = false; codeBuf = []; codeLang = ''; continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Empty line
    if (!line.trim()) { pdf.moveDown(0.2); continue; }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const sz = { 1: 17, 2: 14, 3: 12, 4: 11, 5: 10, 6: 10 }[hm[1].length] || 10;
      ensureSpace(pdf, 30);
      pdf.moveDown(0.4);
      pdf.font('Helvetica-Bold').fontSize(sz).fillColor('#111');
      pdf.text(stripInlineMd(hm[2]), 50, pdf.y, { width: 495 });
      pdf.moveDown(0.2);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      ensureSpace(pdf, 20);
      const qy = pdf.y;
      pdf.font('Helvetica').fontSize(8.5).fillColor('#4b5563');
      pdf.text(stripInlineMd(line.slice(2)), 66, pdf.y, { width: 470 });
      const qh = Math.max(pdf.y - qy, 12);
      pdf.save().rect(54, qy, 2.5, qh).fill('#3b82f6').restore();
      pdf.moveDown(0.15);
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*+]\s/)) {
      ensureSpace(pdf, 16);
      const indent = (line.match(/^(\s*)/)[1].length / 2) | 0;
      const text = line.replace(/^\s*[-*+]\s/, '');
      const bullet = indent > 0 ? '◦' : '•';
      const left = 58 + indent * 12;
      pdf.font('Helvetica').fontSize(9).fillColor('#333');
      pdf.text(`${bullet}  ${stripInlineMd(text)}`, left, pdf.y, { width: 495 - left });
      continue;
    }

    // Ordered list
    const ol = line.match(/^(\d+)\.\s(.+)/);
    if (ol) {
      ensureSpace(pdf, 16);
      pdf.font('Helvetica').fontSize(9).fillColor('#333');
      pdf.text(`${ol[1]}.  ${stripInlineMd(ol[2])}`, 58, pdf.y, { width: 484 });
      continue;
    }

    // HR
    if (line.match(/^[-_*]{3,}\s*$/)) {
      pdf.moveDown(0.3);
      pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#e5e5e5').lineWidth(0.5).stroke();
      pdf.moveDown(0.3);
      continue;
    }

    // Table row (basic)
    if (line.startsWith('|')) {
      if (line.match(/^\|\s*[-:]+/)) continue; // skip separator
      ensureSpace(pdf, 14);
      pdf.font('Helvetica').fontSize(7.5).fillColor('#444');
      pdf.text(line, 50, pdf.y, { width: 495 });
      continue;
    }

    // Regular paragraph
    ensureSpace(pdf, 16);
    pdf.font('Helvetica').fontSize(9).fillColor('#333');
    pdf.text(stripInlineMd(line), 50, pdf.y, { width: 495, lineGap: 2 });
  }
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('OpenClaw Docs → PDF v4 (fixed overlapping)\n');

  const allPages = await getPageList();
  console.log(`docs.json: ${allPages.length} pages\n`);

  const pagesToFetch = allPages.slice(0, 15);
  const contents = [];
  for (const p of pagesToFetch) {
    process.stdout.write(`  ${p.slug}...`);
    const md = await fetchRawMd(p.slug);
    if (md) {
      const titleMatch = md.match(/^#\s+(.+)/m);
      console.log(` ✅ ${md.length}c`);
      contents.push({ ...p, title: titleMatch?.[1] || p.slug.split('/').pop(), markdown: md });
    } else {
      console.log(' ❌');
    }
  }
  console.log(`\n${contents.length} pages fetched\n`);

  // PDF
  const pdf = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true });
  const stream = fs.createWriteStream(OUT);
  pdf.pipe(stream);

  // Title page
  pdf.font('Helvetica-Bold').fontSize(28).fillColor('#FF5A36').text('OpenClaw', { align: 'center' });
  pdf.font('Helvetica').fontSize(14).fillColor('#333').text('Documentation', { align: 'center' });
  pdf.moveDown(1.5);
  pdf.fontSize(10).fillColor('#666').text(`${contents.length} pages | ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
  pdf.moveDown(0.3);
  pdf.fontSize(9).fillColor('#999').text('Generated by NotebookLM Jetpack', { align: 'center' });

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
    pdf.font('Helvetica').fontSize(8).fillColor('#FF5A36').text(`${c.tab} > ${c.group}`, 50, 50, { width: 495 });
    pdf.moveDown(0.3);
    renderMd(pdf, c.markdown);

    // Source
    pdf.moveDown(0.5);
    pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#eee').lineWidth(0.5).stroke();
    pdf.moveDown(0.2);
    pdf.font('Helvetica').fontSize(7).fillColor('#bbb').text(`Source: ${GITHUB_RAW}/${c.slug}.md`, 50, pdf.y, { width: 495 });
  }

  // Footer
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pdf.switchToPage(i);
    pdf.font('Helvetica').fontSize(7).fillColor('#bbb')
      .text(`OpenClaw Docs - Page ${i + 1}`, 50, pdf.page.height - 35, { align: 'center', width: pdf.page.width - 100 });
  }

  pdf.end();
  await new Promise(r => stream.on('finish', r));
  const size = fs.statSync(OUT).size;
  console.log(`PDF: ${OUT} (${(size / 1024).toFixed(1)} KB)`);
  execSync(`open "${OUT}"`);
}

main().catch(console.error);
