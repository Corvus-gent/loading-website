import {SHARE_CONFIG} from './share-config.js?v=20261109share3';
import {parseSlug,voteCode,codeURL} from './config.js?v=20261109code1';
export function shareCopy(video){
 const v=parseSlug(video?.slug);if(!v)throw Error('Invalid video slug.');
 const locale=SHARE_CONFIG.languages[v.lang],code=voteCode(v);
 if(!locale)throw Error('Missing language template.');
 // New registered hook families can still share their code and localized CTA.
 // One missing phrase must not prevent every other draft from rendering.
 const hook=locale.hooks[v.hook]||'';
 return locale.template.replaceAll('{hook}',hook).replaceAll('{code}',code).trim();
}
export function trackedShort(video,source,medium='post'){
 const v=parseSlug(video?.slug);if(!v||!['x','linkedin','whatsapp'].includes(source)||!['post','comment','dm'].includes(medium))throw Error('Invalid share link.');
 const u=new URL(codeURL(v));
 for(const[k,value]of Object.entries({utm_source:source,utm_medium:medium,utm_campaign:SHARE_CONFIG.campaign,utm_content:v.slug}))u.searchParams.set(k,value);
 return u.href;
}
export function replyPostID(value){
 let text=String(value||'').trim();if(/^(?:(?:www|mobile)\.)?(?:x|twitter)\.com\//i.test(text))text='https://'+text;
 try{const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password||u.port||!['x.com','www.x.com','mobile.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(u.hostname.toLowerCase()))return null;
 return /^\/(?:[a-zA-Z0-9_]{1,15}\/status|i(?:\/web)?\/status)\/([1-9]\d{0,24})(?:\/(?:photo|video)\/[1-4])?\/?$/.exec(u.pathname)?.[1]||null;
 }catch{return null;}
}
export function shareDraft(video,platform,replyURL=''){
 const source=platform==='reply'?'x':platform,medium=platform==='reply'?'comment':source==='whatsapp'?'dm':'post';
 const short=trackedShort(video,source,medium),text=shareCopy(video)+' '+short;
 if(platform==='linkedin'){const u=new URL('https://www.linkedin.com/sharing/share-offsite/');u.searchParams.set('url',short);return u.href;}
 if(platform==='whatsapp'){const u=new URL('https://wa.me/');u.searchParams.set('text',text);return u.href;}
 const u=new URL('https://x.com/intent/post');if(platform==='reply'){const id=replyPostID(replyURL);if(!id)return null;u.searchParams.set('in_reply_to',id);}u.searchParams.set('text',text);return u.href;
}
export function todayDrafts(videos,now=new Date()){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:SHARE_CONFIG.timeZone}).format(now);
 const rows=videos.filter(v=>!v.is_example&&parseSlug(v.slug));
 return 'X drafts · '+day+' · San Francisco · '+rows.length+' videos\n\n'+rows.map(v=>v.slug+'\n'+shareDraft(v,'x')).join('\n\n');
}
