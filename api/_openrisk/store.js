import { createHash, randomBytes } from 'node:crypto';
import { connected, redis } from '../_redis.js';
import { catalog } from './engine/index.js';
import { locate } from './engine/cities.js';
import { metrics, extract, validPeriod } from './engine/metrics.js';

const sessions = new Map();
const retention = 7 * 86400;
const fresh = () => ({ followed:[], claims:{}, companies:{}, alerts:{}, requests:[], jobs:[], invites:[], stats:{ extracted:0, confirmed:0, unchanged:0 } });
const workspaceKey = id => 'openrisk:v1:' + id;
const CAS = "local prev=redis.call('GET',KEYS[1]) or ''; if prev~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1";
const load = async id => connected() ? (await redis(['GET', workspaceKey(id)])) ?? '' : sessions.get(id) || '';
export const getState = async id => JSON.parse((await load(id)) || 'null') || fresh();

export async function update(id, transform) {
  for (let n = 0; n < 5; n++) {
    const raw = await load(id);
    const data = JSON.parse(raw || 'null') || fresh();
    const result = transform(data);
    const next = JSON.stringify(data);
    if (!connected()) {
      if (sessions.size > 300 && !sessions.has(id)) sessions.delete(sessions.keys().next().value);
      if ((sessions.get(id) || '') !== raw) continue;
      sessions.set(id, next);
      return result;
    }
    if (await redis(['EVAL',CAS,'1',workspaceKey(id),raw,next,String(retention)])) return result;
  }
  throw new Problem(409,'The workspace changed. Retry this action.');
}

export class Problem extends Error {
  constructor(status,message) { super(message); this.status = status; }
}

const fail = (status,message) => { throw new Problem(status,message); };
const txt = (v,n) => typeof v === 'string' ? v.trim().slice(0,n) : '';
const findCompany = (state,id) => catalog.find(row=>row.id===id) || state.requests.find(row=>row.company?.id===id)?.company || state.jobs.flatMap(row=>row.details||[]).find(row=>row.id===id);
const requireCompany = (state,id) => findCompany(state,id) || fail(404,'Company not found.');
const requireClaim = (state,id) => Object.hasOwn(state.claims,id) || fail(403,'Claim this profile first.');
const needRole = (role,allowed) => allowed.includes(role) || fail(403,'This role cannot change these records.');
const isObject = v => v && typeof v === 'object' && !Array.isArray(v);
const sortedValues = data => Object.values(data?.values || {}).sort((a,b)=>a.period.localeCompare(b.period));
const audit = (company, change) => {
  company.audit.push({ ...change, at:new Date().toISOString() });
  if (company.audit.length>240) company.audit.shift();
};
const publicValues = data => sortedValues(data).map(({evidence,...rest})=>rest);

export function project(state, role) {
  const companies = {};
  for (const [id, data] of Object.entries(state.companies)) {
    if (role === 'Admin' || (role === 'Investor' && !state.followed.includes(id))) continue;
    companies[id] = {
      values:role==='Founder'?sortedValues(data):publicValues(data), updates:data.updates, definitions:data.definitions, audit:data.audit.slice(-70),
      ...(role === 'Founder' ? { proposals:data.proposals, views:data.views } : {}),
    };
  }
  return {
    followed:state.followed, claims:Object.keys(state.claims), companies,
    alerts:role==='Investor' ? state.alerts : {},
    requests:role==='Admin' ? state.requests : [],
    approved:state.requests.filter(row=>row.company).map(row=>row.company),
    jobs:state.jobs,
    invites:role==='Founder' ? state.invites.map(({digest,...publicInvite})=>publicInvite) : [],
    stats:role==='Admin' ? state.stats : null,
  };
}

function companyData(state,id) {
  return state.companies[id] ??= { values:{}, updates:{}, definitions:{}, audit:[], proposals:[], views:[] };
}

function record(company, metric, period, value, currency, source, evidence, confidence, sample, sourceRef = null) {
  if (!validPeriod(period)) fail(400,'Enter a month in YYYY-MM format.');
  if (!Object.hasOwn(metrics,metric) && !Object.hasOwn(company.definitions,metric)) fail(400,'Unknown metric.');
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value)>1e12) fail(400,'Enter a valid metric value.');
  const definition = metrics[metric] || company.definitions[metric];
  if (definition.unit === 'count' && (!Number.isInteger(value) || value < 0)) fail(400,'Counts must be whole, non-negative numbers.');
  if (definition.unit === 'money' && !['EUR','USD','GBP'].includes(currency)) fail(400,'Select a currency.');
  currency = definition.unit === 'money' ? currency : null;
  const key = period + '/' + metric;
  const old = company.values[key];
  if (old?.value === value && old.currency === currency && old.sample === sample) return;
  const next = { metric,period,value,currency, status:'founder-confirmed', source, sourceRef, confidence, evidence, sample, fetchedAt:new Date().toISOString() };
  company.values[key] = next;
  audit(company,{ metric, period, old:old?.value ?? null, oldCurrency:old?.currency ?? null, value, currency, actor:'Demo founder', sample });
}

function runway(company,period) {
  const cash = company.values[period+'/cash'], burn = company.values[period+'/burn'];
  const old = company.values[period+'/runway'];
  if (old && old.source !== 'calculated') return;
  if (cash && burn && burn.value > 0 && cash.currency === burn.currency) {
    record(company,'runway',period,Math.round(cash.value/burn.value*10)/10,null,'calculated','Cash divided by monthly net burn.','high',cash.sample || burn.sample);
  } else if (old) {
    delete company.values[period+'/runway'];
    audit(company,{metric:'runway',period,old:old.value,value:null,currency:null,actor:'Demo founder',sample:old.sample});
  }
}

function cleanWebsite(value) {
  const str = txt(value,300);
  try {
    const url = new URL(str.includes('://') ? str : 'https://'+str);
    if (url.protocol === 'https:' && !url.username && !url.password && /^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]{1,}$/i.test(url.hostname)) return url.origin;
  } catch {}
  fail(400,'Enter a valid HTTPS company website.');
}

export const websiteHost = website => website ? new URL(website).hostname.replace(/^www\./,'') : '';
const normalizeName = name => name.normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
export function existingStartup(state,name,website,exclude) {
  const domain=websiteHost(website);
  const key=normalizeName(name);
  const profiles=[...catalog,...state.jobs.flatMap(row=>row.details||[])];
  return profiles.some(row=>domain ? row.domain?.replace(/^www\./,'')===domain : normalizeName(row.name)===key)
    || state.requests.some(row=>row.id!==exclude && (!exclude || row.status==='approved') && (domain && row.website
      ? websiteHost(row.website)===domain : key && normalizeName(row.name)===key));
}

export function apply(state, auth, body) {
  if (!isObject(body)) fail(400,'Invalid request.');
  const { action } = body;
  const id = txt(body.company,100);
  const period = body.period;
  if (action === 'follow' || action === 'view') {
    needRole(auth.role,['Investor']);
    requireCompany(state,id);
    if (action === 'follow') {
      if (body.enabled === false) state.followed = state.followed.filter(item=>item!==id);
      else if (!state.followed.includes(id) && state.followed.length < 100) state.followed.push(id);
    } else if (Object.hasOwn(state.claims,id)) {
      const views = companyData(state,id).views;
      if (Date.now() - Date.parse(views.at(-1)?.at || 0) > 45_000) {
        views.push({ at:new Date().toISOString(), label:'Demo investor', kind:'Profile view' });
        if (views.length>100) views.shift();
      }
    }
    return {};
  }
  if (action === 'alerts') {
    needRole(auth.role,['Investor']);
    if (!Number.isInteger(body.threshold) || body.threshold<1 || body.threshold>36) fail(400,'Choose a runway threshold from 1 to 36 months.');
    state.alerts = { threshold:body.threshold, monthly:Boolean(body.monthly) };
    return {};
  }
  if (action === 'claim') {
    needRole(auth.role,['Founder']);
    requireCompany(state,id);
    state.claims[id] ??= { at:new Date().toISOString(), membership:'founder' };
    companyData(state,id);
    return {};
  }
  if (action === 'submit') {
    const name=txt(body.name,80);
    const website=txt(body.website,300) ? cleanWebsite(body.website) : null;
    const city=txt(body.city,80);
    const place=city ? locate(city) : null;
    if (!website && !name) fail(400,'Enter a startup name or website.');
    if (name && !/^[\p{L}\p{N}][\p{L}\p{N} .&'’+_()-]{0,79}$/u.test(name)) fail(400,'Enter a valid startup name.');
    if (city && !place) fail(422,'City not found. Try the English name or include the country.');
    if (state.requests.length>=80) fail(409,'This demo queue is full.');
    if (existingStartup(state,name,website)) fail(409,'This startup already has a profile or suggestion.');
    state.requests.unshift({id:randomBytes(8).toString('hex'),name,website,city:place?.name || null,place,status:'pending',at:new Date().toISOString()});
    return {};
  }
  if (action === 'invite' || action === 'revoke') {
    needRole(auth.role,['Founder']);
    requireClaim(state,id);
    if (action === 'revoke') {
      const invite = state.invites.find(row=>row.id===body.invite && row.company===id);
      if (!invite) fail(404,'Invitation not found.');
      invite.status = 'revoked';
      return {};
    }
    const email = txt(body.email,180).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Enter a valid email.');
    if (state.invites.length>=80) fail(409,'The demo invite list is full.');
    const token = randomBytes(24).toString('base64url');
    const invite = { id:randomBytes(8).toString('hex'), company:id, email, digest:createHash('sha256').update(token).digest('hex'), expiresAt:new Date(Date.now()+retention*1000).toISOString(), status:'invited' };
    state.invites.push(invite);
    return { invitePath:'/project-cto/invite/'+auth.id+'/'+token };
  }
  if (['save','extract','review','define'].includes(action)) {
    needRole(auth.role,['Founder']);
    requireCompany(state,id);
    requireClaim(state,id);
    const c = companyData(state,id);
    if (action==='define') {
      const label = txt(body.label,48);
      const category = ['Financial','Sales','Commercial','Operational'].includes(body.category) ? body.category : 'Operational';
      const unit = ['count','money','months'].includes(body.unit) ? body.unit : 'count';
      const key = 'custom-' + label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if (key === 'custom-' || Object.keys(c.definitions).length >= 16) fail(400,'Enter a metric name. The demo supports up to 16 custom KPIs.');
      if (Object.hasOwn(c.definitions,key)) fail(409,'This KPI already exists.');
      c.definitions[key] = {label,category,unit};
      return {};
    }
    if (action==='save') {
      if (!validPeriod(period) || !isObject(body.values)) fail(400,'Select a month.');
      for (const [metric,value] of Object.entries(body.values)) record(c,metric,period,value,body.currency,'manual','','high',Boolean(body.sample));
      const note = txt(body.note,2000);
      if (body.note !== undefined && note !== (c.updates[period]?.note || '')) {
        if (note) c.updates[period] = {note,sample:Boolean(body.sample),at:new Date().toISOString()};
        else delete c.updates[period];
      }
      runway(c,period);
      return {};
    }
    if (action==='extract') {
      if (!validPeriod(period)) fail(400,'Pick a default period.');
      const mail = txt(body.text,16000);
      const raw = Array.isArray(body.attachments) ? body.attachments.slice(0,2) : [];
      const documents = raw.filter(isObject).map(item=>({
        source:'attachment', display:txt(item.name,120), text:txt(item.text,16000), sample:false,
      }));
      if (mail) documents.unshift({source:'email',display:'Investor update',text:mail,sample:Boolean(body.sample)});
      if (!documents.length) fail(400,'Paste an investor update or attach a document first.');
      const seen = new Set();
      const proposals = [];
      for (const doc of documents) {
        const reference = 'doc-' + randomBytes(6).toString('hex');
        for (const match of extract(doc.text,period)) {
          const key = match.period+'/'+match.metric;
          if (seen.has(key)) continue;
          seen.add(key);
          proposals.push({
            ...match,id:randomBytes(8).toString('hex'),reference,document:doc.display,source:doc.source,
            status:'proposed',fetchedAt:new Date().toISOString(),sample:doc.sample,duplicate:Object.hasOwn(c.values,key),
          });
        }
      }
      if (!proposals.length) fail(422,'No supported KPI sentences or rows were identified.');
      c.proposals = proposals.slice(0,20);
      state.stats.extracted+=documents.length;
      return {};
    }
    const instructions = Array.isArray(body.items) ? body.items.slice(0,20) : [];
    const affected = new Set();
    for (const choice of instructions) {
      const p = c.proposals.find(row=>row.id===choice.id && row.status==='proposed');
      if (!p) continue;
      if (choice.reject) { p.status = 'rejected'; continue; }
      const value = choice.value ?? p.value;
      const currency = choice.currency || p.currency || 'EUR';
      const resolvedPeriod = choice.period || p.period;
      record(c,p.metric,resolvedPeriod,value,currency,p.source||'email',p.evidence,p.confidence,p.sample,p.reference);
      affected.add(resolvedPeriod);
      state.stats.confirmed++;
      if (value===p.value && resolvedPeriod===p.period && (currency===p.currency || !p.currency)) state.stats.unchanged++;
      p.status = 'confirmed';
    }
    for (const month of affected) runway(c,month);
    return {};
  }
  fail(400,'Unknown action.');
}

export async function invitation(owner, token) {
  const digest = createHash('sha256').update(token).digest('hex');
  return update(owner, state => {
    const row = state.invites.find(item=>item.digest===digest);
    if (!row || row.status==='revoked' || Date.parse(row.expiresAt)<=Date.now()) fail(404,'This invitation has expired or been revoked.');
    const data = state.companies[row.company];
    const company = requireCompany(state,row.company);
    if (row.status !== 'active') {
      row.status='active';
      data.views.push({ at:new Date().toISOString(), label:row.email, kind:'Invitation opened' });
      if (data.views.length>100) data.views.shift();
    }
    return { name:company.name, values:publicValues(data), updates:data.updates, definitions:data.definitions };
  });
}

export async function runJob(owner, request, run) {
  const jobId = randomBytes(8).toString('hex');
  await update(owner,state => {
    if (state.jobs.some(job=>job.type===request.type && job.name.toLowerCase()===request.name.toLowerCase() && job.stage !== 'Complete' && job.stage !== 'Unavailable' && Date.now()-Date.parse(job.at)<60_000)) fail(409,'That job is already running.');
    state.jobs.unshift({ id:jobId, type:request.type, name:request.name, stage:'Discovering', at:new Date().toISOString() });
    state.jobs = state.jobs.slice(0,60);
  });
  const progress = (stage, extra = {}) => update(owner,state=>{
    const job = state.jobs.find(row=>row.id===jobId);
    if (job) Object.assign(job,extra,{stage,updatedAt:new Date().toISOString()});
  });
  try {
    return await run(progress);
  } catch (error) {
    await progress('Unavailable');
    throw error;
  }
}
