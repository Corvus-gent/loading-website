import {parseCode,videoPath} from '../../compound/v2/config.js';
export function resolveCode(raw,videos,query={},source='url'){
 const parsed=parseCode(raw),code=parsed?.code||String(raw||'').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,32)||'UNKNOWN';
 const matches=parsed?videos.filter(v=>v.lang===parsed.lang&&v.hook===parsed.hook&&Number(v.n)===parsed.n).sort((a,b)=>a.slug.localeCompare(b.slug)):[];
 const params=new URLSearchParams(Object.entries(query||{}).filter(([k,v])=>/^utm_/i.test(k)&&typeof v==='string'&&v.length<=500));
 let path='/compound/v2';
 if(matches.length){path=matches.length===1?videoPath(matches[0]):`/compound/v2/${parsed.lang}/${parsed.hook}`;params.set('c',code);if(matches.length===1)params.set('video',matches[0].slug);
  if(![...params.keys()].some(k=>/^utm_/i.test(k)))for(const[k,v]of Object.entries({utm_source:'code',utm_medium:source==='url'?'pinned_comment':'typed',utm_content:matches.length===1?matches[0].slug:code}))params.set(k,v);
 }else{params.set('code',String(raw||'').slice(0,32));params.set('code_missing','1');}
 return{code,parsed,matches:matches.length,destination:path+'?'+params};
}
