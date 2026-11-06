import {posthogReady} from './_posthog.js';
const PUBLIC_KEY='phc_tqJYxREMXWjzQusx6xNPuEa2fNCzKmVpAURSHKnVbpro';
// Called only by the existing CRON_SECRET-protected POST maintenance route.
// Never return provider tokens or arbitrary project settings.
export async function configureCookieless({enable=false,request=fetch}={}){
 if(!posthogReady())return {ok:false,stage:'configuration'};
 const url=`https://eu.posthog.com/api/projects/${process.env.POSTHOG_PROJECT_ID||'331552'}/`;
 const headers={Authorization:'Bearer '+process.env.POSTHOG_PERSONAL_API_KEY,'Content-Type':'application/json'};
 const read=async()=>{const r=await request(url,{headers,signal:AbortSignal.timeout(10000)});return r.ok?{http:r.status,data:await r.json()}:{http:r.status};};
 const before=await read();if(!before.data)return {ok:false,stage:'read',http:before.http};
 const safe=d=>({project:Number(d.id),client_key_matches:d.api_token===PUBLIC_KEY,cookieless_mode:d.cookieless_server_hash_mode??0,discard_client_ip:!!d.anonymize_ips});
 const result={ok:true,before:safe(before.data)};
 if(enable){
  if(!result.before.client_key_matches)return {...result,ok:false,stage:'client_key_mismatch'};
  const r=await request(url,{method:'PATCH',headers,body:JSON.stringify({cookieless_server_hash_mode:1,anonymize_ips:true,session_recording_opt_in:false,heatmaps_opt_in:false,autocapture_opt_out:true}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)return {...result,ok:false,stage:'update',http:r.status};
  const after=await read();result.after=after.data?safe(after.data):null;result.ok=result.after?.cookieless_mode===1&&result.after?.discard_client_ip===true;
 }
 try{const r=await request(url+'ingestion_warnings/?limit=10',{headers,signal:AbortSignal.timeout(4000)});if(r.ok){const body=await r.json();result.warning_types=(body.results||[]).map(x=>String(x.type||x.warning_type||'unknown')).filter(x=>/^[a-zA-Z0-9_ -]{1,100}$/.test(x));}}catch{}
 return result;
}
