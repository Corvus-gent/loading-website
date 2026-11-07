export const TIKTOK_ACCOUNTS=[['gabe.maxxing',['tt','tt-bio']],['gabinho_bjj',['tt-bjj']],['gabriellvl',['tt-g']]];
export function sourceRows(d){
 const sources=d.sources||{},donations=d.donations||{},campaigns=(d.campaigns||[]).filter(r=>r.touch==='last'&&r.source==='tiktok');
 const values=(label,n)=>[label,n.clicks||0,n.visits||0,n.engaged||0,n.donationClicks||0,n.donations||0,n.visits?((n.donations||0)/n.visits*100).toFixed(1)+'%':'—','€'+((n.cents||0)/100).toFixed(2)];
 const fields=['clicks','visits','engaged','donationClicks','donations','cents'],known={};
 const accounts=TIKTOK_ACCOUNTS.map(([name,slugs])=>{const n={};for(const r of campaigns.filter(r=>slugs.includes(r.slug)))for(const k of fields)n[k]=(n[k]||0)+(r[k]||0);for(const k of fields)known[k]=(known[k]||0)+(n[k]||0);return values('tiktok · '+name,n);});
 const rows=[];for(const source of new Set([...Object.keys(sources),...Object.keys(donations)].map(k=>k.split(':')[0]))){
 const n={clicks:sources[source+':link_click']||0,visits:sources[source+':view']||0,engaged:Object.entries(sources).filter(([k])=>k.startsWith(source+':')&&!['view','link_click','donation_click','donation_success'].includes(k.split(':')[1])).reduce((sum,[,n])=>sum+n,0),donationClicks:sources[source+':donation_click']||0,donations:donations[source+':payments']||0,cents:donations[source+':cents']||0};
 if(source==='tiktok'){for(const k of fields)n[k]=Math.max(0,n[k]-(known[k]||0));n.engaged='—';if(fields.filter(k=>k!=='engaged').some(k=>n[k]))rows.push(values('tiktok · other / older links',n));}else rows.push(values(source,n));
 }return[...rows,...accounts];
}
