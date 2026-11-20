// Route every browser request to local files or the isolated Rust runtime.
// Production URLs are only an origin fixture for Secure cookies and CSRF checks.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {wasmBridge} from './rust-bridges.mjs';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4'};
export async function rustSite(context,runtime,{ip='198.51.100.190',beforeRequest,afterResponse,browserEngine='rust'}={}){
 const origin='https://corvus.gent',root=process.cwd(),errors=[],pending=new Set();let closing=false;
 await context.addInitScript(()=>sessionStorage.setItem('twitch-disabled','1'));
 const handle=async route=>{
  if(closing)return route.abort();
  const request=route.request(),u=new URL(request.url());
  if(u.origin!==origin)return route.abort();
  if(beforeRequest&&await beforeRequest({route,request,u}))return;
  const bridge=browserEngine==='rust'?wasmBridge(u.pathname):null;if(bridge)return route.fulfill({contentType:'text/javascript',body:bridge});
  if(u.pathname.startsWith('/api/')){
   const module={'/api/army':'army','/api/legion':'legion','/api/compound':'compound','/api/support':'support','/api/battle':'battle','/api/compound-v2':'compound-v2'}[u.pathname];
   // Pure rendering fixtures have no API runtime; the shared discovery shell sees an empty Army.
   if(module==='army'&&!runtime?.url)return route.fulfill({contentType:'application/json',body:JSON.stringify({self:null,members:[],ready:false})});
   if(!module)return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname==='/api/live'?{live:false,session:'fixture',source:'manual'}:{ready:false})});
   const target=new URL(runtime.url);target.search=u.search;target.searchParams.set('module',module);
   const headers=await request.allHeaders();delete headers.host;delete headers['content-length'];headers['x-forwarded-for']=ip;
   const response=await fetch(target,{method:request.method(),headers,body:request.postDataBuffer()||undefined,redirect:'manual'});
   const body=Buffer.from(await response.arrayBuffer());
   if(response.status>=500)errors.push({path:u.pathname,status:response.status});
   if(afterResponse&&await afterResponse({route,request,u,response,body}))return;
   const responseHeaders=Object.fromEntries(response.headers);const cookies=response.headers.getSetCookie();if(cookies.length)responseHeaders['set-cookie']=cookies.join('\n');
   return route.fulfill({status:response.status,headers:responseHeaders,body});
  }
  try{let file=u.pathname;const senate=/^\/legion\/(join|edit|senate)\/[A-Za-z0-9_-]+\/?$/.exec(file);if(senate)file='/legion/'+senate[1]+'/index.html';if(/^\/soldier\/[^/]+\/?$/.test(file))file='/soldier/index.html';if(!path.extname(file))file=file.replace(/\/$/,'')+'/index.html';file=path.resolve(root,'.'+decodeURIComponent(file));if(!file.startsWith(root+path.sep))throw Error('outside fixture');return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:'Not found'});}
 };
 await context.route('**/*',route=>{const task=handle(route);pending.add(task);task.then(()=>pending.delete(task),()=>pending.delete(task));return task;});
 // Stop new work before closing without ever removing the network-deny route.
 const drain=async()=>{closing=true;await Promise.all([...pending]);};
 return{origin,errors,drain};
}
