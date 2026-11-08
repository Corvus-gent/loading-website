export const DEADLINE='2026-11-09T17:00:00Z';
export const FUND_DEADLINE='2026-11-08T07:30:00Z';
export const GOAL=4000,RETENTION=90*86400;
export const CATEGORIES=['Hook','Transitions','Music','Pacing','Story','Humor','Visuals','Ending'];
export const REACTIONS=['fire','laugh','neutral','skull','cut','bored'];
export const SOURCES=['dm','facebook','x','linkedin','instagram','tiktok','discord','whatsapp','share','corvus','direct','hostel','video','offline','compound','other'];
export const EVENTS=['view','play','watch','dropoff','donation_click','army_join','share'];
export const clean=(value,max=280)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
export const validVersion=v=>/^v[1-9]\d{0,5}$/.test(v||'');
export const source=v=>SOURCES.includes(v)?v:'other';
export function attribution(raw={},nested=true){
 if(!raw||typeof raw!=='object')raw={};
 const result={source:source(raw.source||raw.utm_source||'direct'),source_confidence:['utm','user_agent','referrer','unknown'].includes(raw.source_confidence)?raw.source_confidence:(raw.utm_source?'utm':'unknown')};
 // Never accept arbitrary URLs, emails or full referrer paths into attribution.
 for(const key of ['medium','campaign','content','term']){const v=clean(raw[key]||raw['utm_'+key],64);if(v&&/^[a-zA-Z0-9_.-]+$/.test(v))result[key]=v;}
 if(raw.referrer){try{const u=new URL(raw.referrer.includes('://')?raw.referrer:'https://'+raw.referrer);const h=u.hostname.replace(/^www\./,'');result.referrer=['x.com','t.co','linkedin.com','lnkd.in','instagram.com','l.instagram.com','tiktok.com','discord.com','whatsapp.com','corvus.gent'].includes(h)?h:'other';}catch{result.referrer='other';}}
 if(Number.isFinite(raw.landed)&&Math.abs(Date.now()-raw.landed)<30*86400000)result.landed=raw.landed;
 if(nested){result.first=attribution(raw.first||raw,false);result.last=attribution(raw.last||raw,false);}
 return result;
}
export function validatePoll(raw){
 const q=clean(raw.q,180),options=Array.isArray(raw.options)?raw.options.map(x=>clean(x,60)):[];
 if(!q||options.length<2||options.length>4||options.some(x=>!x)||new Set(options).size!==options.length)throw Error('poll');
 return {q,options};
}
export function validateCues(raw,duration){
 if(!Array.isArray(raw)||raw.length>30)throw Error('cues');
 return raw.map((c,i)=>{if(!Number.isFinite(c.t)||c.t<0||c.t>duration)throw Error('cues');return{id:'cue-'+i,t:c.t,...validatePoll(c)};}).sort((a,b)=>a.t-b.t);
}
export function timeBucket(raw,duration){const t=Number(raw);if(!Number.isFinite(t)||t<0||t>duration+2)throw Error('timestamp');return Math.min(Math.floor(duration),Math.floor(t));}
export const TRANSITION_TAGS=['keep','cut','too slow','too fast','confusing','smooth','funny','strong hook'];
export function validateCutlist(raw,duration){
 const list=Array.isArray(raw)?raw:raw?.transitions||[];
 if(!Array.isArray(list)||list.length>120)throw Error('cutlist');
 const seen=new Set();let previousEnd=0;
 return list.map((item,i)=>{
  const start=Number(item.start??item.t),end=Number(item.end),label=clean(item.label,100),id=clean(item.id||'t'+(i+1),40);
  if(!/^[a-zA-Z0-9_.-]+$/.test(id)||seen.has(id)||!label||!Number.isFinite(start)||!Number.isFinite(end)||start<previousEnd||end<=start||end>duration)throw Error('cutlist');
  seen.add(id);previousEnd=end;return{id,start,end,label,...(['scene','transition'].includes(item.type)?{type:item.type}:{})};
 });
}

export const QUICK_CHIPS=['hook','memes','music','length','fire','note'];
