import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const escape = (text) => text.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const inline = (line) => escape(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

export async function buildLog(res) {
  const source = await readFile(resolve(process.cwd(), 'HACKERSBAY_LOG.md'), 'utf8');
  const [intro, ...milestones] = source.trim().split(/^## /m);
  const [title, ...description] = intro.trim().split(/\r?\n/);
  const entries = milestones.map((section, index) => {
    const [heading, ...lines] = section.trim().split(/\r?\n/);
    const items = lines.filter(line => line.startsWith('- ')).map(line => '<li>' + inline(line.slice(2)) + '</li>').join('');
    const anchor = index === milestones.length - 1 ? ' id="latest"' : '';
    return `<section class="panel log-entry"${anchor}><h2 class="small-heading">${escape(heading)}</h2><ul>${items}</ul></section>`;
  }).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#06121f"><meta name="referrer" content="no-referrer">
  <link rel="icon" href="/public/hackersbay/art/captain-icon.png" type="image/png" sizes="128x128">
  <link rel="stylesheet" href="/public/hackersbay/assets/bay.css">
  <title>Build log | The Hackers Bay</title>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-bar wrap">
    <a class="brand" href="/hackersbay"><img src="/public/hackersbay/art/captain-icon.webp" width="34" height="34" alt=""><span class="wordmark">The Hackers Bay</span></a>
    <a class="top-link" href="#latest">Latest entry ↓</a>
  </header>
  <main class="wrap inside log-page" id="main">
    <header class="page-heading"><p class="eyebrow">BUILD IN PUBLIC</p><h1>${escape(title.replace(/^# /, ''))}</h1><p>${escape(description.join(' ').trim())}</p></header>
    ${entries}
  </main>
</body>
</html>`);
}
