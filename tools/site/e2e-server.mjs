import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function apiFixture(url, method) {
  switch (url.pathname) {
    case '/api/diogenes':
      return method === 'GET'
        ? {configured: false, model: 'gpt-4.1-mini'}
        : {mode: 'fallback', reply: 'What did you build last week?'};
    case '/api/feedback':
      return {items: [], contributors: [], me: {}};
    case '/api/legion':
      return method === 'POST' ? {message: 'Check your email.'} : {members: []};
    case '/api/live':
      return {live: false};
    default:
      return {};
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (['/gamedev', '/gd', '/game'].includes(url.pathname.replace(/\/$/, ''))) {
    res.writeHead(307, {Location: '/game-dev'}); res.end(); return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(apiFixture(url, req.method)));
    return;
  }

  // Production serves these dynamic/profile routes through Vercel rewrites.
  // Feedback-board previews need a deterministic SSR response, not a live DB.
  if (/^\/soldier\/[^/]+\/?$/.test(url.pathname)) {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('<!doctype html><html lang="en"><title>Soldier profile fixture</title><h1>Soldier profile</h1></html>');
    return;
  }
  let file;
  try {
    const entered = req.headers.cookie?.split(';').some(value => value.trim() === 'corvus_realm=1');
    const pathname = url.pathname === '/' && !entered ? '/public/realm-entry.html' : url.pathname;
    const asset = /^\/logo\/[^/]+\.svg$/.test(pathname) ? '/public' + pathname
      : /^\/links\/[^/]+$/.test(pathname) ? '/links/index.html' : pathname;
    file = path.resolve(root, '.' + decodeURIComponent(asset));
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) {
      // Preserve the browser's relative asset base, like production directory URLs.
      if (!url.pathname.endsWith('/')) {
        res.writeHead(308, {Location: url.pathname + '/' + url.search}); res.end(); return;
      }
      file = path.join(file, 'index.html');
    }
    await stat(file);
  } catch {
    res.statusCode = 404;
    file = path.join(root, '404.html');
  }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
});

server.listen(Number(process.env.E2E_PORT || 4184), '127.0.0.1');
