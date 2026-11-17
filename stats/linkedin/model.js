export function selectRows(data,range='all'){
 const rows=data.daily.filter(r=>range==='all'||r.date!==data.source.partialDate);
 return range==='all'?rows:rows.slice(-Number(range));
}
export function seriesFor(rows,metric,mode='cumulative'){
 let total=0,missing=false;
 return rows.map(r=>{if(r[metric]===null||r[metric]===undefined){missing=true;return {date:r.date,value:null};}total+=r[metric];return {date:r.date,value:mode==='daily'?r[metric]:missing?null:total};});
}
export function sum(rows,key){return rows.some(r=>r[key]===null||r[key]===undefined)?null:rows.reduce((n,r)=>n+r[key],0);}
export function comparison(data,start='2026-11-06'){
 const at=Date.parse(start+'T00:00:00Z'),day=86400000;
 const current=data.daily.filter(r=>Date.parse(r.date+'T00:00:00Z')>=at&&Date.parse(r.date+'T00:00:00Z')<at+7*day);
 const prior=data.daily.filter(r=>Date.parse(r.date+'T00:00:00Z')>=at-7*day&&Date.parse(r.date+'T00:00:00Z')<at);
 if(current.length!==7||prior.length!==7)return null;
 const value=sum(current,'impressions'),previous=sum(prior,'impressions');return {value,previous,change:previous?(value/previous-1)*100:null};
}
