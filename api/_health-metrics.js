// Grafana/Prometheus scrape of the existing monitor sample; never fan out to providers.
import {redis} from './_redis.js';
import {safeEqual} from './_session.js';
import {names} from './_health-history.js';
export function prometheus(sample,now=Date.now()){
 const checked=Date.parse(sample?.checked_at),available=Number.isFinite(checked);
 const lines=['# HELP corvus_health_data_available Whether a saved monitor sample exists.','# TYPE corvus_health_data_available gauge',`corvus_health_data_available ${available?1:0}`];
 if(!available)return lines.join('\n')+'\n';
 lines.push('# HELP corvus_health_sample_timestamp_seconds Timestamp of the saved monitor sample.','# TYPE corvus_health_sample_timestamp_seconds gauge',`corvus_health_sample_timestamp_seconds ${checked/1000}`,'# HELP corvus_health_sample_age_seconds Age of the saved monitor sample.','# TYPE corvus_health_sample_age_seconds gauge',`corvus_health_sample_age_seconds ${Math.max(0,(now-checked)/1000)}`,'# HELP corvus_service_up Reachability at the last recorded check; missing and skipped checks are omitted.','# TYPE corvus_service_up gauge','# HELP corvus_service_check_duration_seconds Duration of a synthetic service check, not user request latency.','# TYPE corvus_service_check_duration_seconds gauge');
 for(const name of names){const c=sample.checks?.[name];if(!c||c.skipped||typeof c.ok!=='boolean')continue;lines.push(`corvus_service_up{service="${name}"} ${c.ok?1:0}`);if(Number.isFinite(c.ms)&&c.ms>=0)lines.push(`corvus_service_check_duration_seconds{service="${name}"} ${c.ms/1000}`);}
 return lines.join('\n')+'\n';
}
export function createMetricsHandler({env=process.env,read=()=>redis(['GET','health:last']),now=Date.now}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
  const token=env.GRAFANA_METRICS_TOKEN;
  if(!token||token.length<32)return res.status(503).end('Metrics integration is not configured.\n');
  if(!safeEqual(req.headers.authorization||'','Bearer '+token)){res.setHeader('WWW-Authenticate','Bearer');return res.status(401).end('Unauthorized\n');}
  try{const raw=await read();const sample=typeof raw==='string'?JSON.parse(raw):raw;res.setHeader('Content-Type','text/plain; version=0.0.4; charset=utf-8');const body=prometheus(sample,now());return req.method==='HEAD'?res.status(200).end():res.status(200).send(body);}
  catch{return res.status(503).end('Monitor sample unavailable.\n');}
 };
}
export default createMetricsHandler();
