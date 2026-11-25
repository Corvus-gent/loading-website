/** Stable v1 contract. Changes after merge require an explicit migration. */
export const SCHEMA_VERSION = 1 as const;
export const STATUSES = ['new','contacted','call','offer_sent','won','lost'] as const;
export type LeadStatus = typeof STATUSES[number];
export type Source = 'reddit'|'x'|'places'|'warm';
export type Urgency = 'urgent'|'this_week'|'normal'|'unknown';
export interface Offer {
 tier:string; title:string; scope:string; price:number; currency:'EUR'; delivery:string;
 upfront_percent:number; upfront_amount:number; pay_link:string; text:string; note:string;
}
export interface Lead {
 id:string; source:Source; name:string; contact:string; need:string;
 budget_min:number|null; budget_max:number|null; currency:string;
 urgency:Urgency; warm:boolean; next_action:string; status:LeadStatus; offer:Offer|null;
 // Optional evidence and operational metadata, never credentials.
 url?:string; snippet?:string; score?:number; posted_at?:string|null; first_seen_at?:string;
 expires_at?:string; updated_at?:string; revision?:number; contact_kind?:string; handle?:string;
 evidence?:Record<string,unknown>;
 outreach?:{body:string;subject:string;url:string;ready:boolean;missing:string[]};
 reasons?:Array<{label:string;points:number}>; note?:string; city?:string;
}
export interface Tier { id:string; name:string; min:number; max:number; price:number; currency:string; scope:string; delivery:string; upfront_percent:number; }
const plain=(x:unknown,max=400)=>String(x??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
const amount=(x:unknown):number|null=>{if(x===null||x===''||x===undefined)return null;const n=Number(x);if(!Number.isFinite(n)||n<0||n>1000000)throw Error('Invalid budget');return n;};
export function validHttps(value:unknown):string {try {const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function validateLead(input:Partial<Lead>,now=new Date().toISOString()):Lead {
 if(!/^[a-zA-Z0-9_-]{6,80}$/.test(input.id||''))throw new Error('Invalid lead id');
 if(!['reddit','x','places','warm'].includes(input.source||''))throw new Error('Invalid source');
 const name=plain(input.name,100),need=plain(input.need,1400),contact=plain(input.contact,300);
 if(!name||!need)throw new Error('Name and need are required');
 if(!STATUSES.includes(input.status as LeadStatus))throw new Error('Invalid status');
 if(!['urgent','this_week','normal','unknown'].includes(input.urgency||''))throw new Error('Invalid urgency');
 const budget_min=amount(input.budget_min),budget_max=amount(input.budget_max);
 if(budget_min!==null&&budget_max!==null&&budget_max<budget_min)throw new Error('Budget maximum must be at least the minimum');
 const currency=plain(input.currency||'EUR',3).toUpperCase();if(!/^[A-Z]{3}$/.test(currency))throw new Error('Use a three-letter currency');
 const evidence:Record<string,unknown>={};for(const key of ['account_created_at','karma','followers','past_hires','payment_verified','business_url','linkedin_url','responded_in_thread','copy_paste_spam','origin_platform','hourly']){const v=input.evidence?.[key];if(['string','number','boolean'].includes(typeof v))evidence[key]=typeof v==='string'?plain(v,500):v;}
 return {evidence,id:input.id!,source:input.source!,name,contact,need,budget_min,budget_max,currency,urgency:input.urgency!,warm:input.warm===true||input.source==='warm',next_action:plain(input.next_action||'Review and open a draft',300),status:input.status!,offer:null,url:validHttps(input.url),snippet:plain(input.snippet,1400),score:Math.max(0,Math.min(100,Number(input.score)||0)),posted_at:input.posted_at&&Number.isFinite(Date.parse(input.posted_at))?new Date(input.posted_at).toISOString():null,first_seen_at:input.first_seen_at&&Number.isFinite(Date.parse(input.first_seen_at))?input.first_seen_at:now,expires_at:input.expires_at&&Number.isFinite(Date.parse(input.expires_at))?input.expires_at:undefined,updated_at:now,revision:Number.isInteger(input.revision)?input.revision:0,contact_kind:plain(input.contact_kind,20),handle:plain(input.handle,80),reasons:(input.reasons||[]).slice(0,5).map(x=>({label:plain(x.label,40),points:Number(x.points)||0})),note:plain(input.note,300),city:plain(input.city,80)};
}
export function group(lead:Lead):number {
 if(lead.warm)return 0;
 if(lead.source==='places')return 4;
 const urgent=lead.urgency==='urgent'||lead.urgency==='this_week';
 return urgent&&((lead.budget_max??lead.budget_min??0)>0)?1:urgent?2:3;
}
export function rank(leads:Lead[]):Lead[] {
 return [...leads].sort((a,b)=>group(a)-group(b)||(group(a)===1?(a.currency.localeCompare(b.currency)||(b.budget_max??b.budget_min??0)-(a.budget_max??a.budget_min??0)):0)||(b.score||0)-(a.score||0)||(Date.parse(b.posted_at||'')||0)-(Date.parse(a.posted_at||'')||0)||a.id.localeCompare(b.id));
}
export function makeOffer(lead:Lead,tiers:Tier[],payLink=''):Offer {
 const need=lead.need.toLowerCase();
 const target=/\b(app|platform|full custom|marketplace|saas)\b/.test(need)?4:/\b(shop|store|ecommerce|e-commerce|cms|custom design)\b/.test(need)?3:/\b(5 pages|multi.page|business website|company website)\b/.test(need)?2:/\b(fix|bug|section|broken|repair)\b/.test(need)?0:1;
 const budget=lead.currency==='EUR'?(lead.budget_max??lead.budget_min):null;
 let index=target;
 while(index>0&&budget!==null&&budget<tiers[index].min)index--;
 const tier=tiers[index];const price=budget===null?tier.price:Math.max(tier.min,Math.min(tier.price,budget,tier.max));
 const note=index<target?'This budget fits a smaller scope; the extra functionality is not included.':budget!==null&&budget<tier.min?'This offer is above the stated budget.':lead.currency!=='EUR'&&lead.budget_max!==null?'Quote is in EUR; no exchange-rate assumption was made.':'';
 const pay=validHttps(payLink)||'{REVOLUT_LINK}';const upfront=Math.round(price*tier.upfront_percent)/100;
 const payment=tier.upfront_percent?`50% upfront (€${upfront}), balance on approval.`:'Pay only when you are happy.';
 const text=`Hey ${lead.name}, here is one concrete option for ${lead.need}: ${tier.name} — €${price} fixed. ${tier.scope}. Delivery: ${tier.delivery}${index<4?', after we agree the scope and I have your content':''}. ${payment} Payment: ${pay}.${note?' '+note:''}`;
 return {tier:tier.id,title:tier.name,scope:tier.scope,price,currency:'EUR',delivery:tier.delivery,upfront_percent:tier.upfront_percent,upfront_amount:upfront,pay_link:validHttps(payLink),text,note};
}
export function canStartBuild(lead:Lead):boolean {return lead.status==='call';}
export function draftLink(contact:string,kind:string,body:string,subject='Your website — a concrete offer'):string {
 const e=encodeURIComponent;
 if(kind==='reddit'&&/^[\w-]{3,30}$/.test(contact))return `https://www.reddit.com/message/compose?to=${e(contact)}&subject=${e(subject)}&message=${e(body)}`;
 if(kind==='x'&&/^\d+$/.test(contact))return `https://x.com/messages/compose?recipient_id=${contact}&text=${e(body)}`;
 if(/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(contact))return `mailto:${e(contact)}?subject=${e(subject)}&body=${e(body)}`;
 if(/^\+?[1-9]\d{6,14}$/.test(contact))return `https://wa.me/${contact.replace('+','')}?text=${e(body)}`;
 try {const u=new URL(contact);if(['wa.me','www.wa.me'].includes(u.hostname)&&/^\/\d{7,15}$/.test(u.pathname))return `https://wa.me${u.pathname}?text=${e(body)}`;if(['x.com','twitter.com','www.x.com'].includes(u.hostname)&&/^\/[\w]{1,15}\/?$/.test(u.pathname))return `https://x.com/intent/post?text=${e('@'+u.pathname.split('/')[1]+' '+body)}`;}catch{}
 return '';
}
