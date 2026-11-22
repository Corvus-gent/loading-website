// Coverage uses expected slots, not only returned samples: outages must leave gaps.
export function summarizeTelemetry(body){
 const checks=(body.checks||[]).filter(c=>c.state>0);
 const series=body.series?.overall||[];
 const measured=series.flatMap((v,i)=>Array.isArray(v)&&Number.isFinite(v[0])&&v[0]>=0?[{v,t:body.times?.[i]}]:[]);
 const step=Number.isFinite(body.step)&&body.step>0?body.step:300000;
 const window=({'24h':86400000,'7d':604800000,'30d':2592000000})[body.range]||86400000;
 const total=Math.ceil(window/step);
 const observed=new Set(measured.filter(x=>Number.isFinite(x.t)).map(x=>Math.floor(x.t/step))).size;
 const values=measured.map(x=>x.v[0]);
 return {healthy:checks.filter(c=>c.state===1).length,services:checks.length,average:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null,peak:measured.length?Math.max(...measured.map(x=>Number.isFinite(x.v[1])?x.v[1]:x.v[0])):null,observed,total,coverage:observed?Math.min(100,Math.round(observed/total*100)):null};
}
