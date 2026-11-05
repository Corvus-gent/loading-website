import {REAL} from './_posthog.js';
import {campaignSlug,contentSlot} from '../js/x-attribution.js';
export const dayAt=(at=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(new Date(at));
const text=p=>(p?.rich_text||p?.title||[]).map(x=>x.plain_text??x.text?.content??'').join('');
const label=p=>String(p?.select?.name||'').slice(0,80);
const url=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
export function ownPostURL(value){try{const u=new URL(value);return u.protocol==='https:'&&['x.com','www.x.com','twitter.com','www.twitter.com'].includes(u.hostname)&&/^\/gabe_maxxing\/status\/\d+\/?$/i.test(u.pathname)&&!u.username&&!u.password?`https://x.com${u.pathname.replace(/\/$/,'')}`:'';}catch{return '';}}
export function rowFromPage(page){
 const p=page.properties||{},date=p.date?.date?.start?.slice(0,10)||'',hour=p.hour?.number,region=label(p.region),type=label(p.type),campaign=text(p.campaign).trim().slice(0,200),campaign_key=campaignSlug(campaign);
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isInteger(hour)&&hour>=0&&hour<24&&['eu','sf'].includes(region)&&['reply','post'].includes(type);
 return {id:page.id,date,hour,region,type,voice:label(p.voice)||'unlabelled',lane:label(p.lane),campaign,campaign_key,target_url:url(p.target_url?.url),my_url:url(p.my_url?.url),text:text(p.text).slice(0,20000),link:url(p.link?.url),link_type:label(p.link_type),valid,
  saved:{clicks:p.clicks?.number??null,clicks_pidgy:p.clicks_pidgy?.number??null,estimated:p.clicks_estimated?.checkbox??null,synced_at:p.synced_at?.date?.start||null}};
}
const key=(date,campaign,slot)=>`${date}|${campaign}|${slot}`;
const linked=r=>['corvus','pidgy'].includes(r.link_type)&&!!r.link;
const empty=()=>({replies:0,posts:0,links:0,clicks:0,clicksPidgy:0,ctr:null});
const round=n=>Math.round(n*1000000)/1000000;
function counts(target,r){target[r.type==='reply'?'replies':'posts']++;if(linked(r))target.links++;target.clicks+=r.clicks;target.clicksPidgy+=r.clicks_pidgy;}
function finish(item){item.clicks=round(item.clicks);item.clicksPidgy=round(item.clicksPidgy);item.ctr=item.links?(item.clicks+item.clicksPidgy)/item.links:null;return item;}
export function aggregate(rows,clickRows,now=new Date()){
 rows=[...new Map(rows.map(row=>[row.id,row])).values()];
 const updated=new Date(now).toISOString(),today=dayAt(now),start=new Date(`${today}T12:00:00Z`);start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));const weekStart=start.toISOString().slice(0,10);
 const groups=new Map(),campaigns=new Set(),voices=new Map(),regions=new Map(['eu','sf'].map(name=>[name,{name,...empty()}])),tops=new Map(),week=new Map(),hours=Array.from({length:24},(_,hour)=>({hour,...empty()}));
 const valid=rows.filter(r=>r.valid);
 for(const r of rows){r.clicks=0;r.clicks_pidgy=0;r.estimated=false;if(!r.valid)continue;if(r.campaign_key)campaigns.add(r.campaign_key);if(linked(r)&&r.campaign_key){const k=key(r.date,r.campaign_key,`${r.region}-${r.hour}`);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}}
 const all=empty(),daily=empty();let unmatched=0;
 for(const [date,rawCampaign,rawContent,destination,rawCount]of clickRows){
  const campaign=campaignSlug(rawCampaign),slot=contentSlot(rawContent),n=Number(rawCount);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!campaign||!['corvus','pidgy'].includes(destination)||!Number.isSafeInteger(n)||n<0)continue;
  const field=destination==='pidgy'?'clicksPidgy':'clicks';all[field]+=n;if(date===today)daily[field]+=n;
  if(campaigns.has(campaign)){if(!tops.has(campaign))tops.set(campaign,{campaign,clicks:0,clicksPidgy:0});tops.get(campaign)[field]+=n;}
  const matches=groups.get(key(date,campaign,slot))||[];
  if(!matches.length){unmatched+=n;continue;}
  for(const r of matches){r[destination==='pidgy'?'clicks_pidgy':'clicks']+=n/matches.length;r.estimated=matches.length>1;}
 }
 for(const r of valid){
  const field=r.type==='reply'?'replies':'posts';all[field]++;if(linked(r))all.links++;if(r.date===today){daily[field]++;if(linked(r))daily.links++;}
  if(!voices.has(r.voice))voices.set(r.voice,{name:r.voice,...empty()});counts(voices.get(r.voice),r);counts(regions.get(r.region),r);counts(hours[r.hour],r);
  if(r.date>=weekStart&&r.date<=today){if(!week.has(r.voice))week.set(r.voice,{name:r.voice,...empty()});counts(week.get(r.voice),r);}
 }
 const rankedWeek=[...week.values()].map(finish).filter(r=>r.clicks+r.clicksPidgy>0).sort((a,b)=>(b.clicks+b.clicksPidgy)-(a.clicks+a.clicksPidgy)||a.name.localeCompare(b.name));
 const posts=valid.filter(r=>r.type==='post'&&ownPostURL(r.my_url)).sort((a,b)=>b.date.localeCompare(a.date)||b.hour-a.hour||a.id.localeCompare(b.id));
 const pub={ready:true,updated,timezone:'Europe/Brussels',today:finish(daily),all:finish(all),voices:[...voices.values()].map(finish).sort((a,b)=>(b.clicks+b.clicksPidgy)-(a.clicks+a.clicksPidgy)||a.name.localeCompare(b.name)),bestVoice:rankedWeek[0]||null,weekStart,regions:[...regions.values()].map(finish),hours:hours.map(finish),campaigns:[...tops.values()].sort((a,b)=>(b.clicks+b.clicksPidgy)-(a.clicks+a.clicksPidgy)||a.campaign.localeCompare(b.campaign)).slice(0,5),posts:posts.slice(0,50).map(r=>({date:r.date,hour:r.hour,text:r.text,url:ownPostURL(r.my_url),clicks:round(r.clicks),clicksPidgy:round(r.clicks_pidgy),estimated:r.estimated})),postCount:posts.length,unmatchedClicks:unmatched,invalidRows:rows.length-valid.length,estimatedRows:rows.filter(r=>r.estimated).length};
 return {public:pub,rows,campaigns:[...campaigns].sort()};
}
export function clickQuery(cutoff,offset=0){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(cutoff)||!Number.isSafeInteger(offset)||offset<0)throw Error('invalid query bounds');
 // Count one signal per action: hub/direct landing pageviews OR outbound Pidgy
 // events. Never add generic link_click/outbound_click or /go pageviews again.
 return `WITH
 coalesce(nullIf(toString(properties.utm_source),''),nullIf(toString(properties.links_source),''),nullIf(toString(properties.source),''),extractURLParameter(toString(properties.$current_url),'utm_source')) AS source,
 replaceRegexpOne(coalesce(nullIf(toString(properties.utm_campaign),''),nullIf(toString(properties.links_campaign),''),nullIf(toString(properties.campaign),''),extractURLParameter(toString(properties.$current_url),'utm_campaign')),'^gabe-','') AS campaign,
 coalesce(nullIf(toString(properties.utm_content),''),extractURLParameter(toString(properties.$current_url),'utm_content')) AS content,
 if(event IN ('links_click','short_link_out'),'pidgy','corvus') AS destination
 SELECT toString(toDate(toTimeZone(timestamp,'Europe/Brussels'))),campaign,content,destination,count()
 FROM events WHERE ${REAL} AND timestamp <= toDateTime('${cutoff.replace('T',' ').slice(0,19)}')
 AND source='x' AND campaign!=''
 AND coalesce(toString(properties.links_person),'') NOT IN ('corvus','pidgy')
 AND NOT (coalesce(toString(properties.utm_medium),'')='links' AND match(coalesce(toString(properties.utm_campaign),''),'^(corvus|pidgy)-')) AND (
  (event='$pageview' AND toString(properties.$pathname) NOT LIKE '/go%' AND (properties.links_source='x' OR coalesce(toString(properties.utm_medium),'')!='links'))
  OR (event='links_click' AND properties.link IN ('pidgy','pidgy-trial'))
  OR (event='short_link_out' AND properties.target='pidgy'))
 GROUP BY 1,2,3,4 ORDER BY 1,2,3,4 LIMIT 1000 OFFSET ${offset}`;
}
