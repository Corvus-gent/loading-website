// Isolated delivery experiments. This module is never imported by production.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync,constants as z} from 'node:zlib';
import {browserProfileHtml} from '../browser-profiles.mjs';
import {localeHintSource} from './locale-hints.mjs';

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

export async function prepareVariants(root, {esbuildPath='/tmp/corvus-perf-tools/node_modules/esbuild/lib/main.js', combined=['bundle','parallel'],pageWasm='page',rustBest=false}={}) {
 if(!['page','shell','shell-fixed','shell-small','shell-parallel'].includes(pageWasm))throw Error('Unknown page WASM experiment');
 const {build}=await import(esbuildPath), pages=new Map(), records=[], prefix='/__experiments';
 const originalDiscovery=await readFile(path.join(root,'js/site/discovery.js'),'utf8');
 const catalogue=JSON.stringify(JSON.parse(await readFile(path.join(root,'site-directory.json'),'utf8'))).replaceAll('<','\\u003c');
 if(combined.includes('footer-logo')||rustBest){
  // A generated delivery derivative, never a redrawn logo. Original retained;
  // 84 px covers the existing 28 CSS px footer mark at 3x pixel density.
  const {default:sharp}=await import('sharp');
  const bytes=await sharp(path.join(root,'logo.png')).resize(84,84,{fit:'fill'}).png({compressionLevel:9}).toBuffer();
  await mkdir(path.join(root,prefix),{recursive:true});await writeFile(path.join(root,prefix,'footer-logo.png'),bytes);
  records.push({mode:'10-combined',kind:'footer-logo',url:prefix+'/footer-logo.png',bytes:bytes.length,sha256:hash(bytes),source:'logo.png',displayWidth:28,displayHeight:28,pixelDensity:3});
 }
 const footerLogo=html=>html.replace(/<img\b[^>]*>/gi,tag=>{const a=attributes(tag);return a.src==='/logo.png'&&a.width==='28'&&a.height==='28'?tag.replace('/logo.png',prefix+'/footer-logo.png'):tag;}).replace(/<link\b[^>]*>/gi,tag=>{const a=attributes(tag);return a.rel==='icon'&&a.href==='/logo.png'?tag.replace('/logo.png',prefix+'/footer-logo.png'):tag;});
 // The existing bar is 36px at the tested widths. Reserve that same space in
 // HTML; the unchanged language renderer fills this node with the chosen locale.
 // This neither hides the heading nor marks controls ready before they work.
 const languageSlot=html=>/<(?:nav|div)\b[^>]*\bid=["']lang-switcher["']/i.test(html)?html:html.replace(/<body\b[^>]*>/i,tag=>tag+'<nav id="lang-switcher" class="lang-switcher" data-site-languages style="min-height:36px" aria-label="Language"></nav>');
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
   if(mode==='10-combined'&&combined.includes('locale')&&url.pathname==='/js/i18n/language.js'){
    source="import __experimentEnglish from '/js/locales/en.js';\n"+mustReplace(source,'const load = code => import(new URL(`/js/locales/${["hi","ta"].includes(code)?"en":code}.js`,location.origin).href).then(module => module.default);','const load = code => ["en","hi","ta"].includes(code)?Promise.resolve(__experimentEnglish):import(new URL(`/js/locales/${code}.js`,location.origin).href).then(module=>module.default);');
   }
   if(url.pathname==='/js/privacy-page.js')source=mustReplace(source,'import(`./privacy-locales/${getLang()}.js`)','import(new URL(`/js/privacy-locales/${getLang()}.js`,location.origin).href)');
   if(mode==='10-combined'&&url.pathname==='/js/privacy-page.js'){
    source="import __privacyEnglish from '/js/privacy-locales/en.js';\n"+mustReplace(source,'copy=(await import(new URL(`/js/privacy-locales/${getLang()}.js`,location.origin).href)).default','copy=await import(new URL(`/js/privacy-locales/${getLang()}.js`,location.origin).href).then(module=>module.default).catch(()=>__privacyEnglish)');
   }
   if(mode==='10-combined'&&combined.includes('css-flat')&&url.pathname==='/js/inspiration.js')source=mustReplace(source,'document.head.append(css);',"if(!document.querySelector('style[data-experiment-inspiration]'))document.head.append(css);");
   return{contents:url.pathname==='/js/site/discovery.js'?overlay(mode,source):source,loader:'js'};
  });
 }});
 async function bundle(html,mode,slug){
  const entries=scripts(html),entry=entries.map(e=>`import ${JSON.stringify(e.src)};`).join('\n');
  const p=plugin(mode);const setup=p.setup;p.setup=b=>{setup(b);b.onLoad({filter:/.*/,namespace:'entry'},()=>({contents:entry,loader:'js'}));};
  const result=await build({entryPoints:['corvus-entry'],plugins:[p],bundle:true,minify:true,format:'esm',target:['es2022'],write:false,metafile:true,legalComments:'none',logLevel:'silent'});
  const bytes=result.outputFiles[0].contents,url=`${prefix}/${mode}/${slug}-${hash(bytes).slice(0,12)}.js`,file=path.join(root,url);
  await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);
  records.push({mode,route:slug,url,bytes:bytes.length,brotli:brotliCompressSync(bytes,{params:{[z.BROTLI_PARAM_QUALITY]:mode==='10-combined'&&combined.includes('brotli')?11:4}}).length,gzip:gzipSync(bytes).length,sha256:hash(bytes),inputs:Object.keys(result.metafile.inputs)});
  let first=true;return html.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi,tag=>{
   if(!entries.some(e=>e.tag===tag))return tag;if(!first)return'';first=false;return`<script type="module" src="${url}"></script>`;
  });
 }
 let earlyLocale = '';
 if (combined.includes('locale-hints')) {
  const source = await localeHintSource(root);
  const p = plugin('js-control'), setup = p.setup;
  p.setup = b => {setup(b); b.onLoad({filter:/.*/,namespace:'entry'}, () => ({contents:source,loader:'js'}));};
  const result = await build({entryPoints:['corvus-entry'],plugins:[p],bundle:true,minify:true,format:'iife',target:['es2022'],write:false,legalComments:'none',logLevel:'silent'});
  const bytes = result.outputFiles[0].contents;
  earlyLocale = Buffer.from(bytes).toString().replaceAll('</script', '<\\/script');
  records.push({mode:'10-combined',kind:'locale-hints',bytes:bytes.length,sha256:hash(bytes)});
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
 async function inlineCss(html,flatten=false){
  async function sheet(href,parents=new Set()){
   const base=new URL(href,'https://fixture'),key=base.pathname;
   if(parents.has(key))throw Error('Circular CSS import: '+key);
   const seen=new Set([...parents,key]);
   let css=await readFile(path.join(root,key),'utf8');
   if(flatten)for(const m of [...css.matchAll(/@import\s+(?:url\(\s*(["']?)([^)"']+)\1\s*\)|(["'])([^"']+)\3)\s*;/gi)]){
    const target=new URL(m[2]||m[4],base);
    if(target.origin==='https://fixture')css=css.replace(m[0],await sheet(target.href,seen));
   }
   return css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/g,(match,q,url)=>{
    if(/^(?:data:|https?:|\/|#)/.test(url))return match;
    const resolved=new URL(url,base);return `url(${JSON.stringify(resolved.pathname+resolved.search+resolved.hash)})`;
   });
  }
  const replacements=[];
  for(const m of html.matchAll(/<link\b[^>]*>/gi)){
   const a=attributes(m[0]);if(a.rel!=='stylesheet'||!a.href?.startsWith('/'))continue;
   const css=await sheet(a.href);
   replacements.push([m[0],`<style data-original-href="${a.href}"${a.media?` media="${a.media}"`:''}>${css.replaceAll('</style','<\\/style')}</style>`]);
  }
  for(const [before,after]of replacements)html=html.replace(before,after);
  if(flatten)html=html.replace('</head>',`<style data-experiment-inspiration>${(await sheet('/css/inspiration.css')).replaceAll('</style','<\\/style')}</style></head>`);
  return html;
 }
 for(const route of PAGES){
  const html=await readFile(path.join(root,route,'index.html'),'utf8'),slug=route.replaceAll('/','_')||'home';
  const byMode=new Map();
  for(const mode of MODES){
   let value=html;
   if(mode==='rust-control'||/^0[1-4]-/.test(mode)){
    value=browserProfileHtml(value,route);
    if(mode==='04-page-wasm'&&pageWasm.startsWith('shell')&&['/','/map/'].includes(route))value=value.replace('/rust/browser/pkg/core/corvus_browser.js',`/rust/browser/pkg/ten/${pageWasm}/corvus_browser.js`);
    if(mode==='04-page-wasm'&&rustBest){const profile=pageWasm.startsWith('shell')&&['/','/map/'].includes(route)?'ten/'+pageWasm:'core';value=footerLogo(inject(value,`<link rel="modulepreload" href="/rust/browser/pkg/${profile}/corvus_browser.js"><link rel="preload" href="/rust/browser/pkg/${profile}/corvus_browser_bg.wasm" as="fetch" type="application/wasm" crossorigin>`));}
    if(mode==='03-wasm-preload')value=inject(value,'<link rel="modulepreload" href="/rust/browser/pkg/core/corvus_browser.js"><link rel="preload" href="/rust/browser/pkg/core/corvus_browser_bg.wasm" as="fetch" type="application/wasm" crossorigin>');
   }else{
    const combo=mode==='10-combined';
    if(combo&&combined.includes('footer-logo'))value=footerLogo(value);
    if(combo&&combined.includes('stable-language'))value=languageSlot(value);
    if(mode==='07-inline-directory'||combo&&combined.includes('directory'))value=inject(value,`<script type="application/json" id="corvus-public-directory">${catalogue}</script>`);
    if(mode==='09-inline-css'||combo&&(combined.includes('css')||combined.includes('css-flat')))value=await inlineCss(value,combo&&combined.includes('css-flat'));
    if(mode==='06-module-preload'||combo&&combined.includes('preload'))value=await preloadModules(value);
    if(mode==='05-js-bundle'||combo&&combined.includes('bundle'))value=await bundle(value,mode,slug);
    if(combo&&earlyLocale)value=inject(value,`<script data-experiment-locale-hints>${earlyLocale}</script>`);
   }
   byMode.set(mode,value);
  }
  pages.set(route,byMode);
 }
 if(combined.includes('predict')){
  const policy={routes:{},maxRoutes:2,maxBytes:120000,settleMs:500,visibleMs:800};
  for(const route of ['/gabe/','/daily/','/languages/','/privacy/']){
   const bundle=records.find(r=>r.mode==='10-combined'&&r.route===route.replaceAll('/','_'));
   if(bundle)policy.routes[route]=[{url:bundle.url,bytes:Math.max(bundle.brotli,bundle.gzip),encodings:{br:bundle.brotli,gzip:bundle.gzip}}];
  }
  await mkdir(path.join(root,prefix),{recursive:true});
  await writeFile(path.join(root,prefix,'predict.js'),await readFile('tools/rust/ten-experiments/predict.mjs'));
  const home=pages.get('/');home.set('10-combined',home.get('10-combined').replace('</body>',`<script type="application/json" id="corvus-experiment-prediction">${JSON.stringify(policy)}</script><script type="module" src="${prefix}/predict.js"></script></body>`));
 }
 return{records,combined,pageWasm,rustBest,options(mode){
  const rust=mode==='rust-control'||/^0[1-4]-/.test(mode);
  return{engine:rust?'rust':'legacy',server:{
   htmlTransform:(html,route)=>pages.get(route.replace(/\/index\.html$/,'/').replace(/\/+$/,'')+'/')?.get(mode)??(rust?browserProfileHtml(html,route):html),
   compressionQuality:mode==='02-brotli-11'||mode==='04-page-wasm'&&rustBest||mode==='10-combined'&&combined.includes('brotli')?11:4,
   assetPath:url=>mode==='01-size-z'?url.replace('/rust/browser/pkg/core/','/rust/browser/pkg/ten/opt-z/'):mode==='04-page-wasm'&&pageWasm==='page'?url.replace('/rust/browser/pkg/core/','/rust/browser/pkg/ten/page/'):url,
   assetTransform:assetTransform(mode)
  }};
 }};
}
