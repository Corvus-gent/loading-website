export const number=(n,digits=0)=>Number.isFinite(n)?n.toLocaleString('en-GB',{maximumFractionDigits:digits}):'not measured';
export const newest=data=>data.measurements.at(-1);
export const lower=(value,baseline)=>Number.isFinite(value)&&Number.isFinite(baseline)&&baseline>0?(1-value/baseline)*100:null;
export function rows(data,profile='mobile',cache='cold-context'){
 if(!['mobile','desktop'].includes(profile)||!['cold-context','warm'].includes(cache))throw Error('Invalid comparison');
 const m=newest(data);
 return ['/', '/map/', '/cv/tech/'].map(route=>{
  const get=engine=>m.summary.find(s=>s.engine===engine&&s.profile===profile&&s.cache===cache&&s.route===route);
  return {route,label:route==='/'?'Home':route==='/map/'?'Map':'CV',legacy:get('legacy'),rust:get('rust')};
 });
}
export function snapshotFacts(data){
 const first=data.measurements[0],last=newest(data);
 return {reduction:lower(last.brotliBytes,first.brotliBytes),totalTokens:data.usage.tokens.input_tokens+data.usage.tokens.output_tokens,cachedPercent:data.usage.tokens.input_tokens?data.usage.tokens.cached_input_tokens/data.usage.tokens.input_tokens*100:null,complete:false};
}
