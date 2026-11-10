import sanitize from './sanitize-bundle.cjs';
export const FRAME_CSP="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox";
export function safePage(raw){
 raw=raw.trim().replace(/^```(?:html)?\s*/i,'').replace(/\s*```$/,'');
 if(raw.length>180000||!/<\/html>\s*$/i.test(raw)||!/<\/body>/i.test(raw))throw Error('incomplete');
 const clean=sanitize(raw,{allowedTags:[...sanitize.defaults.allowedTags,'html','head','body','title','style','img','details','summary'],allowedAttributes:{'*':['class','id','style','title','role','aria-label'],a:['href'],img:['src','alt','width','height']},allowedSchemes:['data'],allowedSchemesByTag:{img:['data']},allowVulnerableTags:true,transformTags:{a:(tag,attrs)=>({tagName:tag,attribs:attrs.href?.startsWith('#')?{href:attrs.href}:{}}),img:(tag,attrs)=>({tagName:tag,attribs:/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attrs.src||'')?attrs:{alt:attrs.alt||'Image removed from sandbox'}})}});
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+FRAME_CSP.replace('; sandbox','')+'"><style>html{overflow-wrap:anywhere}body{margin:0}img{max-width:100%;height:auto}*{box-sizing:border-box}</style></head><body>'+clean+'</body></html>';
}
