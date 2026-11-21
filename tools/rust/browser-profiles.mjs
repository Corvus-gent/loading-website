// Publishing policy: exactly one WASM instance per document keeps shared state
// coherent. Unknown or feature-heavy pages retain the complete tested bundle.
export const WASM_MODULE='/rust/browser/pkg/corvus_browser.js';
const publicPages=new Set(['/', '/map', '/gabe', '/now', '/languages', '/daily', '/realm', '/support', '/support/books', '/support/companies', '/sf', '/sf/larp', '/privacy', '/402']);
export function browserProfile(pathname){
 let p;try{p=decodeURIComponent(new URL(pathname,'https://corvus.gent').pathname);}catch{return 'full';}
 if(p.includes('\\')||p.includes('//'))return 'full';
 p=p.replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';
 return publicPages.has(p)||p==='/cv'||p.startsWith('/cv/')?'core':'full';
}
export function browserProfileHtml(html,pathname){
 const profile=browserProfile(pathname);
 if(profile==='full'||!/<head(?:\s[^>]*)?>/i.test(html))return html;
 if(/<script\b[^>]*\btype\s*=\s*["']importmap["']/i.test(html))throw Error('Merge the existing import map explicitly before selecting a WASM profile');
 const map=JSON.stringify({imports:{[WASM_MODULE]:`/rust/browser/pkg/${profile}/corvus_browser.js`}});
 return html.replace(/<head(?:\s[^>]*)?>/i,head=>head+'<script type="importmap" data-corvus-wasm="'+profile+'">'+map+'</script>');
}
