import { signal } from './enrich.js';

const host = 'https://startupmap.one';
const headers = { 'User-Agent':'OpenRiskPrototype/1.0 (https://corvus.gent/project-cto; contact: gabriel@corvus.gent)', Accept:'text/html,text/plain' };
const slug = value => value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

async function text(path,timeout=3800) {
  if (!/^\/(?:robots\.txt|map\/[a-z0-9-]+|startup\/[a-z0-9_-]+)$/i.test(path)) throw Error('Unrecognized directory path');
  const response = await fetch(host+path,{ headers, redirect:'error',signal:AbortSignal.timeout(timeout) });
  if (!response.ok) throw Error('Directory unavailable');
  const raw = await response.text();
  if (raw.length>1_200_000) throw Error('Directory response too large');
  return raw;
}

let policy;
async function startupMap(path) {
  if (!policy || policy.expires<Date.now()) {
    policy = { expires:Date.now()+3_600_000, rules:text('/robots.txt').catch(()=>null) };
  }
  const rules = await policy.rules;
  // The publisher's policy explicitly invites crawling and citation of public pages.
  if (!rules || !/^Allow:\s*\/\s*$/mi.test(rules) || rules.split(/\r?\n/).some(line=>{
    const blocked=/^\s*Disallow:\s*(\/[^\s#]*)/i.exec(line)?.[1];
    return blocked && path.startsWith(blocked.split('*')[0]);
  })) throw Error('Directory robots policy prevents this request');
  return text(path);
}

function structured(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(([,body])=>{
    try {
      const data=JSON.parse(body);
      return data['@graph'] || [data];
    } catch { return []; }
  });
}

export async function directoryCity(name, count=25) {
  const key = {Gent:'ghent'}[name] || slug(name);
  if (!key) return [];
  const path='/map/'+key;
  const html=await startupMap(path);
  const entries=structured(html).find(entity=>entity['@type']==='ItemList')?.itemListElement;
  if (!Array.isArray(entries)) return [];
  const asOf=new Date().toISOString();
  return entries.slice(0,count).flatMap(row=>{
    const id=typeof row.name==='string' ? slug(row.name) : '';
    if (!id || typeof row.url!=='string' || !/^https:\/\/startupmap\.one\/startup\/[a-z0-9_-]+$/i.test(row.url)) return [];
    return [{id, name:row.name, city:name, sector:'Unclassified', domain:'', source:row.url, directory:'StartupMap', directoryUrl:host+path, asOf,
      description:'Listed in StartupMap’s '+name+' ecosystem directory.', signals:{} }];
  });
}

export async function directoryDetail(company) {
  const html=await startupMap(new URL(company.source).pathname);
  const entry=structured(html).find(entity=>entity['@type']==='Organization' && entity.name?.toLowerCase()===company.name.toLowerCase());
  if (!entry) return company;
  const asOf=new Date().toISOString();
  let domain='';
  try {
    const url=new URL(entry.url);
    if (url.protocol==='https:' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) domain=url.hostname;
  } catch {}
  const [sector='',stage='']=typeof entry.keywords==='string' ? entry.keywords.split(', ') : [];
  const year=Number(entry.foundingDate);
  const employees=entry.numberOfEmployees;
  const evidence = (value, confidence='medium') => signal(value,company.source,'scraped',confidence,asOf);
  const signals = {};
  if (/^\d{4}$/.test(entry.foundingDate||'') && year>=1900 && year<=new Date().getUTCFullYear()) signals.founded=evidence(year);
  if (stage && stage!=='Unknown') signals.stage=evidence(stage);
  if (Number.isInteger(employees?.minValue) && Number.isInteger(employees?.maxValue) && employees.maxValue>=employees.minValue) {
    signals.headcount=evidence({min:employees.minValue,max:employees.maxValue},'low');
  }
  if (domain) signals.website=evidence('https://'+domain);
  return {...company,domain,sector:sector||company.sector,asOf,signals};
}
