export default async function x(rows,{fetcher=fetch}={}){
 if(!process.env.X_BEARER_TOKEN)return{mode:'manual',updates:[],note:'Manual entry · X token not configured.'};const updates=[];
 for(let start=0;start<rows.length;start+=100){const batch=rows.slice(start,start+100),ids=new Map(batch.map(row=>[new URL(row.post_url).pathname.split('/').at(-1),row]));
 const url=new URL('https://api.x.com/2/tweets');url.searchParams.set('ids',[...ids.keys()].join(','));url.searchParams.set('tweet.fields','public_metrics,created_at');
 const response=await fetcher(url,{headers:{Authorization:'Bearer '+process.env.X_BEARER_TOKEN},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('X unavailable ('+response.status+'). Previous metrics kept.');const body=await response.json();if(!Array.isArray(body.data))throw Error('X returned no usable metrics.');
 for(const item of body.data){const row=ids.get(item.id),m=item.public_metrics;if(!row||!m)continue;const patch={};for(const[ours,theirs]of Object.entries({views:'impression_count',likes:'like_count',comments:'reply_count',saves:'bookmark_count'}))if(Number.isSafeInteger(m[theirs])&&m[theirs]>=0)patch[ours]=m[theirs];if(Number.isSafeInteger(m.retweet_count)&&Number.isSafeInteger(m.quote_count))patch.shares=m.retweet_count+m.quote_count;if(item.created_at&&Number.isFinite(Date.parse(item.created_at)))patch.posted_at=item.created_at;if(Object.keys(patch).length)updates.push({row,patch});}
 }return{mode:'x-api',updates,note:'X views are post impressions; shares include reposts + quotes.'};
}
