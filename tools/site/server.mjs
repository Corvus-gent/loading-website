import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/4')throw Error('Use disposable local Redis DB 4 only.');
Object.assign(process.env,{SESSION_SECRET:'site-local-tests-only',ARMY_NAMESPACE:'site:test:army:',LEGION_NAMESPACE:'site:test:legion:',ADMIN_PASSWORD:'site-admin-test',LEGION_TEST_MAIL:'1',LEGION_TEST_ORIGIN:'http://127.0.0.1:4460',LEGION_PAYMENT_LINK_TEST:'https://buy.stripe.com/test_fixture',LEGION_PAYMENT_LINK_ID_TEST:'plink_fixture',LEGION_STRIPE_MODE:'TEST',COMPOUND_V2_PREFIX:'site:test:compound-v2',COMPOUND_KEY_PREFIX:'site:test:compound',COMPOUND_V2_ADMIN_PASSWORD:'site-v2-test',COMPOUND_ADMIN_PASSWORD:'site-v2-test',VERCEL_ENV:'preview'});
const {default:legion}=await import('../../api/_legion/handler.js'),{default:v2}=await import('../../api/_compound-v2/handler.js'),{default:army}=await import('../../api/army.js');
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:4460');try{
 const original=res.setHeader.bind(res);res.setHeader=(name,value)=>original(name,name.toLowerCase()==='set-cookie'?(Array.isArray(value)?value:[value]).map(v=>v.replace('; Secure','')):value);
 const adapter={setHeader:(k,v)=>res.setHeader(k,v),getHeader:k=>res.getHeader(k),status:n=>(res.statusCode=n,adapter),json:d=>(res.setHeader('Content-Type','application/json'),res.end(JSON.stringify(d))),send:d=>res.end(d),end:()=>res.end()};
 const query=Object.fromEntries(u.searchParams);let bytes='';if(req.method==='POST'){for await(const chunk of req){bytes+=chunk;if(bytes.length>20000)throw Error('large');}}
 const headers={...req.headers,'x-forwarded-for':req.headers['x-test-ip']||'198.51.100.20'};
 const go=/^\/go\/(cardneto-[a-z]+)\/?$/.exec(u.pathname);
 if(u.pathname==='/api/legion'||go){if(go)query.partner=go[1];return await legion({method:req.method,query,headers,body:bytes},adapter);}
 if(u.pathname==='/api/army'){if(headers.origin==='http://127.0.0.1:4460')headers.origin='https://corvus.gent';return await army({method:req.method,query,headers,body:bytes?JSON.parse(bytes):{}},adapter);}
 if(u.pathname==='/api/compound-v2'){if(headers.origin==='http://127.0.0.1:4460')headers.origin='https://corvus.gent';return await v2({method:req.method,query,headers,body:bytes},adapter);}
 if(u.pathname==='/__test/payment'&&req.method==='POST'){const {processPayment}=await import('../../api/_legion/payments.js');return adapter.json(await processPayment(JSON.parse(bytes)));}
 if(u.pathname==='/api/live')return adapter.json({live:false,session:'local',source:'manual'});
 if(u.pathname.startsWith('/api/'))return adapter.json({ready:false});
 if(/^\/(enlist|join-the-army-now)(\/|$)/.test(u.pathname)){res.writeHead(301,{Location:'/legion/'+u.search});res.end();return;}
 if(u.pathname.startsWith('/legion/join/'))u.pathname='/legion/join/';
 if(/^\/compound\/v2\/(nl|en|fr|pt|es|de|it)\//.test(u.pathname))u.pathname='/compound/v2/';
 let file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)&&file!==root)throw Error('path');const st=await fs.stat(file);if(st.isDirectory())file=path.join(file,'index.html');const data=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
 }catch(e){res.statusCode=e.code==='ENOENT'?404:500;res.end('local request failed');console.error('local failure:',e.code||e.message);}});
server.listen(4460,'127.0.0.1',()=>console.log('Site preview ready on port 4460; test database and mocked mail.'));
