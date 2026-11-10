// Local integration server: explicit disposable namespace, test mail, no paid AI calls.
import http from 'node:http';
import crypto from 'node:crypto';
const port=Number(process.env.NIGHT_PORT||8794),prefix=process.env.NIGHT_NAMESPACE||'night-browser:'+crypto.randomUUID()+':';
Object.assign(process.env,{REDIS_URL:'redis://127.0.0.1:16380/0',SESSION_SECRET:'local-browser-test-only',LEGION_NAMESPACE:prefix+'legion:',ARMY_NAMESPACE:prefix+'army:',NEST_NAMESPACE:prefix+'nest:',ADMIN_KEY:'local-admin-test-only',LEGION_TEST_ORIGIN:`http://127.0.0.1:${port}`,NEST_TEST_ORIGIN:`http://127.0.0.1:${port}`,LEGION_TEST_MAIL:'1'});
// Never inherit an actual paid key into this test server.
delete process.env.OPENROUTER_API_KEY;
const {createNestHandler}=await import('../api/_nest/handler.js');
const nest=createNestHandler({apiKey:()=>process.env.NIGHT_MOCK_AI==='1'?'local-mock':'',fetcher:async()=>new Response(JSON.stringify({model:'meta/muse-ember',choices:[{finish_reason:'stop',message:{content:'<!doctype html><html><head><style>body{padding:32px;background:#100f0c;color:#ffe39c;font-family:system-ui}</style></head><body><h1>A cozy bakery in Ghent</h1><p>A deterministic browser test fixture, not a real Muse generation.</p></body></html>'}}],usage:{cost:0,total_tokens:0}}),{status:200})});
const {default:legion}=await import('../api/_legion/handler.js');
http.createServer(async(req,res)=>{try{const u=new URL(req.url,`http://127.0.0.1:${port}`);req.query=Object.fromEntries(u.searchParams);if(['/api/legion','/api/nest'].includes(u.pathname)){
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000){res.writeHead(413);return res.end();}}req.body=raw;
 res.status=n=>(res.statusCode=n,res);res.json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));};res.send=d=>res.end(d);return await (u.pathname==='/api/nest'?nest:legion)(req,res);
 }
 let path=u.pathname;if(/^\/nest\/[a-f0-9]{32}\/?$/.test(path))path='/nest/view/';if(/^\/legion\/join\/[^/]+\/?$/.test(path))path='/legion/join/';
 const r=await fetch('http://127.0.0.1:8793'+path+u.search,{redirect:'manual'});res.statusCode=r.status;for(const [k,v] of r.headers)if(!['content-encoding','content-length','transfer-encoding'].includes(k))res.setHeader(k,v);res.end(Buffer.from(await r.arrayBuffer()));
}catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Local test service unavailable.'}));}}).listen(port,'127.0.0.1',()=>console.log('Local integration server ready on '+port+'; no external AI, mail or payments.'));
