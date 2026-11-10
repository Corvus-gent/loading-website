// Development-only preview; isolated Redis keys, never the production namespace.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createDontpayHandler} from '../api/_dontpay.js';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/0')throw Error('Use the local Redis test service only.');
const offline=process.argv.includes('--offline'),handler=createDontpayHandler({ready:()=>!offline,namespace:'dontpay:browser-test:',hash:()=> 'browser-test'});
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1:8792');
  if(u.pathname==='/api/dontpay'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8192){res.writeHead(413);return res.end('{}');}}
   const adapter={setHeader:(k,v)=>res.setHeader(k,v),status:n=>(res.statusCode=n,adapter),json:d=>res.end(JSON.stringify(d))};
   return handler({method:req.method,headers:req.headers,query:Object.fromEntries(u.searchParams),body},adapter);
  }
  if(u.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});return res.end('{"error":"Local preview does not provide this API."}');}
  let pathname=u.pathname;if(pathname.startsWith('/arena/'))pathname='/public'+pathname;
  let file=path.resolve(root,'.'+decodeURIComponent(pathname));if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside root');
  if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404,{'Content-Type':'text/html'});res.end(await fs.readFile(path.join(root,'404.html')));}
}).listen(8792,'127.0.0.1',()=>console.log('Local I DON’T PAY preview: http://127.0.0.1:8792/dontpay/ ('+(offline?'offline fallback':'Redis test namespace')+')'));
