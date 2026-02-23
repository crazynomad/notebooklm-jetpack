#!/usr/bin/env node
import PDFDocument from 'pdfkit';
import TurndownService from 'turndown';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { execSync } from 'child_process';

const FONT_R = '/tmp/NotoSansSC-Regular.ttf';
const FONT_B = '/tmp/NotoSansSC-Bold.ttf';
const API = 'https://svc-drcn.developer.huawei.com/community/servlet/consumer/cn/documentPortal';
const OUT = '/tmp/harmonyos-docs-15.pdf';
const MAX_PAGES = 15;

async function getDoc(objectId) {
  try {
    const r = await fetch(`${API}/getDocumentById`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectId, language: 'cn' }),
      signal: AbortSignal.timeout(10000),
    });
    const d = await r.json();
    return { title: d?.value?.title || objectId, html: d?.value?.content?.content || '' };
  } catch { return null; }
}

async function getCatalog() {
  const r = await fetch(`${API}/getCatalogTree`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogName: 'harmonyos-guides-V5', objectId: 'introduction-V5', showHide: '0', language: 'cn' }),
  });
  return r.json();
}

// Take pages spread across sections (3 per section, up to MAX_PAGES total)
function spreadPages(tree, max) {
  const out = [];
  const perSection = 3;
  for (const sec of tree) {
    if (out.length >= max) break;
    const secName = sec.nodeName;
    const leaves = [];
    function walk(nodes) {
      for (const n of nodes) {
        if (leaves.length >= perSection) return;
        if (n.relateDocument) leaves.push({ id: n.relateDocument, title: n.nodeName, section: secName });
        if (n.children?.length) walk(n.children);
      }
    }
    walk(sec.children || (sec.relateDocument ? [sec] : []));
    out.push(...leaves);
  }
  return out.slice(0, max);
}

function htmlToMd(html) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;
  body.querySelectorAll('script,style,img,a[name]').forEach(e => e.remove());
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  td.addRule('pre', { filter: 'pre', replacement: (_, n) => `\n\`\`\`\n${n.textContent.trim()}\n\`\`\`\n` });
  td.addRule('table', {
    filter: n => n.nodeName === 'TABLE',
    replacement: (content, node) => {
      try {
        if (!node?.querySelectorAll) return content || '';
        const rows = [...node.querySelectorAll('tr')];
        if (!rows.length) return content || '';
        const lines = [];
        rows.forEach((row, i) => {
          const cells = [...row.querySelectorAll('th,td')].map(c => (c.textContent||'').trim().replace(/\n+/g,' ').slice(0,50));
          lines.push('| ' + cells.join(' | ') + ' |');
          if (i === 0) lines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        });
        return '\n' + lines.join('\n') + '\n';
      } catch { return content || ''; }
    },
  });
  let md = td.turndown(body.innerHTML);
  md = md.replace(/^(#{1,6})\s*\[h\d\]\s*/gm, '$1 ');
  return md;
}

function renderMd(doc, md) {
  const lines = md.split('\n');
  let inCode = false, codeBuf = [];
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeBuf = []; continue; }
      if (codeBuf.length) {
        const text = codeBuf.join('\n');
        const bh = Math.min(codeBuf.length * 10 + 16, 300);
        if (doc.y + bh > doc.page.height - 60) doc.addPage();
        const y0 = doc.y;
        doc.save().rect(52, y0, 490, bh).fill('#f5f5f5').restore();
        doc.font('Courier').fontSize(7.5).fillColor('#333').text(text, 60, y0 + 8, { width: 474 });
        doc.y = y0 + bh + 4;
      }
      inCode = false; codeBuf = []; continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (!line.trim()) { doc.moveDown(0.2); continue; }
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const sz = { 1:16,2:14,3:12,4:11,5:10,6:10 }[hm[1].length] || 10;
      doc.moveDown(0.4);
      doc.font('ChineseBold').fontSize(sz).fillColor('#1a1a1a').text(hm[2].replace(/\*\*/g,''));
      doc.moveDown(0.2); continue;
    }
    if (line.startsWith('|')) {
      if (line.match(/^\|\s*---/)) continue;
      doc.font('Chinese').fontSize(7.5).fillColor('#444').text(line, { width: 490 }); continue;
    }
    if (line.startsWith('> ')) {
      const qy = doc.y;
      doc.font('Chinese').fontSize(8.5).fillColor('#4b5563').text(line.slice(2), 66, qy, { width: 470 });
      const qh = doc.y - qy;
      doc.save().rect(54, qy, 2.5, Math.max(qh,12)).fill('#3b82f6').restore();
      doc.moveDown(0.1); continue;
    }
    if (line.match(/^[-*]\s/)) {
      doc.font('Chinese').fontSize(9).fillColor('#333').text('  •  ' + line.replace(/^[-*]\s/,''), { width: 486, indent: 8 }); continue;
    }
    const ol = line.match(/^(\d+)\.\s(.+)/);
    if (ol) { doc.font('Chinese').fontSize(9).fillColor('#333').text(`  ${ol[1]}.  ${ol[2]}`, { width: 486, indent: 8 }); continue; }
    if (line.match(/^[-_*]{3,}\s*$/)) {
      doc.moveTo(50,doc.y).lineTo(545,doc.y).strokeColor('#ddd').lineWidth(0.5).stroke();
      doc.moveDown(0.4); continue;
    }
    doc.font('Chinese').fontSize(9).fillColor('#333').text(line, { width: 490, lineGap: 3 });
  }
}

async function main() {
  console.log('🔬 HarmonyOS Docs → PDF (15 pages, cross-section)\n');
  console.log('1️⃣  Fetching catalog...');
  const catalog = await getCatalog();
  const tree = catalog?.value?.catalogTreeList || [];
  const pages = spreadPages(tree, MAX_PAGES);
  console.log(`   Found ${pages.length} pages across ${new Set(pages.map(p=>p.section)).size} sections\n`);

  console.log('2️⃣  Fetching page content...');
  const contents = [];
  for (const p of pages) {
    process.stdout.write(`   ${p.section} > ${p.title}...`);
    const doc = await getDoc(p.id);
    if (doc?.html) {
      const md = htmlToMd(doc.html);
      console.log(` ✅ ${md.length} chars`);
      contents.push({ ...p, title: doc.title || p.title, markdown: md });
    } else { console.log(' ❌'); }
  }
  console.log(`\n   ✅ ${contents.length}/${pages.length} pages\n`);

  console.log('3️⃣  Generating PDF...');
  const pdf = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true });
  const stream = fs.createWriteStream(OUT);
  pdf.pipe(stream);
  pdf.registerFont('Chinese', FONT_R);
  pdf.registerFont('ChineseBold', FONT_B);
  pdf.registerFont('Code', 'Courier');

  // Title
  pdf.font('ChineseBold').fontSize(26).fillColor('#000').text('HarmonyOS 开发指南', { align: 'center' });
  pdf.moveDown(1);
  pdf.font('Chinese').fontSize(11).fillColor('#666').text(`${contents.length} 个页面 · ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
  pdf.moveDown(0.5);
  pdf.fontSize(9).fillColor('#999').text('由 NotebookLM Jetpack 生成', { align: 'center' });

  // TOC
  pdf.addPage();
  pdf.font('ChineseBold').fontSize(18).fillColor('#000').text('目录');
  pdf.moveDown(0.8);
  const sections = new Map();
  for (const c of contents) { const s = c.section||'其他'; if (!sections.has(s)) sections.set(s,[]); sections.get(s).push(c); }
  for (const [sec, ps] of sections) {
    pdf.font('ChineseBold').fontSize(11).fillColor('#333').text(sec);
    for (const p of ps) pdf.font('Chinese').fontSize(9).fillColor('#555').text(`    · ${p.title}`);
    pdf.moveDown(0.3);
  }

  // Content
  for (const c of contents) {
    pdf.addPage();
    pdf.font('ChineseBold').fontSize(15).fillColor('#1a1a1a').text(c.title);
    pdf.font('Chinese').fontSize(7).fillColor('#999').text(`https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/${c.id}`);
    pdf.moveDown(0.5);
    pdf.moveTo(50,pdf.y).lineTo(545,pdf.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    pdf.moveDown(0.5);
    renderMd(pdf, c.markdown);
  }

  // Footer
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pdf.switchToPage(i);
    pdf.font('Chinese').fontSize(7).fillColor('#aaa')
      .text(`HarmonyOS 开发指南 — 第 ${i+1} 页`, 50, pdf.page.height - 35, { align: 'center', width: pdf.page.width - 100 });
  }

  pdf.end();
  await new Promise(r => stream.on('finish', r));
  const size = fs.statSync(OUT).size;
  console.log(`   ✅ PDF: ${OUT} (${(size/1024).toFixed(1)} KB)\n`);
  console.log('📊 Results:');
  for (const c of contents) console.log(`   ${c.section?.slice(0,8).padEnd(8)} │ ${c.title.padEnd(20)} │ ${c.markdown.length} chars`);
  console.log(`\n📦 Size: ${(size/1024).toFixed(1)} KB`);
  console.log('\n✅ Opening...');
  execSync(`open "${OUT}"`);
}
main().catch(console.error);
