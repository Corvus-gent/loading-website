import { estimate, score } from './score.js';

export function scorePlan(item) {
  const now=new Date(item.risk.asOf);
  const nextYear=new Date(now);
  nextYear.setUTCFullYear(nextYear.getUTCFullYear()+1);
  const changes=(date,jobs,funding)=>{
    const asOf=date.toISOString();
    return {
      github:{value:{pushedAt:asOf}},
      ...(jobs?{jobs:{value:{count:jobs}}}:{}),
      ...(funding?{funding:{value:{announced:asOf}}}:{}),
    };
  };
  const cases=[
    [70,'Document active engineering','Link a company-owned public repository with a substantive update in the last 14 days, if you already have one.',now,changes(now,0,false)],
    [80,'Evidence of a new round and delivery capacity','Scenario with a new financing announcement, at least four genuine open roles and a recent public engineering update.',now,changes(now,4,true)],
    [90,'High-signal profile after another year','Scenario one year out with a new round at that time, seven open roles and fresh public engineering evidence.',nextYear,changes(nextYear,7,true)],
  ];
  const scenarios=cases.map(([target,title,detail,at,inputs])=>{
    const projected=score({...item.signals,...inputs},at);
    return {target,title,detail,score:projected.value,coverage:projected.coverage};
  });
  return {
    scenarios,
    current:item.risk.value,
    ceiling:score({...item.signals,...changes(now,7,true)},now).value,
    missing:item.risk.breakdown.filter(row=>row.points==null).map(row=>row.title),
  };
}

export function premiumComparison(left,right) {
  const shared=left.risk.breakdown.flatMap(row=>{
    const other=right.risk.breakdown.find(candidate=>candidate.key===row.key);
    return row.points!=null && other?.points!=null && row.basis===other.basis
      ? [{title:row.title,weight:row.weight,delta:row.points-other.points}] : [];
  });
  const bands=[left,right].map(item=>{
    const {factors,coverage}=estimate(item.signals);
    const total=key=>factors.reduce((sum,row)=>sum+row[key],0);
    return {low:total('low'),high:total('high'),coverage};
  });
  if (!shared.length) return {bands,shared,cases:0};
  const margins=shared.reduce((sets,rule)=>sets.flatMap(set=>[.75,1,1.25].map(factor=>[
    set[0]+rule.weight*factor*rule.delta,set[1]+rule.weight*factor,
  ])),[[0,0]]).map(([delta,weight])=>delta/weight);
  return {bands,shared,cases:margins.length,
    leftWins:margins.filter(value=>value>1e-9).length,
    rightWins:margins.filter(value=>value< -1e-9).length,
    low:Math.min(...margins),high:Math.max(...margins),
  };
}
