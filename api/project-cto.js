import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalog, cities, summary } from './_openrisk/engine/index.js';
import land from './_openrisk/land.js';
import { login, workspace } from './_openrisk/view.js';
import { client } from './_openrisk/client.js';
import { metrics, samples } from './_openrisk/engine/metrics.js';
import { getState, update, apply, project, invitation, runJob, Problem } from './_openrisk/store.js';
import { score } from './_openrisk/engine/score.js';
import { funds } from './_openrisk/engine/funds.js';
import { subscribeResearch } from './_openrisk/engine/research.js';
import { directoryCity, wikidataCity } from './_openrisk/engine/directories.js';
import { locate } from './_openrisk/engine/cities.js';
import preloadReport from './_openrisk/engine/preload-report.js';
import insets from './_openrisk/insets.js';
import logos from './_openrisk/logos.js';

const root = '/project-cto';
const cookie = 'openrisk_session';
const lifetime = 7 * 86400;
const cookieFlags = '; Path=' + root + '; HttpOnly; Secure; SameSite=Strict';
const equal = (a, b) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const sign = (payload, key) => createHmac('sha256', key).update(payload).digest('base64url');
const validRoles = ['Investor', 'Founder', 'Admin'];
const pageRoute = /^(?:portfolio|founder|investors|operations|startup\/[a-z0-9-]{1,100}|invite\/[0-9a-f]{32}\/[A-Za-z0-9_-]{32})$/;
const acceptedDestination = value => typeof value === 'string' && value.startsWith(root+'/') && pageRoute.test(value.slice(root.length+1)) ? value : '';
const documentScripts = {
  'document/pdf.mjs':'node_modules/pdfjs-dist/legacy/build/pdf.min.mjs',
  'document/pdf.worker.mjs':'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  'document/xlsx.js':'node_modules/read-excel-file/bundle/read-excel-file.min.js',
};

function session(req, key) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1) || '';
  const [id, exp, role, mac, extra] = value.split('.');
  if (extra || !/^[0-9a-f]{32}$/.test(id || '') || !validRoles.includes(role) || !/^\d{10}$/.test(exp || '') || !mac
    || Number(exp) <= Math.floor(Date.now() / 1000) || !equal(mac, sign([id, exp, role].join('.'), key))) return null;
  return { id, exp, role };
}

function setSession(res, { id, exp, role }, key) {
  const payload = [id, exp, role].join('.');
  const maxAge = Number(exp) - Math.floor(Date.now() / 1000);
  res.setHeader('Set-Cookie', cookie + '=' + payload + '.' + sign(payload, key) + cookieFlags + '; Max-Age=' + maxAge);
}

function routeOf(req) {
  const url = new URL(req.url, 'http://openrisk.local');
  if (url.pathname.startsWith(root + '/')) return url.pathname.slice(root.length + 1).replace(/\/+$/, '');
  const rewritten = req.query?.route ?? url.searchParams.get('route');
  return typeof rewritten === 'string' ? rewritten.replace(/\/+$/, '') : '';
}

function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; }
  catch { return false; }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : await new Promise((resolve, reject) => {
    let text = '';
    req.on('data', chunk => {
      text += chunk;
      if (text.length > 24000) reject(new Error('Payload too large'));
    });
    req.on('end', () => resolve(text));
    req.on('error', reject);
  });
  if (raw.length > 24000) throw new Error('Payload too large');
  return String(req.headers['content-type']).startsWith('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
}

const attempts = new Map();
function allowLogin(req) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 96);
  const window = Math.floor(Date.now() / 600000);
  if (attempts.size > 2000) attempts.clear();
  const bucket = attempts.get(ip);
  if (bucket?.window === window) return ++bucket.count <= 15;
  attempts.set(ip, { window, count: 1 });
  return true;
}

function send(res, code, value, type = 'application/json; charset=utf-8') {
  res.statusCode = code;
  res.setHeader('Content-Type', type);
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}

async function cold(res, name) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  const write = event => {
    if (!res.destroyed) res.write(JSON.stringify(event) + '\n');
  };
  write({ key:'start', value:name });
  const subscription = subscribeResearch(name,write);
  res.on('close',subscription.unsubscribe);
  try { await subscription.done; }
  finally { subscription.unsubscribe(); res.end(); }
}

export default async function handle(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  const html = 'text/html; charset=utf-8';
  const route = routeOf(req);
  const appRoute = pageRoute.test(route);
  const key = process.env.OPENRISK_SESSION_KEY;
  const password = process.env.OPENRISK_PASSWORD;
  if (!key || !password) return send(res, 503, login('This deployment is awaiting its private demo configuration.'), html);
  if (route === 'login' && req.method === 'POST') {
    if (!sameOrigin(req) || !allowLogin(req)) return send(res, 429, login('Try again from the workspace in a few minutes.'), html);
    let destination = '';
    try {
      const body = await readBody(req);
      destination = acceptedDestination(body.destination);
      if (typeof body.password === 'string' && body.password.length <= 128 && equal(body.password, password)) {
        setSession(res, { id: randomBytes(16).toString('hex'), exp: Math.floor(Date.now() / 1000) + lifetime, role: 'Investor' }, key);
        res.statusCode = 303;
        res.setHeader('Location', destination || root);
        return res.end();
      }
    } catch {}
    return send(res, 401, login('That password did not match.',destination), html);
  }
  const auth = session(req, key);
  const asset = route === 'workspace.js';
  const documentScript = Object.hasOwn(documentScripts,route) ? documentScripts[route] : null;
  if (!auth) return route.startsWith('api/') || asset || documentScript ? send(res, 401, { error: 'Sign in to OpenRisk.' }) : send(res, 401, login('', appRoute ? root+'/'+route : ''), html);
  if (req.method === 'GET' && documentScript) {
    if (auth.role!=='Founder') return send(res,403,{error:'The document reader belongs to the founder desk.'});
    try { return send(res,200,await readFile(resolve(documentScript)),'application/javascript; charset=utf-8'); }
    catch { return send(res,503,{error:'The document reader is temporarily unavailable.'}); }
  }
  if (req.method === 'GET' && asset) return send(res, 200, '(' + client.toString() + ')();', 'application/javascript; charset=utf-8');
  if (req.method === 'GET' && route === 'api/bootstrap') return send(res, 200, { catalog: catalog.map(item => ({ ...item, summary: summary(item) })), cities, land, insets, logos, funds, preloadReport, role: auth.role });
  if (req.method === 'GET' && route.startsWith('api/invite/')) {
    const target = /^api\/invite\/([0-9a-f]{32})\/([A-Za-z0-9_-]{32})$/.exec(route);
    if (!target) return send(res,404,{error:'Invitation not found.'});
    try { return send(res,200,{...await invitation(target[1],target[2]),metrics}); }
    catch (error) { return send(res,error instanceof Problem ? error.status : 503,{error:error instanceof Problem ? error.message : 'Invitations are temporarily unavailable.'}); }
  }
  if (route === 'api/state') {
    try {
      if (req.method === 'GET') return send(res,200,{ state:project(await getState(auth.id), auth.role), metrics, samples });
      if (req.method !== 'POST') return send(res,405,{error:'Use GET or POST.'});
      if (!sameOrigin(req) || !String(req.headers['content-type']).startsWith('application/json')) return send(res,403,{error:'Use the OpenRisk workspace.'});
      let body;
      try { body=await readBody(req); } catch { return send(res,400,{error:'Invalid workspace request.'}); }
      if (body?.action==='add-city' || body?.action==='approve') {
        return send(res,200,await jobs(auth,body));
      }
      const result = await update(auth.id,state=>apply(state,auth,body));
      return send(res,200,{...result,state:project(await getState(auth.id),auth.role)});
    } catch (error) {
      const storeError = error instanceof Problem;
      if (!storeError) console.error('OpenRisk workspace operation failed',error?.code || error?.name);
      return send(res,storeError ? error.status : 503,{error:storeError ? error.message : 'Workspace storage is temporarily unavailable.'});
    }
  }
  if (req.method === 'GET' && route === 'api/cold') {
    const url = new URL(req.url, 'http://openrisk.local');
    const name = String(req.query?.name ?? url.searchParams.get('name') ?? '').trim();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .&'’+_()-]{0,79}$/u.test(name)) return send(res, 400, { error: 'Enter a company name up to 80 characters.' });
    return cold(res, name);
  }
  if (req.method === 'POST' && route === 'api/role') {
    if (!sameOrigin(req)) return send(res, 403, { error: 'Use the OpenRisk workspace.' });
    try {
      const { role } = await readBody(req);
      if (!validRoles.includes(role)) throw new Error('Unknown role');
      setSession(res, { ...auth, role }, key);
      return send(res, 200, { role });
    } catch { return send(res, 400, { error: 'Choose a demo role.' }); }
  }
  if (['GET','HEAD'].includes(req.method) && (!route || route === 'login' || route === 'index.html' || appRoute)) return send(res, 200, workspace(), html);
  return send(res, 404, { error: 'OpenRisk route not found.' });
}

async function jobs(auth, body) {
  if (body.action==='approve') {
    if (auth.role!=='Admin') throw new Problem(403,'Only an admin can approve a request.');
    const {requests} = await getState(auth.id);
    const row = requests.find(item=>item.id===body.request);
    if (!row || row.status!=='pending') throw new Problem(404,'Pending request not found.');
    return runJob(auth.id,{type:'Startup',name:row.name},async progress=>{
      await progress('Enriching');
      const events = {};
      const subscription=subscribeResearch(row.name,event=>events[event.key]=event.value);
      try { await subscription.done; } finally { subscription.unsubscribe(); }
      const domain=new URL(row.website).hostname.replace(/^www\./,'');
      const matchingWebsite=events.identity?.value.website && new URL(events.identity.value.website).hostname.replace(/^www\./,'')===domain;
      const identity=matchingWebsite?events.identity:null;
      const news=events.news;
      const signals={
        ...(identity ? {identity} : {}),
        ...(identity && events.engineering ? {github:events.engineering} : {}),
        ...(news ? {news} : {}),
      };
      const company = {
        id:'request-'+row.id, name:row.name, city:row.city, sector:'Pending classification',
        domain, source:row.website, asOf:new Date().toISOString(),
        description:identity?.value?.description || 'Submitted for inclusion by a demo visitor.',
        signals, risk:matchingWebsite && events.score ? events.score : score(signals),
      };
      company.summary=summary(company);
      await update(auth.id,state=>{
        const request = state.requests.find(item=>item.id===row.id);
        Object.assign(request,{status:'approved',company});
      });
      await progress('Complete',{ count:1, sources:[{label:'Wikidata',ok:Boolean(identity)},{label:'Hacker News',ok:Boolean(news)}] });
      return {state:project(await getState(auth.id),auth.role)};
    });
  }
  const name = typeof body.name==='string' ? body.name.trim() : '';
  if (!/^[\p{L}][\p{L} .,’'()-]{1,79}$/u.test(name)) throw new Problem(400,'Enter a city name.');
  const place = locate(name);
  if (!place) throw new Problem(422,'City not found in the gazetteer. Try the English city name or add the country.');
  return runJob(auth.id,{type:'City',name:place.name},async progress=>{
    const [startupMap, wikidata] = await Promise.allSettled([directoryCity(place.name),wikidataCity(place.name,35)]);
    await progress('Enriching',{ city:place });
    const existing = new Set(catalog.map(item=>item.id));
    const domains = new Set(catalog.map(item=>item.domain));
    const details = [];
    for (const item of [...(startupMap.value || []), ...(wikidata.value || [])]) {
      if (existing.has(item.id) || (item.domain && domains.has(item.domain))) continue;
      existing.add(item.id);
      if (item.domain) domains.add(item.domain);
      const company={...item,risk:score(item.signals)};
      details.push({...company,summary:summary(company)});
    }
    const count=details.length+catalog.filter(item=>item.city===place.name).length;
    await progress('Complete',{count,details,sources:[
      {label:'Natural Earth gazetteer',ok:true},
      {label:'StartupMap public directory',ok:Boolean(startupMap.value?.length)},
      {label:'Wikidata Query Service',ok:Boolean(wikidata.value?.length)},
    ]});
    return {state:project(await getState(auth.id),auth.role), city:place.name, count};
  });
}
