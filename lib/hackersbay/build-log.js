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
    <a class="brand" href="/hackersbay"><picture class="pixel-art brand-picture"><source type="image/webp" srcset="/public/hackersbay/art/captain-icon.webp"><img src="/public/hackersbay/art/captain-icon.png" width="34" height="34" alt=""></picture><span class="wordmark">The Hackers Bay</span></a>
    <a class="top-link" href="#latest">Latest entry ↓</a>
  </header>
  <main class="wrap inside log-page" id="main">
    <header class="page-heading"><p class="eyebrow">BUILD IN PUBLIC</p><h1>${escape(title.replace(/^# /, ''))}</h1><p>${escape(description.join(' ').trim())}</p></header>
    ${entries}
  </main>
  <footer class="site-footer wrap">
    <div class="boat-credit">
      <a class="boat-credit-badge" href="https://boathackathon.com/" target="_blank" rel="noopener noreferrer">Built aboard Boat Hackathon <span aria-hidden="true">⛵</span></a>
      <nav class="boat-credit-links" aria-label="Boat Hackathon links">
        <a href="https://partiful.com/e/574OkdF3XGK3SzsRR3QK" target="_blank" rel="noopener noreferrer">Demo Day on Partiful</a>
        <a href="https://x.com/BoatHackathon" target="_blank" rel="noopener noreferrer">@BoatHackathon</a>
        <a href="https://www.google.com/maps/search/?api=1&amp;query=Historic+Klamath+Pier+9+San+Francisco" target="_blank" rel="noopener noreferrer">Historic Klamath · Pier 9</a>
      </nav>
      <nav class="boat-credit-sponsors" aria-label="Event sponsors">
        <span>Event sponsors</span>
        <a href="https://boat.dev/" target="_blank" rel="noopener noreferrer">Boat.dev</a>
        <a href="https://www.context.dev/" target="_blank" rel="noopener noreferrer">Context.dev</a>
        <a href="https://nytokenexchange.com/" target="_blank" rel="noopener noreferrer">NYTEX</a>
      </nav>
    </div>
  </footer>
</body>
</html>`);
}
