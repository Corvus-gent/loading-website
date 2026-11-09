import {LANGUAGES,HOOKS,DEADLINE,parseSlug} from '../../compound/v2/config.js';
import {get,list} from '../_interviews/store.js';
import * as videos from '../_compound-v2/store.js';
const root='https://corvus.gent';
export class NotFound extends Error{constructor(){super('Card not found.');this.status=404;}}
async function bounded(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Unavailable')),2200);})]);}finally{clearTimeout(timer);}}
export function countdown(now=Date.now()){const minutes=Math.max(0,Math.ceil((Date.parse(DEADLINE)-now)/60000));return minutes?`${Math.floor(minutes/1440)}d ${Math.floor(minutes/60)%24}h ${minutes%60}m left`:'challenge ended';}
export function interviewCard(row){return{kind:'interview',n:row.n,kicker:'HACKATHON 003 / INTERVIEW '+row.n,title:row.project,builder:row.builder,line:row.description,description:`${row.builder} built ${row.project}. ${row.description}`,photo:row.photo_url||'',url:root+'/hack/3?interview='+row.n,metaTitle:`Interview #${row.n}: ${row.builder} built ${row.project}`,lang:'en',updated:row.updated_at};}
export async function resolve(q){
 if(q.kind==='live')return{kind:'live',kicker:'ONE-MAN ARMY. MANY EDITORS.',title:'LIVE from a robotics hackathon in SF',metaTitle:'🔴 LIVE from a robotics hackathon in SF',line:'24-hour content streak. Watch with Gabe.',description:'One-man army. Many editors. Livestreaming the builders and their robots in San Francisco.',photo:'gabe',url:root+'/live',lang:'en'};
 if(q.kind==='interview'){if(!/^[1-9]\d{0,3}$/.test(q.n||''))throw new NotFound();const row=await bounded(get(q.n));if(!row)throw new NotFound();return interviewCard(row);}
 if(q.kind==='hack3'){let rows=[];try{rows=await bounded(list());}catch{}const row=rows[0];return row?{...interviewCard(row),url:root+'/hack/3',kind:'hack3'}:{kind:'hack3',kicker:'HACKATHON 003 / SAN FRANCISCO',title:'Meet the robots.',metaTitle:'Hack #3: Robotics hackathon, SF',line:'Builders. Their robots. Their stories.',description:'Meet the builders and their robots. Interviews from a robotics hackathon in San Francisco.',photo:'gabe',url:root+'/hack/3',lang:'en'};}
 if(q.kind!=='compound')throw new NotFound();
 const lang=q.lang||'en',hook=q.hook||'',n=q.n||'';if(!Object.hasOwn(LANGUAGES,lang)||(hook&&!Object.hasOwn(HOOKS,hook))||(n&&(!hook||!/^[1-9]\d{0,3}$/.test(n))))throw new NotFound();
 const candidate=parseSlug(q.video);let video=null;if(n){try{video=candidate&&candidate.lang===lang&&candidate.hook===hook&&candidate.n===Number(n)?await bounded(videos.get(candidate.slug)):(await bounded(videos.videos())).find(v=>v.lang===lang&&v.hook===hook&&v.n===Number(n));}catch{}}
 const code=n?(lang+'-'+hook+n).toUpperCase():hook?(lang+'-'+hook).toUpperCase():q.lang?lang.toUpperCase():'$1,000';
 const url=new URL('/compound/v2'+(q.lang?'/'+lang:'')+(hook?'/'+hook:'')+(n?'/'+n:''),root);if(candidate&&video?.slug===candidate.slug)url.searchParams.set('video',candidate.slug);
 const line=video?.hook_line||LANGUAGES[lang][1];return{kind:'compound',code,title:code,metaTitle:code+' · vote the next cut · Corvus',kicker:'ONE-MAN ARMY. MANY EDITORS.',line,description:line+' Vote the next cut. $1,000 on the line. Deadline: Mon 9 Nov 2026, 09:00 PT.',lang,url:url.href,updated:video?.updated_at,video:video?.slug||'',isHub:!q.lang,deadline:DEADLINE};
}
export function imageURL(card){const u=new URL('/api/og',root);u.searchParams.set('kind',card.kind);if(card.kind==='interview')u.searchParams.set('n',card.n);if(card.kind==='compound'){const p=new URL(card.url).pathname.split('/').slice(3);for(const[k,v]of [['lang',p[0]],['hook',p[1]],['n',p[2]]])if(v)u.searchParams.set(k,v);if(card.video)u.searchParams.set('video',card.video);}u.searchParams.set('v','20261109og1');if(card.updated)u.searchParams.set('updated',String(Date.parse(card.updated)));return u.href;}
export const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function metadata(html,card){
 const title=card.metaTitle||card.title,image=imageURL(card),tags={description:card.description,'og:type':'website','og:title':title,'og:description':card.description,'og:url':card.url,'og:image':image,'og:image:secure_url':image,'og:image:type':'image/png','og:image:width':'1200','og:image:height':'630','og:image:alt':title+' — '+card.line,'twitter:card':'summary_large_image','twitter:title':title,'twitter:description':card.description,'twitter:image':image,'twitter:image:alt':title+' — '+card.line};
 html=html.replace(/<title>[^<]*<\/title>/,()=>'<title>'+esc(title)+'</title>').replace(/<link\b[^>]*rel="canonical"[^>]*>/gi,'');
 for(const[k,v]of Object.entries(tags)){const re=new RegExp('<meta\\b[^>]*(?:property|name)="'+k+'"[^>]*>','gi');html=html.replace(re,'');}
 const head=Object.entries(tags).map(([k,v])=>`<meta ${k.startsWith('og:')?'property':'name'}="${k}" content="${esc(v)}">`).join('')+`<link rel="canonical" href="${esc(card.url)}">`;
 return html.replace('</head>',()=>head+'</head>');
}
