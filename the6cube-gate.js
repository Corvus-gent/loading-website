import { relativeRedirect } from './js/relative-redirect.js';
// The Cube · code gate. Add to the root middleware.js of the corvus.gent repo (call cubeGate first).
// The code itself is never stored: only sha256("thecube:" + code). Change the code = change GATE_HASH.
const GATE_HASH = '253d5b0aed5dbee7abe940f0fdb31bf18fd2a2568e7a72c99d9b6518c182bc5e';
const COOKIE = 'the6cube_key';
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const page = (wrong) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>The 6 Cube · Corvus</title><meta property="og:title" content="The 6 Cube · Corvus"><meta property="og:description" content="join the new realm. know thyself, then ask the cube."><meta property="og:image" content="https://corvus.gent/the6cube/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#060509">
<style>html{background:#060509;color:#efe7d2;font:15px system-ui,sans-serif;height:100%}body{margin:0;min-height:100%;display:grid;place-items:center;text-align:center}
p.d{font:12px Georgia,serif;letter-spacing:.6em;color:rgba(255,215,106,.6);margin:0 0 26px}h1{font:italic 400 clamp(26px,4vw,40px) Georgia,serif;margin:0 0 26px}
form{display:flex;gap:8px;justify-content:center}input{background:#120d1d;border:1px solid #2c1f45;border-radius:999px;color:#efe7d2;padding:12px 18px;font:15px ui-monospace,monospace;min-width:220px;outline:none}input:focus{border-color:#ffd76a}
button{background:#ffd76a;color:#1a1206;border:0;border-radius:999px;padding:12px 20px;font-weight:600;cursor:pointer}.w{color:#ff8c8c;font:12px ui-monospace,monospace;margin-top:14px;min-height:1em}</style>
<p class="d">ΓΝΩΘΙ ΣΑΥΤΟΝ</p><h1>Speak the word.</h1><form method="get"><input name="key" type="password" autocomplete="current-password" aria-label="code" autofocus><button>Enter</button></form><p class="w">${wrong ? 'not this word.' : ''}</p></html>`;
export async function cubeGate(request) {
  const url = new URL(request.url);
  if (!/^\/the6cube(\/|$)/.test(url.pathname)) return;                       // only The 6 Cube is gated
  if (url.pathname === '/the6cube/assets/og.png') return;                    // link previews (WhatsApp, LinkedIn) may see the card
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (cookie === GATE_HASH) return;                                          // already let in
  const key = url.searchParams.get('key');
  if (key !== null) {
    if (await sha('thecube:' + key) === GATE_HASH) {
      url.searchParams.delete('key');
      return relativeRedirect(url.pathname + url.search + url.hash, 302, { 'Set-Cookie': `${COOKIE}=${GATE_HASH}; Path=/the6cube; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`, 'Cache-Control': 'no-store' });
    }
    return new Response(page(true), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return new Response(page(false), { status: 200,  // 200 so WhatsApp/LinkedIn crawlers read the preview card
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
