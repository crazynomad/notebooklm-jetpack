#!/usr/bin/env node
/** OpenClaw Docs → PDF v2 (Turndown markdown + proper formatting) */
import PDFDocument from 'pdfkit';
import TurndownService from 'turndown';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { execSync } from 'child_process';

const OUT = '/tmp/openclaw-docs-v2.pdf';
const PAGES = [
  { url: 'https://docs.openclaw.ai/start/getting-started', title: 'Getting Started', section: 'Getting Started' },
  { url: 'https://docs.openclaw.ai/concepts/features', title: 'Features', section: 'Concepts' },
  { url: 'https://docs.openclaw.ai/channels/telegram', title: 'Telegram', section: 'Channels' },
  { url: 'https://docs.openclaw.ai/gateway/configuration', title: 'Configuration', section: 'Gateway' },
  { url: 'https://docs.openclaw.ai/tools/browser', title: 'Browser', section: 'Tools' },
];

function htmlToMd(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const el = doc.querySelector('article') || doc.querySelector('main') || doc.body;
  el.querySelectorAll('script,style,nav,footer,header,.sidebar,.breadcrumb').forEach(e => e.remove());
  const title = doc.querySelector('h1')?.textContent?.trim() || '';

  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  td.addRule('pre', { filter: 'pre', replacement: (_, n) => `\n\`\`\`\n${n.textContent.trim()}\n\`\`\`\n` });
  td.addRule('img', { filter: 'img', replacement: () => '' });
  return { title, markdown: td.turndown(el.innerHTML) };
}

function renderMd(pdf, md) {
  const lines = md.split('\n');
  let inCode = false, codeBuf = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeBuf = []; continue; }
      if (codeBuf.length) {
        const text = codeBuf.join('\n');
        const bh = Math.min(codeBuf.length * 10 + 16, 300);
        if (pdf.y + bh > pdf.page.height - 60) pdf.addPage();
        const y0 = pdf.y;
        pdf.save().rect(52, y0, 490, bh).fill('#f5f5f5').restore();
        pdf.font('Courier').fontSize(7.5).fillColor('#333').text(text, 60, y0 + 8, { width: 474 });
        pdf.y = y0 + bh + 4;
      }
      inCode = false; codeBuf = []; continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (!line.trim()) { pdf.moveDown(0.2); continue; }

    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const sz = { 1: 16, 2: 14, 3: 12, 4: 11, 5: 10, 6: 10 }[hm[1].length] || 10;
      pdf.moveDown(0.4).font('Helvetica-Bold').fontSize(sz).fillColor('#1a1a1a').text(hm[2].replace(/\*\*/g, '')).moveDown(0.2);
      continue;
    }
    if (line.startsWith('> ')) {
      const qy = pdf.y;
      pdf.font('Helvetica').fontSize(8.5).fillColor('#4b5563').text(line.slice(2), 66, qy, { width: 470 });
      pdf.save().rect(54, qy, 2.5, Math.max(pdf.y - qy, 12)).fill('#3b82f6').restore();
      pdf.moveDown(0.1); continue;
    }
    if (line.match(/^[-*]\s/)) {
      pdf.font('Helvetica').fontSize(9).fillColor('#333').text('  •  ' + line.replace(/^[-*]\s/, ''), { width: 486, indent: 8 });
      continue;
    }
    if (line.startsWith('|')) {
      if (line.match(/^\|\s*---/)) continue;
      pdf.font('Helvetica').fontSize(7.5).fillColor('#444').text(line, { width: 490 }); continue;
    }
    if (line.match(/^[-_*]{3,}\s*$/)) {
      pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#ddd').lineWidth(0.5).stroke().moveDown(0.4); continue;
    }
    // Bold inline
    const parts = line.split(/(\*\*[^*]+\*\*)/);
    if (parts.length > 1) {
      for (const p of parts) {
        if (p.startsWith('**') && p.endsWith('**')) {
          pdf.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(p.slice(2, -2), { continued: true });
        } else if (p) {
          pdf.font('Helvetica').fontSize(9).fillColor('#333').text(p, { continued: true });
        }
      }
      pdf.text('', { continued: false }); continue;
    }
    pdf.font('Helvetica').fontSize(9).fillColor('#333').text(line, { width: 490, lineGap: 3 });
  }
}

async function main() {
  console.log('🔬 OpenClaw Docs → PDF v2\n');

  const contents = [];
  for (const p of PAGES) {
    process.stdout.write(`  ${p.title}...`);
    const r = await fetch(p.url, { signal: AbortSignal.timeout(10000) });
    const html = await r.text();
    const { title, markdown } = htmlToMd(html);
    console.log(` ✅ ${markdown.length} chars`);
    contents.push({ ...p, title: title || p.title, markdown });
  }

  console.log('\nGenerating PDF...');
  const pdf = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true });
  const stream = fs.createWriteStream(OUT);
  pdf.pipe(stream);

  // Title
  pdf.font('Helvetica-Bold').fontSize(26).text('OpenClaw Documentation', { align: 'center' });
  pdf.moveDown(1);
  pdf.font('Helvetica').fontSize(11).fillColor('#666').text(`${contents.length} pages · ${new Date().toISOString().split('T')[0]}`, { align: 'center' });

  // TOC
  pdf.addPage();
  pdf.font('Helvetica-Bold').fontSize(18).fillColor('#000').text('Table of Contents');
  pdf.moveDown(0.8);
  for (const c of contents) {
    pdf.font('Helvetica').fontSize(10).fillColor('#555').text(`  · ${c.section} / ${c.title}`);
  }

  // Content
  for (const c of contents) {
    pdf.addPage();
    pdf.font('Helvetica-Bold').fontSize(15).fillColor('#1a1a1a').text(c.title);
    pdf.font('Helvetica').fontSize(7).fillColor('#999').text(c.url);
    pdf.moveDown(0.3);
    pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    pdf.moveDown(0.4);
    renderMd(pdf, c.markdown);
  }

  // Footer
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pdf.switchToPage(i);
    pdf.font('Helvetica').fontSize(7).fillColor('#aaa')
      .text(`OpenClaw Documentation — Page ${i + 1}`, 50, pdf.page.height - 35, { align: 'center', width: pdf.page.width - 100 });
  }

  pdf.end();
  await new Promise(r => stream.on('finish', r));
  const size = fs.statSync(OUT).size;
  console.log(`✅ ${OUT} (${(size / 1024).toFixed(1)} KB)`);
  execSync(`open "${OUT}"`);
}

main().catch(console.error);
