import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { forms } from '../../forms/generated.js';
import { formHandler } from '../../api/_forms/handler.js';
const root = process.cwd();
const records = new Map(), locks = new Set(), delivered = new Set();
export const testing = process.env.FORMS_TEST_MODE === '1';
const store = {
  async get(slug,id){return records.get(slug+':'+id);},
  async save(row){const key=row.slug+':'+row.sessionId,old=records.get(key);if(old&&old.updatedAt>=row.updatedAt)return old;const saved={...old,...row,createdAt:old?.createdAt||row.receivedAt};records.set(key,saved);return saved;},
  async list(slug){return [...records.values()].filter(row=>row.slug===slug);},
  async acquire(key){if(locks.has(key))return false;locks.add(key);return true;},
  async release(key){locks.delete(key);},
  async emailed(row,hash,at){Object.assign(records.get(row.slug+':'+row.sessionId),{lastEmailedHash:hash,lastEmailedAt:at});},
  async delivered(key){return delivered.has(key);},async markDelivered(key){delivered.add(key);}
};
const handler = formHandler({forms,...(testing?{store,send:async({subject})=>console.log('Test mail accepted:',subject),throttle:async()=>true,ipHash:()=> 'test'}:{})});
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost:3000');
    if(url.pathname.startsWith('/api/forms')){
      req.query={...Object.fromEntries(url.searchParams),action:url.pathname.split('/')[3]||url.searchParams.get('action')};
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>100000){res.writeHead(413);return res.end();}chunks.push(chunk);}req.body=Buffer.concat(chunks);
      res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};res.send=value=>{res.end(value);return res;};return await handler(req,res);
    }
    const formRoute=/^\/forms\/[a-z0-9-]+\/?$/.test(url.pathname);
    const relative=formRoute?'forms/index.html':decodeURIComponent(url.pathname).replace(/^\//,'');
    const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    const content=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(3000,'127.0.0.1',()=>console.log('Forms preview: http://localhost:3000/forms/hackers-bay ('+(testing?'test storage + mail':'configured storage + SMTP')+')'));
