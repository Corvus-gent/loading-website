// Isolated delivery experiments. This module is never imported by production.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {browserProfileHtml} from '../browser-profiles.mjs';

export const MODES = ['js-control','rust-control','01-size-z','02-brotli-11','03-wasm-preload','04-page-wasm','05-js-bundle','06-module-preload','07-inline-directory','08-parallel-api','09-inline-css','10-combined'];
export const PAGES = ['/','/map/','/gabe/','/daily/','/languages/','/privacy/','/cv/tech/'];
export const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1],m[2]]));
const inject = (html, value) => html.replace(/<head(?:\s[^>]*)?>/i, x=>x+value);
const scripts = html => [...html.matchAll(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi)].map(m=>({tag:m[0],...attributes(m[0])})).filter(s=>s.src.startsWith('/'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mustReplace = (source, before, after) => {if(!source.includes(before)) throw Error('Source changed; review experimental overlay: '+before); return source.replace(before,after);};

export function directoryOverlay(source,{inline=false,parallel=false}={}) {
 if(inline) source=mustReplace(source,"fetch('/site-directory.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('directory unavailable');return r.json()})", "(document.getElementById('corvus-public-directory')?Promise.resolve().then(()=>JSON.parse(document.getElementById('corvus-public-directory').textContent)):fetch('/site-directory.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('directory unavailable');return r.json()}))");
 if(parallel) {
  const requests=["fetch('/api/legion?senate=1',{cache:'no-store',signal:AbortSignal.timeout(6000)})","fetch('/api/compound-v2',{cache:'no-cache',signal:AbortSignal.timeout(8000)})","fetch('/api/army?view=legion',{cache:'no-store',signal:AbortSignal.timeout(6000)})"];
  // Start independent requests together, catch rejection immediately, consume in
  // the original order. Preserve the existing conditional fetch and merge rules.
  requests.forEach((request,i)=>{source=mustReplace(source,'await '+request,`await pending[${i}]`);});
  source=mustReplace(source,'const extra=[];',`const pending=[${requests[0]}.catch(()=>null),(force||document.querySelector('[data-full-directory]'))?${requests[1]}.catch(()=>null):Promise.resolve(null),${requests[2]}.catch(()=>null)];const extra=[];`);
 }
 return source;
}

export async function prepareVariants(root, {esbuildPath='/tmp/corvus-perf-tools/node_modules/esbuild/lib/main.js', combined=['bundle','parallel']}={}) {
 const {build}=await import(esbuildPath), pages=new Map(), records=[], prefix='/__experiments';
 const originalDiscovery=await readFile(path.join(root,'js/site/discovery.js'),'utf8');
 const catalogue=JSON.stringify(JSON.parse(await readFile(path.join(root,'site-directory.json'),'utf8'))).replaceAll('<','\\u003c');
 const overlay=(mode,source)=>directoryOverlay(source,{inline:mode==='07-inline-directory'||mode==='10-combined'&&combined.includes('directory'),parallel:mode==='08-parallel-api'||mode==='10-combined'&&combined.includes('parallel')});
 const assetTransform=mode=>(body,url)=>url==='/js/site/discovery.js'?overlay(mode,body.toString()):body;
 const plugin=(mode)=>({name:'same-origin-modules',setup(b){
  b.onResolve({filter:/.*/},args=>{
   if(args.path==='corvus-entry')return{path:args.path,namespace:'entry'};
   if(/^(?:data:|https?:)/.test(args.path))return{path:args.path,external:true};
   const url=new URL(args.path,args.importer&&args.namespace==='corvus'?'https://fixture'+args.importer:'https://fixture/');
   return{path:url.pathname+url.search,namespace:'corvus'};
  });
  b.onLoad({filter:/.*/,namespace:'corvus'},async args=>{
   const url=new URL(args.path,'https://fixture'),file=path.resolve(root,'.'+url.pathname);
   if(!file.startsWith(root+path.sep))throw Error('Module outside fixture');
   let source=await readFile(file,'utf8');
   // Preserve lazy locale downloads at their original public URL. Resolving a
   // dynamic relative import from the generated bundle would use the wrong base;
   // eagerly globbing all locales would change both loading and code size.
   if(url.pathname==='/js/i18n/language.js')source=mustReplace(source,'import(`../locales/${["hi","ta"].includes(code)?"en":code}.js`)','import(new URL(`/js/locales/${["hi","ta"].includes(code)?"en":code}.js`,location.origin).href)');
   if(url.pathname==='/js/privacy-page.js')source=mustReplace(source,'import(`./privacy-locales/${getLang()}.js`)','import(new URL(`/js/privacy-locales/${getLang()}.js`,location.origin).href)');
   return{contents:url.pathname==='/js/site/discovery.js'?overlay(mode,source):source,loader:'js'};
  });
 }});
 async function bundle(html,mode,slug){
  const entries=scripts(html),entry=entries.map(e=>`import ${JSON.stringify(e.src)};`).join('\n');
  const p=plugin(mode);const setup=p.setup;p.setup=b=>{setup(b);b.onLoad({filter:/.*/,namespace:'entry'},()=>({contents:entry,loader:'js'}));};
  const result=await build({entryPoints:['corvus-entry'],plugins:[p],bundle:true,minify:true,format:'esm',target:['es2022'],write:false,metafile:true,legalComments:'none',logLevel:'silent'});
  const bytes=result.outputFiles[0].contents,url=`${prefix}/${mode}/${slug}.js`,file=path.join(root,url);
  await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);
  records.push({mode,route:slug,url,bytes:bytes.length,sha256:hash(bytes),inputs:Object.keys(result.metafile.inputs)});
  let first=true;return html.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi,tag=>{
   if(!entries.some(e=>e.tag===tag))return tag;if(!first)return'';first=false;return`<script type="module" src="${url}"></script>`;
  });
 }
 async function preloadModules(html){
  const seen=new Set(),walk=async url=>{
   if(seen.has(url))return;seen.add(url);
   const s=await readFile(path.join(root,new URL(url,'https://fixture').pathname),'utf8');
   // Parse dependency metadata with esbuild, rather than guessing imports with a regexp.
   const p=plugin('js-control'),result=await build({entryPoints:[url],plugins:[p],bundle:true,format:'esm',write:false,metafile:true,logLevel:'silent'});
   const inputs=result.metafile.inputs;
   const recurse=key=>{for(const i of inputs[key]?.imports||[])if(i.kind==='import-statement'&&!i.external){const u=i.path.replace(/^corvus:/,'');if(!seen.has(u)){seen.add(u);recurse(i.path);}}};
   recurse('corvus:'+url);void s;
  };
  for(const e of scripts(html).filter(e=>e.type==='module'))await walk(e.src);
  return inject(html,[...seen].map(url=>`<link rel="modulepreload" href="${url.replaceAll('&','&amp;')}">`).join(''));
 }
 async function inlineCss(html){
  const replacements=[];
  for(const m of html.matchAll(/<link\b[^>]*>/gi)){
   const a=attributes(m[0]);if(a.rel!=='stylesheet'||!a.href?.startsWith('/'))continue;
   let css=await readFile(path.join(root,new URL(a.href,'https://fixture').pathname),'utf8');
   css=css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/g,(match,q,url)=>/^(?:data:|https?:|\/|#)/.test(url)?match:`url(${JSON.stringify(new URL(url,'https://fixture'+a.href).pathname)})`);
   replacements.push([m[0],`<style data-original-href="${a.href}"${a.media?` media="${a.media}"`:''}>${css.replaceAll('</style','<\\/style')}</style>`]);
  }
  for(const [before,after]of replacements)html=html.replace(before,after);return html;
 }
 for(const route of PAGES){
  const html=await readFile(path.join(root,route,'index.html'),'utf8'),slug=route.replaceAll('/','_')||'home';
  const byMode=new Map();
  for(const mode of MODES){
   let value=html;
   if(mode==='rust-control'||/^0[1-4]-/.test(mode)){
    value=browserProfileHtml(value,route);
    if(mode==='03-wasm-preload')value=inject(value,'<link rel="modulepreload" href="/rust/browser/pkg/core/corvus_browser.js"><link rel="preload" href="/rust/browser/pkg/core/corvus_browser_bg.wasm" as="fetch" type="application/wasm" crossorigin>');
   }else{
    const combo=mode==='10-combined';
    if(mode==='07-inline-directory'||combo&&combined.includes('directory'))value=inject(value,`<script type="application/json" id="corvus-public-directory">${catalogue}</script>`);
    if(mode==='09-inline-css'||combo&&combined.includes('css'))value=await inlineCss(value);
    if(mode==='06-module-preload'||combo&&combined.includes('preload'))value=await preloadModules(value);
    if(mode==='05-js-bundle'||combo&&combined.includes('bundle'))value=await bundle(value,mode,slug);
   }
   byMode.set(mode,value);
  }
  pages.set(route,byMode);
 }
 return{records,combined,options(mode){
  const rust=mode==='rust-control'||/^0[1-4]-/.test(mode);
  return{engine:rust?'rust':'legacy',server:{
   htmlTransform:(html,route)=>pages.get(route)?.get(mode)??(rust?browserProfileHtml(html,route):html),
   compressionQuality:mode==='02-brotli-11'||mode==='10-combined'&&combined.includes('brotli')?11:4,
   assetPath:url=>mode==='01-size-z'?url.replace('/rust/browser/pkg/core/','/rust/browser/pkg/ten/opt-z/'):mode==='04-page-wasm'?url.replace('/rust/browser/pkg/core/','/rust/browser/pkg/ten/page/'):url,
   assetTransform:assetTransform(mode)
  }};
 }};
}
