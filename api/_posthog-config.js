import {pathCategory} from '../js/analytics-policy.js';
import {posthogReady,hogql} from './_posthog.js';
const PUBLIC_KEY='phc_tqJYxREMXWjzQusx6xNPuEa2fNCzKmVpAURSHKnVbpro';
// Called only by the existing CRON_SECRET-protected POST maintenance route.
// Never return provider tokens or arbitrary project settings.
export async function configureCookieless({request=fetch,query=hogql}={}){
 if(!posthogReady())return {ok:false,stage:'configuration'};
 const url=`https://eu.posthog.com/api/projects/${process.env.POSTHOG_PROJECT_ID||'331552'}/`;
 const headers={Authorization:'Bearer '+process.env.POSTHOG_PERSONAL_API_KEY,'Content-Type':'application/json'};
 const read=async()=>{const r=await request(url,{headers,signal:AbortSignal.timeout(10000)});return r.ok?{http:r.status,data:await r.json()}:{http:r.status};};
 const before=await read();if(!before.data)return {ok:false,stage:'read',http:before.http};
 const safe=d=>({project:Number(d.id),client_key_matches:d.api_token===PUBLIC_KEY,cookieless_mode:d.cookieless_server_hash_mode??0,discard_client_ip:!!d.anonymize_ips});
 const result={ok:true,before:safe(before.data)};
 const reads=await Promise.allSettled([
  query("SELECT type,count(),max(timestamp) FROM system.ingestion_warnings WHERE timestamp>now()-INTERVAL 2 HOUR GROUP BY type ORDER BY count() DESC LIMIT 20"),
  query("SELECT properties.$pathname,count(),max(timestamp) FROM events WHERE event='$pageview' AND timestamp>now()-INTERVAL 2 HOUR GROUP BY properties.$pathname LIMIT 30")
 ]);
 result.warnings=reads[0].status==='fulfilled'?reads[0].value.map(([type,count,latest])=>({type:/^[a-z_]{1,100}$/.test(type)?type:'other',count:Number(count),latest})):null;
 result.recent_pages=reads[1].status==='fulfilled'?reads[1].value.map(([page,count,latest])=>({page:pathCategory(page),count:Number(count),latest})):null;
 return result;
}
