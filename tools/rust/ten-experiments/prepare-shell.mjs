// Second version of experiment 4: remove unrelated routes before Rust compilation,
// rather than trying to prune their callbacks after the complete module is linked.
// Edits are applied ONLY in a temporary source copy. Production sources unchanged.
import {mkdtemp,cp,copyFile,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {brotliCompressSync,constants as z} from 'node:zlib';
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.split(/=(.*)/s).slice(0,2)));
const profile=args['--profile']||'shell-fixed';
if(!['shell-fixed','shell-small','shell-parallel'].includes(profile))throw Error('Invalid shell profile');
const root=process.cwd(),temp=await mkdtemp(path.join(os.tmpdir(),'corvus-home-wasm-'));
const changes=[];
function disable(text,needle){if(!text.includes(needle))throw Error('Source changed: '+needle);changes.push(needle);return text.replace(needle,'#[cfg(any())]\n'+needle);}
try{
 await copyFile('Cargo.toml',temp+'/Cargo.toml');await copyFile('Cargo.lock',temp+'/Cargo.lock');await copyFile('rust-toolchain.toml',temp+'/rust-toolchain.toml');
 await cp('rust',temp+'/rust',{recursive:true,filter:src=>!src.includes('/pkg')});await mkdir(temp+'/api');await copyFile('api/rust.rs',temp+'/api/rust.rs');
 let lib=await readFile(temp+'/rust/browser/src/lib.rs','utf8');
 // /map actually imports the live banner. Keeping it is required parity, even
 // though the homepage does not use it. The failed first profile is preserved.
 for(const declaration of ['mod army_transport;','pub mod privacy_page;','mod cv;'])lib=disable(lib,declaration);
 lib=disable(lib,'#[wasm_bindgen]\npub fn plethora_url');
 await writeFile(temp+'/rust/browser/src/lib.rs',lib);
 let site=await readFile(temp+'/rust/browser/src/site/mod.rs','utf8');
 for(const name of ['corner','eggs','feature','realm','terminal'])site=disable(site,`mod ${name};`);
 for(const name of ['start_terminal','open_terminal','start_eggs','collect_realm_feather','start_realm','start_realm_night','start_i18n','init_i18n','render_corner_search','load_feature','format_feature_copy','feature_text'])site=disable(site,`#[wasm_bindgen]\npub fn ${name}`);
 await writeFile(temp+'/rust/browser/src/site/mod.rs',site);
 if(profile!=='shell-fixed')for(const file of ['rust/core/Cargo.toml','rust/browser/Cargo.toml']){
  const source=await readFile(temp+'/'+file,'utf8');
  if(!source.includes('regex = "1"'))throw Error('Review regex dependency');
  // Keep ALL Unicode semantics. Only optional matching accelerators are removed;
  // no smaller ASCII-only replacement and no changes to privacy validation.
  await writeFile(temp+'/'+file,source.replace('regex = "1"','regex = { version = "1", default-features = false, features = ["std", "unicode"] }'));
  changes.push(file+': regex std + unicode, without optional perf features');
 }
 if(profile==='shell-parallel'){
  const file=temp+'/rust/browser/src/site/discovery.rs';
  let source=await readFile(file,'utf8');
  const replace=(before,after)=>{if(!source.includes(before))throw Error('Review Rust discovery overlay: '+before);source=source.replace(before,after);};
  replace('    let mut extra = Vec::new();',`    // Eager promises start independent reads while this document is alive.
    // Failures resolve to an explicit envelope; no unhandled promise rejection.
    let senate = pending_read("/api/legion?senate=1", RequestCache::NoStore, 6000);
    let videos = (force || directory).then(|| pending_read("/api/compound-v2", RequestCache::NoCache, 8000));
    let army = pending_read("/api/army?view=legion", RequestCache::NoStore, 6000);
    let mut extra = Vec::new();`);
  replace('get("/api/legion?senate=1", RequestCache::NoStore, 6000).await','read_pending(senate).await');
  replace('if (force || directory)\n        && let Ok(data) = get("/api/compound-v2", RequestCache::NoCache, 8000).await','if let Some(pending) = videos\n        && let Ok(data) = read_pending(pending).await');
  replace('get("/api/army?view=legion", RequestCache::NoStore, 6000).await','read_pending(army).await');
  source+=`\nfn pending_read(url: &'static str, cache: RequestCache, timeout: u32) -> JsFuture {
    JsFuture::from(wasm_bindgen_futures::future_to_promise(async move {
        let result = match get(url, cache, timeout).await {
            Ok(data) => json!({"ok":true,"data":data}),
            Err(_) => json!({"ok":false})
        };
        js(&result)
    }))
}
async fn read_pending(pending: JsFuture) -> Result<Value, JsValue> {
    let envelope = value(&pending.await?);
    if envelope["ok"] == true { Ok(envelope["data"].clone()) }
    else { Err("directory unavailable".into()) }
}\n`;
  await writeFile(file,source);changes.push('discovery: independent reads concurrent, existing ordered merge/failure behavior');
 }
 const target=path.join(root,'target/ten-shell-build');
 execFileSync('cargo',['build','--locked','-p','corvus-browser','--target','wasm32-unknown-unknown','--profile','browser-release','--no-default-features'],{cwd:temp,stdio:'inherit',env:{...process.env,CARGO_TARGET_DIR:target}});
 const out=path.join(root,'rust/browser/pkg/ten/'+profile);await mkdir(out,{recursive:true});
 execFileSync('wasm-bindgen',['--target','web','--remove-name-section','--remove-producers-section','--out-dir',out,target+'/wasm32-unknown-unknown/browser-release/corvus_browser.wasm'],{stdio:'inherit'});
 let coreTests=null;
 if(args['--test-core']==='1')coreTests=execFileSync('cargo',['test','--locked','-p','corvus-core','--lib'],{cwd:temp,encoding:'utf8',env:{...process.env,CARGO_TARGET_DIR:target}}).trim();
 const bytes=await readFile(out+'/corvus_browser_bg.wasm');
 const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),profile,created:new Date().toISOString(),disabledDeclarations:changes,scope:['/','/map/'],sha256:createHash('sha256').update(bytes).digest('hex'),raw:bytes.length,br4:brotliCompressSync(bytes,{params:{[z.BROTLI_PARAM_QUALITY]:4}}).length,br11:brotliCompressSync(bytes,{params:{[z.BROTLI_PARAM_QUALITY]:11}}).length,exports:WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map(e=>e.name)};
 report.coreTests=coreTests;
 await writeFile(out+'/experiment.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await rm(temp,{recursive:true,force:true});}
