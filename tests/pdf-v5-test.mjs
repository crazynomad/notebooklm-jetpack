#!/usr/bin/env node
/** v5 test: raw markdown → marked GFM → HTML → open in browser */
import { marked } from 'marked';
import fs from 'fs';
import { execSync } from 'child_process';

const OUT = '/tmp/openclaw-docs-v5.html';
const GITHUB_RAW = 'https://raw.githubusercontent.com/openclaw/openclaw/main/docs';

function cleanMd(md) {
  md = md.replace(/^---[\s\S]*?---\n*/, '');
  md = md.replace(/<CardGroup[^>]*>[\s\S]*?<\/CardGroup>/g, '');
  md = md.replace(/<Card[^>]*>[\s\S]*?<\/Card>/g, '');
  md = md.replace(/<Steps>\s*/g, ''); md = md.replace(/<\/Steps>\s*/g, '');
  md = md.replace(/<Step\s+title="([^"]*)"[^>]*>/g, '### $1\n');
  md = md.replace(/<\/Step>\s*/g, '');
  for (const t of ['Note','Warning','Tip','Info']) {
    md = md.replace(new RegExp(`<${t}>\\s*`, 'g'), `> **${t}:** `);
    md = md.replace(new RegExp(`<\\/${t}>\\s*`, 'g'), '\n');
  }
  md = md.replace(/<AccordionGroup>\s*/g, ''); md = md.replace(/<\/AccordionGroup>\s*/g, '');
  md = md.replace(/<Accordion\s+title="([^"]*)"[^>]*>/g, '#### $1\n');
  md = md.replace(/<\/Accordion>\s*/g, '');
  md = md.replace(/<Tabs>\s*/g, ''); md = md.replace(/<\/Tabs>\s*/g, '');
  md = md.replace(/<Tab\s+title="([^"]*)"[^>]*>/g, '**$1:**\n');
  md = md.replace(/<\/Tab>\s*/g, '');
  md = md.replace(/<Frame[^>]*>[\s\S]*?<\/Frame>/g, '');
  md = md.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  md = md.replace(/<img[^>]*\/?>/gi, '');
  md = md.replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, '');
  md = md.replace(/<\/?[A-Z][a-zA-Z]*[^>]*>/g, '');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

const CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji"; font-size: 14px; line-height: 1.6; color: #24292f; max-width: 860px; margin: 0 auto; padding: 20px 40px; }
@media print { body { font-size: 11px; padding: 0 15px; } .page-break { page-break-before: always; } @page { margin: 1.5cm; size: A4; } }
h1 { font-size: 2em; border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; margin-top: 1.5em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; margin-top: 1.4em; }
h3 { font-size: 1.25em; margin-top: 1.2em; }
h4 { font-size: 1em; margin-top: 1em; }
code { background: #f6f8fa; border-radius: 6px; padding: .2em .4em; font-size: 85%; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow-x: auto; line-height: 1.45; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #d0d7de; color: #656d76; padding: 0 1em; margin: .5em 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d1d9e0; padding: 6px 13px; }
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
hr { border: none; border-top: 1px solid #d1d9e0; margin: 1.5em 0; }
ul, ol { padding-left: 2em; }
li { margin: .25em 0; }
.cover { text-align: center; padding-top: 180px; }
.cover h1 { border: none; color: #FF5A36; font-size: 2.5em; }
.cover .meta { color: #999; margin-top: 1em; }
.toc { background: #f6f8fa; border-radius: 8px; padding: 20px 28px; margin: 1em 0; }
.toc h2 { border: none; margin-top: 0; }
.toc ul { list-style: none; padding-left: 0; }
.toc li li { padding-left: 1.5em; }
.toc a { color: #0969da; text-decoration: none; }
.section-header { color: #999; font-size: .85em; margin-bottom: .3em; }
.page-source { color: #bbb; font-size: .75em; margin-top: 2em; border-top: 1px solid #eee; padding-top: .5em; }
`;

async function main() {
  console.log('v5: Markdown → HTML (marked GFM)\n');

  // Get pages
  const r = await fetch(`${GITHUB_RAW}/docs.json`);
  const config = await r.json();
  const nav = config.navigation?.languages?.[0]?.tabs || [];
  const allPages = [];
  for (const tab of nav) {
    for (const group of (tab.groups || [])) {
      for (const page of (group.pages || [])) {
        const slug = typeof page === 'string' ? page : page;
        if (slug !== 'index') allPages.push({ slug, group: group.group, tab: tab.tab });
      }
    }
  }

  // Fetch 15 pages
  const pages = allPages.slice(0, 15);
  const contents = [];
  for (const p of pages) {
    process.stdout.write(`  ${p.slug}...`);
    try {
      const r = await fetch(`${GITHUB_RAW}/${p.slug}.md`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) { console.log(' ❌'); continue; }
      const raw = await r.text();
      const md = cleanMd(raw);
      const titleMatch = md.match(/^#\s+(.+)/m);
      console.log(` ✅ ${md.length}c`);
      contents.push({ ...p, title: titleMatch?.[1] || p.slug, markdown: md, url: `${GITHUB_RAW}/${p.slug}.md` });
    } catch { console.log(' ❌'); }
  }

  // Build HTML
  marked.setOptions({ gfm: true, breaks: false });

  const sections = new Map();
  for (const c of contents) { const s = c.group; if (!sections.has(s)) sections.set(s, []); sections.get(s).push(c); }

  let toc = '<div class="toc"><h2>Table of Contents</h2><ul>';
  for (const [sec, ps] of sections) {
    toc += `<li><strong>${sec}</strong><ul>`;
    for (const p of ps) toc += `<li><a href="#p-${ps.indexOf(p)}">${p.title}</a></li>`;
    toc += '</ul></li>';
  }
  toc += '</ul></div>';

  let pagesHtml = '';
  let idx = 0;
  for (const c of contents) {
    const html = marked.parse(c.markdown);
    pagesHtml += `
      <div class="page-break"></div>
      <div class="section-header">${c.tab} › ${c.group}</div>
      <div id="p-${idx}">${html}</div>
      <div class="page-source">${c.url}</div>`;
    idx++;
  }

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenClaw Documentation</title><style>${CSS}</style></head><body>
    <div class="cover"><h1>OpenClaw</h1><p style="font-size:1.3em;color:#666">Documentation</p>
    <div class="meta">${contents.length} pages · ${new Date().toISOString().split('T')[0]}</div>
    <div class="meta" style="margin-top:.5em">Generated by NotebookLM Importer</div></div>
    <div class="page-break"></div>${toc}${pagesHtml}</body></html>`;

  fs.writeFileSync(OUT, fullHtml);
  console.log(`\n✅ ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
  console.log('Opening in browser — use Cmd+P to print as PDF');
  execSync(`open "${OUT}"`);
}

main().catch(console.error);
