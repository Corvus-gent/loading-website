// Translation content is unchanged; emit data for the Rust browser compiler.
import {writeFileSync,readFileSync} from 'node:fs';
const all={};for(const code of ['en','nl','es','fr','pt','de','zh'])all[code]=(await import('../../js/locales/'+code+'.js')).default;
const data=JSON.stringify(all)+'\n',file=new URL('../../rust/browser/locales.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==data)throw Error('Rust locale data is stale; run node tools/rust/locales.mjs.');}else writeFileSync(file,data);
