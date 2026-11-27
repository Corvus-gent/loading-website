// Serve the checked-out Cube and its actual gate/redirects for browser CI.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import config from '../../vercel.json' with {type:'json'};
import {cubeGate} from '../../the6cube-gate.js';
import {channelInvite} from '../../the6cube-invites.js';
const origin = 'http://127.0.0.1:4176';
const root = new URL('../../', import.meta.url);
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.pl':'text/plain','.pdf':'application/pdf'};
const invite = config.redirects.find(rule => rule.source === '/6').destination;
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    const redirect = url.pathname === '/6' ? invite : channelInvite(url);
    if (redirect) { res.writeHead(307, {location:String(redirect)}).end(); return; }
    if (!url.pathname.startsWith('/the6cube/')) { res.writeHead(404).end(); return; }
    const gate = await cubeGate(new Request(url, {headers:req.headers}));
    if (gate) {
      const headers = Object.fromEntries(gate.headers);
      // The fixture is loopback HTTP. Production always sets Secure.
      if (headers['set-cookie']) headers['set-cookie'] = headers['set-cookie'].replace('; Secure', '');
      res.writeHead(gate.status, headers).end(await gate.text()); return;
    }
    const file = new URL('.' + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''), root);
    const data = await readFile(file);
    res.writeHead(200, {'content-type':types[extname(file.pathname)] || 'application/octet-stream'}).end(data);
  } catch { res.writeHead(404).end(); }
}).listen(4176, '127.0.0.1');
