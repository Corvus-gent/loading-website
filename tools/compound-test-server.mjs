import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/10')throw Error('Only disposable local DB 10');
Object.assign(process.env,{COMPOUND_ADMIN_PASSWORD:'admin-test-only',COMPOUND_STATS_PASSWORD:'stats-test-only',COMPOUND_AUTH_SECRET:'auth-test-only',COMPOUND_STRIPE_MODE:'test',SESSION_SECRET:'compound-local-test'});
const {COMPOUND_LINKS}=await import('../js/compound-links.js');
const {default:handler}=await import('../api/_compound/handler.js');
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.json':'application/json'};
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1:4201');try{
 if(url.pathname==='/api/compound'||Object.hasOwn(COMPOUND_LINKS,url.pathname.replace(/^\/|\/$/g,''))){if(url.pathname!=='/api/compound')url.searchParams.set('slug',url.pathname.replace(/^\/|\/$/g,''));let chunks=[];for await(const c of req)chunks.push(c);let body;try{body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):undefined;}catch{res.writeHead(400).end();return;}
 const adapter={setHeader:(k,v)=>res.setHeader(k,k.toLowerCase()==='set-cookie'?v.replace('; Secure',''):v),status:n=>{res.statusCode=n;return adapter;},json:b=>res.end(JSON.stringify(b)),end:()=>res.end()};res.setHeader('Content-Type','application/json');await handler({method:req.method,headers:req.headers,query:Object.fromEntries(url.searchParams),body},adapter);return;}
 if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{}');return;}
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}let stat=await fs.stat(file);if(stat.isDirectory())file=path.join(file,'index.html');const bytes=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(bytes);
 }catch{res.writeHead(404).end('missing');}}).listen(4201,'127.0.0.1',()=>console.log('Compound local test server ready on 4201'));
