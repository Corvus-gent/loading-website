import { catalog, cities } from './engine/index.js';
import { marketSnapshot } from './market.js';

const feeds=[
  ['TechCrunch','North America','https://techcrunch.com/category/startups/feed/'],
  ['Sifted','Europe','https://sifted.eu/feed'],
  ['LatAm List','Latin America','https://latamlist.com/feed/'],
  ['Disrupt Africa','Africa','https://disrupt-africa.com/feed/'],
  ['Wamda','Middle East','https://www.wamda.com/feed'],
  ['TechNode','East Asia','https://technode.com/feed/'],
  ['Inc42','South Asia','https://inc42.com/feed/'],
  ['e27','Southeast Asia','https://e27.co/feed/'],
  ['Startup Daily','Australia','https://www.startupdaily.net/feed/'],
];
const themes=[
  ['Funding',/\brais(?:e|es|ed|ing)\b|series [a-f]\b|\bseed round\b|financing/i],
  ['Partnerships & expansion',/partner|expan[ds]|market entry|international launch/i],
  ['Acquisitions',/acqui(?:re|res|red|sition)|merger|\bbuyout\b/i],
  ['AI & automation',/\bAI\b|machine learning|automation|robot/i],
  ['Public markets',/\bIPO\b|\bNasdaq\b|\bNYSE\b|public offering/i],
];
const decode=value=>value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
  .replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi,entity=>{
    const key=entity.slice(1,-1).toLowerCase();
    const scalar=key.startsWith('#x')?parseInt(key.slice(2),16):Number(key.slice(1));
    return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[key] ?? (scalar>0&&scalar<=0x10ffff?String.fromCodePoint(scalar):entity);
  }).trim();
const field=(item,tag)=>decode(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i').exec(item)?.[1] || '');
const safeLink=value=>{try { const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
const generic=new Set(['artificial intelligence','almost','beyond','bring','circular','culture','current','first','global','impact','horizon','journey','linear','market','motion','notion','open','origin','partner','people','product','rocket','shift','source','spark','story','studio','supply','united']);
const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const companyNames=catalog.flatMap(item=>{
  const name=normalize(item.name);
  return name.length>=5&&!generic.has(name)?[{item,name:' '+name+' '}]:[];
}).sort((a,b)=>b.name.length-a.name.length);

async function readFeed([publisher,region,url]) {
  const response=await fetch(url,{signal:AbortSignal.timeout(4500),headers:{Accept:'application/rss+xml, application/xml, text/xml','User-Agent':'OpenRisk/1.0 (corvus.gent)'}});
  if (!response.ok) throw Error('Feed unavailable');
  const xml=await response.text();
  if (!/<rss\b/i.test(xml) || xml.length>2_000_000) throw Error('Unexpected feed');
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,30).flatMap(([,entry])=>{
    const title=field(entry,'title'),link=safeLink(field(entry,'link')),at=Date.parse(field(entry,'pubDate'));
    return title && link && Number.isFinite(at) ? [{title,link,at,publisher,region}] : [];
  });
}

let cached,pending;
export async function dailyRadar() {
  if (cached && Date.now()-Date.parse(cached.asOf)<600_000) return cached;
  pending ??= buildRadar().then(result=>(cached=result)).finally(()=>{ pending=null; });
  return pending;
}

async function buildRadar() {
  const [reports,market]=await Promise.all([Promise.allSettled(feeds.map(readFeed)),marketSnapshot().catch(()=>null)]);
  const now=Date.now(), cutoff=now-72*3600000;
  const curated=catalog.flatMap(item=>{
    const source=item.signals.corporateEvent;
    return source?[{title:item.name+' · '+source.value.label,link:safeLink(source.source),at:Date.parse(source.value.date),
      publisher:'Company announcement',region:cities.find(city=>city.name===item.city)?.country,id:item.id,verified:true}]:[];
  });
  const seen=new Set(), headlines=[...curated,...reports.flatMap(row=>row.value || [])]
    .filter(row=>row.link && row.at>=cutoff && row.at<=now && !seen.has(row.link) && seen.add(row.link))
    .sort((a,b)=>b.at-a.at);
  const highlights=new Map();
  for (const article of headlines) {
    const normalized=' '+normalize(article.title)+' ';
    const match=article.id?{item:catalog.find(item=>item.id===article.id)}:companyNames.find(candidate=>normalized.includes(candidate.name));
    if (!match || highlights.has(match.item.id)) continue;
    const category=match.item.sector;
    const quote=market?.quotes.find(row=>row.niche===category)
      || (/cybersecurity|enterprise ai|artificial intelligence|developer tools/i.test(category)
        ? market?.quotes.find(row=>row.ticker==='XLK') : null);
    highlights.set(match.item.id,{...article,id:match.item.id,name:match.item.name,city:match.item.city,
      theme:themes.find(([,rule])=>rule.test(article.title))?.[0] || 'Company news',
      market:quote?{ticker:quote.ticker,change:quote.change,sector:quote.sector,asOf:quote.asOf}:null});
  }
  const trends=themes.map(([label,rule])=>{
    const articles=headlines.filter(article=>rule.test(article.title));
    return {label,count:new Set(articles.map(article=>normalize(article.title))).size,
      sources:new Set(articles.map(article=>article.publisher)).size};
  }).filter(topic=>topic.sources>=2).sort((a,b)=>b.count-a.count).slice(0,4);
  const leading=new Set(market?.quotes.slice(0,3).map(quote=>quote.ticker) || []);
  const picks=[...highlights.values()].map(item=>({...item,leadingSector:leading.has(item.market?.ticker)}))
    .sort((a,b)=>Number(Boolean(b.verified))-Number(Boolean(a.verified))
      || Number(b.leadingSector)-Number(a.leadingSector) || b.at-a.at).slice(0,6);
  const coveredRegions=new Set();
  const regional=headlines.filter(article=>{
    if (article.verified || coveredRegions.has(article.region)) return false;
    coveredRegions.add(article.region);
    return true;
  });
  return {asOf:new Date(now).toISOString(),windowHours:72,highlights:picks,trends,regional,
    feedCount:reports.filter(row=>row.status==='fulfilled').length,feedTotal:feeds.length};
}
