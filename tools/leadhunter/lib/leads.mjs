import {validateLead} from '../../../api/_leads/model/schema.js';
import {parseBudget} from '../../../api/_leads/model/score.js';
import {createHash} from 'node:crypto';
import {httpsLink} from './config.mjs';
const HOUR=3600000;
const clean=v=>String(v||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim();
export const needsWebsite=text=>/\bneed(?:s)?\s+(?:a\s+)?(?:website|landing page)\b|\blooking for (?:a\s+)?web developer\b|\[hiring\][\s\S]*\b(?:website|web developer|landing page)\b|\bwebsite\s+asap\b|\bwho can build me a website\b/i.test(text);
export const offersServices=text=>/\[for[ -]hire\]|\[offer\]|\b(?:i(?:['’]m| am)|we are) (?:an? |experienced |freelance )*(?:web(?:site)? (?:developer|designer)|developer)\b|\b(?:offering|i offer|we offer|i build|we build|i create|we create|i can build)\s+(?:\w+\s+){0,3}(?:websites?|landing pages?)\b|\b(?:need a website|looking for a web developer)[?!.\s]*(?:dm me|contact me|i can help|we can help)\b/i.test(text);
export function scoreLead({text,posted_at,contact}, now=Date.now()) {
 const age=now-Date.parse(posted_at); const reasons=[];
 if(/\b(asap|today|urgent|this week|now)\b/i.test(text))reasons.push(['urgency',40]);
 if(/(?:[$€£]\s*\d|\d[\d,.]*\s*(?:usd|eur|gbp|dollars|euros|pounds)\b|\bbudget\b)/i.test(text)&&! /\b(no budget|unpaid|for free)\b/i.test(text))reasons.push(['budget',20]);
 if(Number.isFinite(age)&&age>=0&&age<2*HOUR)reasons.push(['under 2h',20]);
 if(/\[hiring\]/i.test(text))reasons.push(['hiring',10]);
 if(contact)reasons.push(['contact',10]);
 return {score:reasons.reduce((n,r)=>n+r[1],0),reasons:reasons.map(([label,points])=>({label,points}))};
}
export function contactFor(row) {
 const email=clean(row.email||'');
 if(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))return {kind:'email',recipient:email};
 if(row.whatsapp&&/^\+?[1-9]\d{6,14}$/.test(row.whatsapp))return {kind:'whatsapp',recipient:row.whatsapp.replace('+','')};
 if(row.source==='reddit'&&/^[\w-]{3,30}$/.test(row.handle||'')&&row.handle!=='[deleted]')return {kind:'reddit',recipient:row.handle};
 if(row.source==='x'&&/^\d+$/.test(row.author_id||''))return {kind:'x',recipient:row.author_id};
 return null;
}
export function draft(row,cfg) {
 const name=clean(row.name||row.handle||'there').slice(0,80);
 const body=`Hey ${name}, ${row.source==='places'?"noticed there's no website listed for your business on Google Maps":`saw you need ${row.need}`}. I'm Gabe, a European builder and multiple-time hackathon winner in SF. I ship fast: hop on a 10-min call and I'll have a first version live within 30 minutes after. Grab a slot: ${cfg.cal||'{CAL_LINK}'}. Pay only when you're happy (${cfg.revolut||'{REVOLUT_LINK}'}).`;
 const subject='A first version of your website'; const c=row.contact; let url='';
 if(c&&cfg.cal&&cfg.revolut) {
  const e=encodeURIComponent;
  if(c.kind==='reddit')url=`https://www.reddit.com/message/compose?to=${e(c.recipient)}&subject=${e(subject)}&message=${e(body)}`;
  if(c.kind==='x')url=`https://x.com/messages/compose?recipient_id=${e(c.recipient)}&text=${e(body)}`;
  if(c.kind==='email')url=`mailto:${e(c.recipient)}?subject=${e(subject)}&body=${e(body)}`;
  if(c.kind==='whatsapp')url=`https://wa.me/${c.recipient}?text=${e(body)}`;
 }
 return {body,subject,url,kind:c?.kind||'copy',ready:Boolean(url),missing:[!cfg.cal&&'CAL_LINK',!cfg.revolut&&'REVOLUT_LINK'].filter(Boolean)};
}
export function normalize(row,cfg,now=Date.now()) {
 const text=clean(`${row.title||''} ${row.text||''}`); const url=httpsLink(row.url);
 const time=Date.parse(row.posted_at); const business=row.source==='places';
 if(!url||!['reddit','x','places'].includes(row.source))return null;
 if(!business&&(!Number.isFinite(time)||now-time<0||now-time>=24*HOUR||!needsWebsite(text)||offersServices(text)))return null;
 if(business&&(!row.website_checked||row.website))return null;
 const email=row.email||text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
 const contact=contactFor({...row,email});
 const need=business?`a website for ${clean(row.name)}`:/landing page/i.test(text)?'a landing page':/web developer/i.test(text)?'a web developer':'a website';
 const id=createHash('sha256').update(business?`place:${row.place_id}`:url.split('?')[0].replace(/\/$/,'')).digest('hex').slice(0,24);
 const result={id,source:row.source,url,name:clean(row.name||row.handle||'there').slice(0,100),handle:clean(row.handle).slice(0,80),need,snippet:text.slice(0,1400),posted_at:business?null:new Date(time).toISOString(),first_seen_at:new Date(now).toISOString(),expires_at:new Date(business?now+24*HOUR:time+24*HOUR).toISOString(),contact,city:clean(row.city),...scoreLead({text,posted_at:row.posted_at,contact},now)};
 if(business)result.note='No website listed; demand and urgency are unconfirmed.';
 const budget=parseBudget(text);
 const canonical=validateLead({...result,...budget,contact:contact?.recipient||'',contact_kind:contact?.kind||'',warm:false,status:'new',urgency:/\b(asap|today|urgent|now)\b/i.test(text)?'urgent':/this week/i.test(text)?'this_week':'unknown',next_action:'Review the request and open a draft',evidence:{...row.evidence,hourly:budget.hourly}});canonical.outreach=draft(result,cfg);return canonical;
}
export function dedupe(rows,now=Date.now()) {
 const seen=new Map(),fingerprints=new Set();
 for(const row of rows.filter(Boolean).sort((a,b)=>b.score-a.score)) {
  if(Date.parse(row.expires_at)<=now)continue;
  // Cross-posts share an author and substantial text; never merge unrelated short requests.
  const fp=row.snippet.length>100?`${row.handle.toLowerCase()}:${row.snippet.toLowerCase().replace(/https?:\/\/\S+/g,'').replace(/\W+/g,'')}`:row.id;
  if(seen.has(row.id)||fingerprints.has(fp))continue;
  seen.set(row.id,row);fingerprints.add(fp);
 }
 return [...seen.values()].slice(0,500);
}
