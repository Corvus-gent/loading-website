// Preserve the original Compound destination while attributing the click.
export function compoundTrackedURL(href,placement='site',base='https://corvus.gent'){
 let u;try{u=new URL(href,base);}catch{return null;}
 if(u.protocol!=='https:'||!['compound.mov','www.compound.mov'].includes(u.hostname))return null;
 const id=/^[a-z0-9-]{1,48}$/.test(placement)?placement:'site',go=new URL('/go/compound-'+id,base);
 if(u.pathname!=='/'||u.search||u.hash)go.searchParams.set('to',u.href);return go.href;
}
const placement=()=>location.pathname.startsWith('/compound/impact')?'impact':location.pathname.startsWith('/compound/v2')?'v2':location.pathname.startsWith('/hack/3')?'hack3':location.pathname.split('/').filter(Boolean).slice(0,2).join('-')||'home';
function patch(root){for(const a of [root.matches?.('a[href]')?root:null,...(root.querySelectorAll?.('a[href]')||[])].filter(Boolean)){const url=compoundTrackedURL(a.href,a.closest('footer')?'footer':placement());if(url)a.href=url;}}
if(typeof document!=='undefined'){patch(document);const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')patch(r.target);else for(const n of r.addedNodes)if(n.nodeType===1)patch(n);}});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});}
