import {parseSlug,SOURCES,videoPath,SEED_VIDEOS,voteCode,pinnedComment} from '../../compound/v2/config.js';
export {parseSlug,SEED_VIDEOS};
export const RETENTION=90*86400;
export const METRICS=['views','likes','comments','shares'];
export const EVENTS=['pageview','vote','feedback','share_click','outbound_click','code_entered'];
export function safePostURL(value,compound=false){
 if(!value)return '';if(typeof value!=='string'||value.length>1500)throw Error('invalid post URL');
 const u=new URL(value),h=u.hostname.toLowerCase().replace(/^www\./,'');
 const hosts=compound?['compound.mov']:['tiktok.com','vm.tiktok.com','vt.tiktok.com','instagram.com','x.com','twitter.com','linkedin.com','lnkd.in','twitch.tv','m.tiktok.com','youtube.com','m.youtube.com','youtu.be'];
 if(u.protocol!=='https:'||u.username||u.password||!hosts.includes(h))throw Error('invalid post URL');
 u.hash='';return u.href;
}
export function video(raw,{allowPending=false}={}){
 const parsed=parseSlug(raw?.slug);if(!parsed)throw Error('invalid slug');
 if(raw.hook_line!==undefined&&(typeof raw.hook_line!=='string'||raw.hook_line.length>180))throw Error('hook line must be at most 180 characters');
 const result={hook_line:String(raw.hook_line||'').trim().replace(/[\u0000-\u001f\u007f]/g,' '),...parsed,post_url:safePostURL(raw.post_url),compound_url:safePostURL(raw.compound_url,true),is_example:raw.is_example===true};
 if(!allowPending&&!result.is_example&&!result.post_url&&!SEED_VIDEOS.some(v=>v.slug===result.slug))throw Error('a real video needs a post URL');
 for(const key of METRICS){const n=Number(raw[key]??0);if(!Number.isSafeInteger(n)||n<0||n>1e12)throw Error('metrics must be non-negative whole numbers');result[key]=n;}
 if(!result.post_url&&METRICS.some(k=>result[k]))throw Error('add the post URL before recording social metrics');
 if(result.is_example&&METRICS.some(k=>result[k]))throw Error('examples must have zero metrics');
 if(raw.posted_at&&!Number.isFinite(Date.parse(raw.posted_at)))throw Error('invalid date');
 if(raw.vote_code!==undefined&&raw.vote_code!==voteCode(parsed))throw Error('vote code must match the export: '+voteCode(parsed));
 if(raw.status!==undefined&&!['pending','ready','posted'].includes(raw.status))throw Error('invalid video status');
 if(raw.status==='posted'&&!result.post_url)throw Error('posted videos need a post URL');
 result.vote_code=voteCode(parsed);result.pinned_comment=pinnedComment(parsed);result.status=result.post_url?'posted':raw.status||'pending';
 result.posted_at=raw.posted_at?new Date(raw.posted_at).toISOString():null;result.updated_at=new Date().toISOString();result.awaiting_url=!result.post_url;result.metric_source=result.is_example?'example':result.awaiting_url?'pending':'manual';return result;
}
export function destination(slug,query={}){
 const v=parseSlug(slug);if(!v)return null;const u=new URL(videoPath(v),'https://corvus.gent');u.searchParams.set('video',slug);
 const entries=Object.entries(query).filter(([k,v])=>!['compoundV2','slug','short'].includes(k)&&typeof v==='string'&&v.length<=500);
 for(const[k,v]of entries)if(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','c'].includes(k))u.searchParams.set(k,v);
 // Preserve attribution as a complete set: do not mix someone else's campaign with ours.
 if(!entries.some(([k])=>/^utm_/i.test(k)))for(const[k,val]of Object.entries({utm_source:SOURCES[v.platform],utm_medium:v.platform==='tw'?'live':'post',utm_campaign:'compound-v2',utm_content:slug}))u.searchParams.set(k,val);
 return u.pathname+u.search;
}
export function attribution(raw={}){
 if(!raw||typeof raw!=='object')raw={};const output={};
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_content']){const v=raw[key]??raw[key.slice(4)];if(typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(v))output[key]=v;}
 let referrer='';try{const h=new URL(raw.referrer.includes('://')?raw.referrer:'https://'+raw.referrer).hostname.toLowerCase();referrer=['instagram.com','l.instagram.com','tiktok.com','x.com','t.co','linkedin.com','lnkd.in','twitch.tv','corvus.gent','web.whatsapp.com','youtube.com','youtu.be'].includes(h.replace(/^www\./,''))?h:'other';}catch{}
 return{...output,referrer};
}

const fields=['slug','platform','account','lang','hook','n','vote_code','hook_line','post_url','compound_url','is_example','views','likes','comments','shares','posted_at','updated_at','status','awaiting_url','metric_source','synced_at','interview_n','interview_clip_url'];
export function publicVideo(row){const v=Object.fromEntries(fields.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));return{...v,vote_code:voteCode(row),status:row.post_url?'posted':row.status||'pending'};}
