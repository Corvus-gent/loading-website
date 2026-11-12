import {normalize} from '../normalize.js';
import {platformID} from '../../sync.js';
export async function oriane(rows,platform,{fetcher=fetch}={}){
 if(!process.env.ORIANE_API_KEY)return {mode:'manual',updates:[],note:'Manual entry · Oriane key not configured.'};
 const selected=rows.map(row=>({row,id:platformID({...row,platform})})).filter(v=>v.id),updates=[];
 for(let i=0;i<selected.length;i+=100){const batch=selected.slice(i,i+100),wanted=new Map(batch.map(v=>[v.id.platform+':'+v.id.platformId,v.row]));
 const response=await fetcher('https://connect.oriane.xyz/rest/contents/search?limit=100&projection=basic',{method:'POST',headers:{Authorization:'Bearer '+process.env.ORIANE_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({operator:'and',filters:{platformId:{includes:batch.map(v=>v.id)}}}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Oriane HTTP '+response.status+'; check ORIANE_API_KEY and content search access.');const data=await response.json();if(!Array.isArray(data?.data?.results))throw Error('Oriane returned no usable metrics.');
 for(const item of data.data.results){const row=wanted.get(item.platform+':'+item.platformId);if(!row)continue;const patch=normalize(platform,item,{oriane:true});if(Object.keys(patch).length)updates.push({row,patch});}
 }
 return{mode:'oriane',updates,note:updates.length+' matched posts; unreported fields kept.'};
}
