// Cadence is per destination account, not shared across different platforms.
export const POST_INTERVAL_MS={tt:60*60*1000,ig:60*60*1000,x:45*60*1000,li:0,tw:0,yt:60*60*1000};
export function uploadQueue(videos,now=Date.now()){
 const groups=new Map();
 for(const v of videos){if(v.is_example)continue;const id=v.platform+'-'+v.account;if(!groups.has(id))groups.set(id,{id,platform:v.platform,account:v.account,rows:[]});groups.get(id).rows.push(v);}
 return [...groups.values()].map(g=>{
  const posted=g.rows.filter(v=>(v.status==='posted'||v.post_url)&&Number.isFinite(Date.parse(v.posted_at))).sort((a,b)=>Date.parse(b.posted_at)-Date.parse(a.posted_at));
  const interval=POST_INTERVAL_MS[g.platform]||0,last=posted[0];
  let previous=last?.lang,at=Math.max(now,last?Date.parse(last.posted_at)+interval:now);
  const pending=g.rows.filter(v=>v.status==='ready'&&!v.post_url).sort((a,b)=>(a.export_order??1e6)-(b.export_order??1e6)||a.slug.localeCompare(b.slug)),items=[];
  while(pending.length){const counts=new Map();for(const v of pending)counts.set(v.lang,(counts.get(v.lang)||0)+1);let i=-1;for(let n=0;n<pending.length;n++)if(pending[n].lang!==previous&&(i<0||counts.get(pending[n].lang)>counts.get(pending[i].lang)))i=n;if(i<0)i=0;const v=pending.splice(i,1)[0];items.push({...v,available_at:new Date(at).toISOString(),language_repeated:previous===v.lang});previous=v.lang;at+=interval;}
  return{id:g.id,platform:g.platform,account:g.account,interval_minutes:interval/60000,last_posted_at:last?.posted_at||null,items};
 }).filter(g=>g.items.length).sort((a,b)=>a.items[0].available_at.localeCompare(b.items[0].available_at)||a.id.localeCompare(b.id));
}
