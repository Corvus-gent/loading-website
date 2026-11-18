// Bounded evidence rubric. Unknown factors reduce coverage, never the score.
const rules = [
  { key: 'founded', title: 'Operating history', weight: 25, floor:20, rate: (v, date) => Math.max(20, Math.min(100, 45 + 5 * (date.getUTCFullYear() - v))) },
  { key: 'funding', title: 'Disclosed financing recency', weight: 30, floor:45, rate: (v, date) => {
    const months = (date - Date.parse(v.announced)) / (365.25 / 12 * 86400000);
    return months <= 6 ? 100 : months <= 12 ? 85 : months <= 18 ? 70 : 45;
  } },
  { key: 'jobs', title: 'Public hiring activity', weight: 25, floor:50, rate: v => 50 + Math.min(50, Math.round(17 * Math.log2(v.count + 1))) },
  { key: 'github', title: 'Public engineering activity', weight: 20, floor:35, rate: (v, date) => {
    const days = (date - Date.parse(v.pushedAt)) / 86400000;
    return days <= 14 ? 100 : days <= 45 ? 80 : days <= 120 ? 60 : 35;
  } },
];

export function score(signals, now = new Date()) {
  const breakdown = rules.map(rule => {
    const directory = rule.key==='jobs' && !signals.jobs && Number.isSafeInteger(signals.directoryJobs?.value) && signals.directoryJobs.value>0;
    const signal = directory ? signals.directoryJobs : signals[rule.key];
    const input = directory ? {count:signal.value} : signal?.value;
    return { key: rule.key, title:directory?'Directory-listed hiring':rule.title, weight:rule.weight, points:signal?rule.rate(input,now):null, signal, ...(directory?{basis:'directory'}:{}) };
  });
  const seen = breakdown.filter(item => item.points !== null);
  const coverage = seen.reduce((sum, item) => sum + item.weight, 0);
  const weighted = seen.reduce((sum, item) => sum + item.weight * item.points, 0);
  const value = coverage >= 25 ? Math.round(weighted / coverage) : null;
  const provisional = value !== null && coverage < 45;
  const grade = value === null || provisional ? null : value >= 85 ? 'A' : value >= 70 ? 'B' : value >= 55 ? 'C' : value >= 40 ? 'D' : 'E';
  return { value, grade, provisional, coverage, breakdown, trend: null, asOf: now.toISOString() };
}


export function estimate(signals) {
  const snapshot=score(signals);
  const factors=snapshot.breakdown.map((row,index)=>({
    ...row,
    low:row.weight*(row.points ?? rules[index].floor)/100,
    high:row.weight*(row.points ?? 100)/100,
  }));
  const low=factors.reduce((total,row)=>total+row.low,0);
  const high=factors.reduce((total,row)=>total+row.high,0);
  return {factors,coverage:snapshot.coverage,asOf:snapshot.asOf,low:Math.floor(low),high:Math.ceil(high),
    midpoint:snapshot.coverage ? Math.round((low+high)/2) : null};
}
