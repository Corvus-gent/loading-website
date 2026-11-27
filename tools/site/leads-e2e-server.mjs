// Production-shaped leadhunter fixture for browser flow tests.
// - HTTPS on localhost: WebKit drops Secure cookies on plain HTTP.
// - Routes come from vercel.json rewrites, the same table production uses.
// - Request headers are passed through untouched: no forged Origin.
// - Bodies are parsed the way Vercel's Node runtime does (form and JSON -> object).
// - A real redis-server, reached through api/_redis.js like production.
// POST /__fixture/redis {"up":false|true} stops/starts Redis to test outages.
import https from 'node:https';
import net from 'node:net';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';

const PORT=Number(process.env.LEADS_E2E_PORT||8453);
const dir=mkdtempSync(path.join(tmpdir(),'corvus-leads-e2e-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(dir,'key.pem'),'-out',path.join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});

const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const redisPort=await freePort();
let redisProc=null;
async function redisUp(){
  if(redisProc)return;
  redisProc=spawn('redis-server',['--port',String(redisPort),'--bind','127.0.0.1','--save','','--appendonly','no'],{stdio:'ignore'});
  for(let i=0;i<50;i++){try{await new Promise((ok,bad)=>{const s=net.connect(redisPort,'127.0.0.1',()=>{s.end();ok();});s.on('error',bad);});return;}catch{await new Promise(r=>setTimeout(r,100));}}
  throw Error('redis-server did not start');
}
async function redisDown(){if(!redisProc)return;const p=redisProc;redisProc=null;await new Promise(r=>{p.once('exit',r);p.kill('SIGKILL');});}
await redisUp();

// Production config, minus anything that would leave this machine.
for(const k of Object.keys(process.env))if(/REDIS|_REST_API_|KV_URL/.test(k))delete process.env[k];
Object.assign(process.env,{REDIS_URL:`redis://127.0.0.1:${redisPort}`,LEADS_PASSWORD:'local-e2e-password-123456',LEADS_INGEST_TOKEN:'local-e2e-ingest-token'});
delete process.env.CAL_LINK;delete process.env.REVOLUT_LINK;
const {default:handler}=await import('../../api/_leads/handler.js');

// vercel.json rewrite sources -> regexes, limited to the leadhunter destinations.
const rewrites=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8')).rewrites
  .filter(r=>r.destination.includes('leadhunter=1'))
  .map(r=>{const names=[];const re=new RegExp('^'+r.source.replace(/[.]/g,'\\.').replace(/:(\w+)(\*)?/g,(_,n,star)=>{names.push(n);return star?'(.*)':'([^/]+)';})+'$');return {re,names,destination:r.destination};});
function route(pathname){
  for(const r of rewrites){const m=pathname.match(r.re);if(!m)continue;let dest=r.destination;r.names.forEach((n,i)=>{dest=dest.replace(':'+n,encodeURIComponent(m[i+1]));});return Object.fromEntries(new URL(dest,'https://x').searchParams);}
  return null;
}
function parseBody(raw,type=''){
  if(!raw)return undefined;
  if(type.includes('application/json')){try{return JSON.parse(raw);}catch{return raw;}}
  if(type.includes('application/x-www-form-urlencoded'))return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

const server=https.createServer({key:readFileSync(path.join(dir,'key.pem')),cert:readFileSync(path.join(dir,'cert.pem'))},async(req,res)=>{
  const url=new URL(req.url,`https://${req.headers.host}`);let raw='';for await(const c of req)raw+=c;
  if(url.pathname==='/__fixture/redis'&&req.method==='POST'){const {up}=JSON.parse(raw);await(up?redisUp():redisDown());res.writeHead(204);return res.end();}
  if(url.pathname==='/__fixture/ok'){res.writeHead(200);return res.end('ok');}
  const query=route(url.pathname);
  if(!query){res.writeHead(404);return res.end('not found');}
  const adapter={statusCode:200,setHeader:(k,v)=>res.setHeader(k,v),status:n=>(res.statusCode=n,adapter),json:b=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(b));},send:b=>res.end(b),end:b=>res.end(b)};
  try{await handler({method:req.method,url:req.url,headers:req.headers,query:{...Object.fromEntries(url.searchParams),...query},body:parseBody(raw,req.headers['content-type'])},adapter);}
  catch(e){console.error(e);if(!res.headersSent)res.writeHead(500);res.end('fixture error');}
});
server.listen(PORT);
async function stop(){server.close();await redisDown();rmSync(dir,{recursive:true,force:true});process.exit();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
