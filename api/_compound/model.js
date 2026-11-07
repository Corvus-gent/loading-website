export const DEADLINE='2026-11-09T17:00:00Z';
export const FUND_DEADLINE='2026-11-08T07:30:00Z';
export const GOAL=4000,RETENTION=90*86400;
export const CATEGORIES=['Hook','Transitions','Music','Pacing','Story','Humor','Visuals','Ending'];
export const REACTIONS=['fire','laugh','neutral','skull','cut'];
export const SOURCES=['x','linkedin','instagram','tiktok','discord','whatsapp','share','corvus','direct','other'];
export const EVENTS=['view','play','watch','dropoff','donation_click','army_join','share'];
export const clean=(value,max=280)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
export const validVersion=v=>/^v[1-9]\d{0,5}$/.test(v||'');
export const source=v=>SOURCES.includes(v)?v:'other';
export function attribution(raw={}){
 const result={source:source(raw.source||raw.utm_source||'direct')};
 // Never accept arbitrary URLs, emails or full referrer paths into attribution.
 for(const key of ['medium','campaign','content','term']){const v=clean(raw[key]||raw['utm_'+key],64);if(v&&/^[a-zA-Z0-9_-]+$/.test(v))result[key]=v;}
 if(raw.referrer){try{const u=new URL(raw.referrer.includes('://')?raw.referrer:'https://'+raw.referrer);const h=u.hostname.replace(/^www\./,'');result.referrer=['x.com','t.co','linkedin.com','lnkd.in','instagram.com','tiktok.com','discord.com','whatsapp.com','corvus.gent'].includes(h)?h:'other';}catch{result.referrer='other';}}
 if(Number.isFinite(raw.landed)&&Math.abs(Date.now()-raw.landed)<30*86400000)result.landed=raw.landed;
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
