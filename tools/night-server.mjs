// Local integration server: explicit disposable namespace, test mail, no paid AI calls.
import http from 'node:http';
import crypto from 'node:crypto';
const port=Number(process.env.NIGHT_PORT||8794),prefix=process.env.NIGHT_NAMESPACE||'night-browser:'+crypto.randomUUID()+':';
Object.assign(process.env,{REDIS_URL:'redis://127.0.0.1:16380/0',SESSION_SECRET:'local-browser-test-only',LEGION_NAMESPACE:prefix+'legion:',ARMY_NAMESPACE:prefix+'army:',NEST_NAMESPACE:prefix+'nest:',ADMIN_KEY:'local-admin-test-only',LEGION_TEST_ORIGIN:`http://127.0.0.1:${port}`,NEST_TEST_ORIGIN:`http://127.0.0.1:${port}`,LEGION_TEST_MAIL:'1'});
// Never inherit an actual paid key into this test server.
delete process.env.OPENROUTER_API_KEY;
const {default:legion}=await import('../api/_legion/handler.js');
http.createServer(async(req,res)=>{try{const u=new URL(req.url,`http://127.0.0.1:${port}`);req.query=Object.fromEntries(u.searchParams);if(u.pathname==='/api/legion'){
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000){res.writeHead(413);return res.end();}}req.body=raw;
 res.status=n=>(res.statusCode=n,res);res.json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));};return await legion(req,res);
 }
 let path=u.pathname;if(/^\/legion\/join\/[^/]+\/?$/.test(path))path='/legion/join/';
 const r=await fetch('http://127.0.0.1:8793'+path+u.search,{redirect:'manual'});res.statusCode=r.status;for(const [k,v] of r.headers)if(!['content-encoding','content-length','transfer-encoding'].includes(k))res.setHeader(k,v);res.end(Buffer.from(await r.arrayBuffer()));
}catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Local test service unavailable.'}));}}).listen(port,'127.0.0.1',()=>console.log('Local integration server ready on '+port+'; no external AI, mail or payments.'));
