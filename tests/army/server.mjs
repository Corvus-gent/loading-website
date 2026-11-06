// Local-only integration harness: real army handlers + Redis, fake mail/payment providers.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
import {armyStore} from '../../api/_army/_store.js';import {armyService} from '../../api/_army/_service.js';import {createArmyHandler} from '../../api/army.js';import {createBMCHandler} from '../../api/bmc-webhook.js';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/6')throw Error('local test Redis required');
const root=process.cwd(),store=armyStore({prefix:'army:browser:'}),messages=[],background=[];
const service=armyService({store,bits:8,mailOptions:{apiKey:()=> 'test-key',request:async(url,init)=>{if(url.endsWith('/usage'))return new Response(JSON.stringify({emails:{daily:{used:0,limit:100},monthly:{used:0,limit:3000}}}));const batch=JSON.parse(init.body);messages.push(...batch);return new Response(JSON.stringify({data:batch.map((_,i)=>({id:'test-'+i}))}));}}});
const handler=createArmyHandler({service,ready:()=>true,ownerSession:async req=>req.headers['x-test-admin']==='yes'?{email:'gabriel@corvus.gent'}:null});
const webhook=createBMCHandler({store,secret:()=> 'test-bmc-secret',background:p=>background.push(p)});
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);req.query=Object.fromEntries(url.searchParams);res.status=n=>(res.statusCode=n,res);res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};res.send=data=>res.end(data);
 if(req.headers.origin===`http://localhost:${process.env.PORT||4188}`||req.headers.origin===`http://127.0.0.1:${process.env.PORT||4188}`)req.headers.origin='https://corvus.gent';
 req.headers['x-forwarded-for']=req.headers['x-test-ip']||'198.51.100.10';
 if(pathname==='/__mail'){res.json(messages);return;}
 if(pathname==='/__fixture'&&req.method==='POST'){const u=await store.create();const body={email:'fixture@example.test',username:'fixture',why:'test',link:'https://example.com',country:'BE'};await store.enlist(u.id,body);await store.verify(u.id);res.json({code:u.code});return;}
 if(pathname==='/api/bmc-webhook')return webhook(req,res);
 if(pathname==='/api/army'||pathname.startsWith('/r/')||pathname.startsWith('/soldier/')){
  if(pathname.startsWith('/r/')){req.query.ref=pathname.split('/')[2];if(pathname.split('/')[3]==='games')req.query.to='games';}
  if(pathname.startsWith('/soldier/')){req.query.profile=pathname.split('/')[2];if(/\.png$/.test(pathname)){req.query.image='1';if(pathname.endsWith('poster.png'))req.query.poster='1';}else req.query.html='1';}
  if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('size');}req.body=JSON.parse(raw||'{}');}
  return handler(req,res);
 }
 if(pathname.startsWith('/api/')||pathname.startsWith('/.')){res.statusCode=404;res.end();return;}
 let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root)throw Error('path');
 if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');const data=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);
}catch(error){res.statusCode=500;res.end('local fixture error');console.error(error.message);}});
server.listen(Number(process.env.PORT)||4188,'127.0.0.1',()=>console.log('Army integration server ready; mocked mail only.'));
