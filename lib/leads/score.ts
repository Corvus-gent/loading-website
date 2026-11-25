import {type Lead,type Tier} from './schema.js';
export const SCORE_VERSION=1 as const;
export interface Evidence {account_created_at?:string;karma?:number;followers?:number;past_hires?:number;payment_verified?:boolean;business_url?:string;linkedin_url?:string;responded_in_thread?:boolean;copy_paste_spam?:boolean;origin_platform?:string;hourly?:boolean;}
export interface Fx {date:string;eur_per_unit:Record<string,number>;}
export interface Flag {id:string;label:string;penalty:number;critical:boolean;}
export interface Assessment {version:number;score:number;breakdown:{pay:number;urgency:number;trust:number;fit:number;reachability:number;penalties:number};red_flags:Flag[];budget_eur:{min:number;max:number;mid:number}|null;budget_basis:string;close_probability:number;expected_value:number|null;why:string;suggested_tier:string;missing:string[];fx_date:string|null;}
const bound=(n:number,max:number)=>Math.max(0,Math.min(max,Math.round(n)));
export function suggestedTier(need:string):string {return /\b(app|platform|full custom|marketplace|saas)\b/i.test(need)?'premium':/\b(shop|store|ecommerce|e-commerce|cms|custom design)\b/i.test(need)?'pro':/\b(5 pages|multi.page|business website|company website)\b/i.test(need)?'business':/\b(fix|bug|section|broken|repair)\b/i.test(need)?'quick_fix':'landing';}
const HOURS:Record<string,number>={quick_fix:2,landing:8,business:24,pro:64,premium:120};
export function parseBudget(text:string):{budget_min:number|null;budget_max:number|null;currency:string;hourly:boolean} {
 const hourly=/(?:\/\s*(?:h|hr|hour)\b|per hour|hourly)/i.test(text);
 if(/\b(no budget|unpaid|equity only|exposure only)\b/i.test(text))return {budget_min:null,budget_max:null,currency:'EUR',hourly};
 const match=text.match(/([$€£]|EUR|USD|GBP)\s*(\d+(?:[.,]\d+)*\s*[kK]?)(?:\s*[-–]\s*(?:[$€£]|EUR|USD|GBP)?\s*(\d+(?:[.,]\d+)*\s*[kK]?))?/i)||text.match(/\b(\d+(?:[.,]\d+)*\s*[kK]?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)*\s*[kK]?))?\s*(EUR|USD|GBP|euros?|dollars?|pounds?)\b/i);
 if(!match)return {budget_min:null,budget_max:null,currency:'EUR',hourly};
 const prefix=/^[$€£]|^(EUR|USD|GBP)$/i.test(match[1]);const token=prefix?match[1]:match[3];const currency=/€|eur/i.test(token)?'EUR':/£|gbp|pound/i.test(token)?'GBP':'USD';
 const parse=(s:string)=>{let n=s.trim().toLowerCase().replace(/\s/g,'');const k=n.endsWith('k');n=n.replace(/k$/,'');n=n.replace(/([.,])(?=\d{3}(?:\D|$))/g,'').replace(',','.');return Number(n)*(k?1000:1);};
 const a=parse(prefix?match[2]:match[1]),b=parse((prefix?match[3]:match[2])||(prefix?match[2]:match[1]));
 if(!Number.isFinite(a)||!Number.isFinite(b))return {budget_min:null,budget_max:null,currency,hourly};
 return {budget_min:Math.min(a,b),budget_max:Math.max(a,b),currency,hourly};
}
export function assess(lead:Lead,tiers:Tier[],fx?:Fx,now=Date.now()):Assessment {
 const text=`${lead.need} ${lead.snippet||''}`,e=(lead.evidence||{}) as Evidence,tier=suggestedTier(lead.need),minScope=tiers.find(x=>x.id===tier)?.min||300,flags:Flag[]=[],missing:string[]=[];
 const flag=(id:string,label:string,penalty:number,critical=false)=>flags.push({id,label,penalty,critical});
 if(/\b(?:work for |paid in |great |for )exposure\b|\bexposure only\b/i.test(text))flag('exposure','Exposure instead of pay',30);
 if(/\bequity[ -]only\b|\b(?:paid in|payment in) equity\b/i.test(text))flag('equity','Equity-only offer',40,true);
 if(/\bfree (?:sample|test|trial)|\bunpaid (?:sample|test|trial)|\b(?:sample|test) (?:first|before (?:pay|payment))\b/i.test(text))flag('free_test','Free test requested',30);
 if(/\b(?:crypto|bitcoin|btc|usdt)[ -]only\b|\bonly (?:pay(?:ing)? (?:in |with )?)?(?:crypto|bitcoin|btc|usdt)\b/i.test(text))flag('crypto_only','Crypto-only payment',35);
 if(/\bgift[ -]?cards?\b/i.test(text))flag('gift_card','Gift-card payment',50,true);
 if((e.origin_platform==='fiverr'||/fiverr\.com/i.test(lead.url||'')||/\bfiverr\b/i.test(text))&&/\b(?:off[ -]platform|outside fiverr|avoid (?:the )?fees|pay (?:me )?direct|move to (?:telegram|whatsapp))\b/i.test(text))flag('off_platform','Fiverr off-platform request',45,true);
 if(/\b(?:clone|copy|replica)\s+(?:of\s+)?(?:the\s+)?(?:paypal|stripe|binance|coinbase|revolut|amazon|apple|google|facebook|instagram|netflix)\b/i.test(text))flag('brand_clone','Big-brand clone / impersonation risk',50,true);
 if(e.copy_paste_spam)flag('spam','Repeated copy-paste spam',35);
 if(!lead.warm&&text.trim().split(/\s+/).length<9)flag('vague','Too little detail',8);
 const accountAge=e.account_created_at?(now-Date.parse(e.account_created_at))/86400000:null;
 if(accountAge!==null&&Number.isFinite(accountAge)&&accountAge>=0&&accountAge<7)flag('fresh_account','Account under 7 days old',12);
 if(!lead.warm&&/throwaway|tempaccount|burneraccount/i.test(lead.handle||''))flag('throwaway','Throwaway handle',10);
 const currency=lead.currency.toUpperCase(),rawMin=lead.budget_min??lead.budget_max,rawMax=lead.budget_max??lead.budget_min;
 const rate=currency==='EUR'?1:fx&&now-Date.parse(fx.date)<7*86400000&&Date.parse(fx.date)<=now?fx.eur_per_unit[currency]:undefined;
 const hourly=e.hourly||/(?:\/\s*(?:h|hr|hour)\b|per hour|hourly)/i.test(text),hours=hourly?HOURS[tier]:1;
 const budget=rawMin!==null&&rawMax!==null&&rate&&rate>0?{min:Math.round(rawMin*rate*hours),max:Math.round(rawMax*rate*hours),mid:Math.round((rawMin+rawMax)/2*rate*hours)}:null;
 if(rawMin===null)missing.push('stated budget');else if(!rate)missing.push(`fresh ${currency}→EUR rate`);
 if(accountAge===null)missing.push('account age');if(e.karma===undefined&&e.followers===undefined)missing.push('karma/followers');if(e.past_hires===undefined)missing.push('past hires');
 let pay=budget&&budget.mid>0?Math.min(20,4+4*Math.log10(budget.mid+1))+Math.min(10,10*budget.mid/minScope):0;if(hourly)pay-=2;
 let urgency=lead.urgency==='urgent'||/\b(asap|today|urgent|immediately|now)\b/i.test(text)?10:lead.urgency==='this_week'||/\b(this week|tomorrow|deadline|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.test(text)?7:0;
 if(/already late|behind schedule|missed (?:the )?deadline|overdue/i.test(text))urgency+=5;
 const age=lead.posted_at?now-Date.parse(lead.posted_at):NaN;if(age>=0&&age<7200000)urgency+=10;else if(age>=0&&age<86400000)urgency+=6;else if(age>=0&&age<259200000)urgency+=2;
 let trust=4;if(accountAge!==null&&Number.isFinite(accountAge))trust+=accountAge>=365?6:accountAge>=30?4:accountAge>=7?1:0;
 if((e.karma??e.followers??0)>=1000)trust+=4;else if((e.karma??e.followers??0)>=100)trust+=2;
 if((e.past_hires||0)>0)trust+=5;if(e.payment_verified||(/\bpayment verified\b/i.test(text)&&! /\b(?:not|no) payment verified\b/i.test(text)))trust+=5;
 if(validBusiness(e.business_url))trust+=4;if(/^https:\/\/(?:www\.)?linkedin\.com\//i.test(e.linkedin_url||''))trust+=3;
 const fit=/\b(website|landing|web |page|shop|store|cms|app|saas|platform|seo|fix|section)\b/i.test(text)?10:3;
 const reachable=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact)||/^\+?[1-9]\d{6,14}$/.test(lead.contact)||/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com|reddit\.com|instagram\.com|linkedin\.com|wa\.me)\//.test(lead.contact)||(['reddit','x'].includes(lead.contact_kind||'')&&Boolean(lead.contact));
 const reach=(reachable?8:0)+(e.responded_in_thread?2:0),penalties=flags.reduce((n,x)=>n+x.penalty,0);
 const breakdown={pay:bound(pay,30),urgency:bound(urgency,25),trust:bound(trust,25),fit:bound(fit,10),reachability:bound(reach,10),penalties};
 const score=bound(breakdown.pay+breakdown.urgency+breakdown.trust+breakdown.fit+breakdown.reachability-penalties,100);
 const rawClose=.04+.20*breakdown.urgency/25+.26*breakdown.trust/25+(lead.warm?.30:0);
 const close=flags.some(x=>x.critical)?0:Math.max(0,Math.min(.85,rawClose*Math.max(.02,1-penalties/60)));
 const probability=Math.round(close*1000)/1000,expected=budget?Math.round(budget.mid*probability*100)/100:null;
 const why=`${lead.warm?'Warm relationship. ':''}${budget?`€${budget.mid} ${hourly?'estimated project':'mid-budget'}. `:'Ask for the budget. '}${breakdown.urgency>=16?'Fresh, urgent request. ':''}${flags.length?flags.map(x=>x.label).slice(0,2).join('; ')+'.':'No flagged wording; trust signals still need human review.'}`;
 return {version:SCORE_VERSION,score,breakdown,red_flags:flags,budget_eur:budget,budget_basis:hourly?`Hourly rate × ${hours} estimated hours (${tier}); confirm scope`:'Stated project budget',close_probability:probability,expected_value:expected,why,suggested_tier:tier,missing,fx_date:currency==='EUR'?null:fx?.date||null};
}
function validBusiness(url?:string){try{return new URL(url||'').protocol==='https:';}catch{return false;}}
export function rankByValue<T extends {id:string;assessment:Assessment}>(leads:T[]):T[]{return [...leads].sort((a,b)=>(b.assessment.expected_value??-1)-(a.assessment.expected_value??-1)||b.assessment.breakdown.urgency-a.assessment.breakdown.urgency||a.id.localeCompare(b.id));}
