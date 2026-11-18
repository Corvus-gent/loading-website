// Bounded evidence rubric. Unknown factors reduce coverage, never the score.
const rules = [
  { key: 'founded', title: 'Operating history', weight: 25, rate: (v, date) => Math.max(20, Math.min(100, 45 + 5 * (date.getUTCFullYear() - v))) },
  { key: 'funding', title: 'Disclosed financing recency', weight: 30, rate: (v, date) => {
    const months = (date - Date.parse(v.announced)) / (365.25 / 12 * 86400000);
    return months <= 6 ? 100 : months <= 12 ? 85 : months <= 18 ? 70 : 45;
  } },
  { key: 'jobs', title: 'Public hiring activity', weight: 25, rate: v => 50 + Math.min(50, Math.round(17 * Math.log2(v.count + 1))) },
  { key: 'github', title: 'Public engineering activity', weight: 20, rate: (v, date) => {
    const days = (date - Date.parse(v.pushedAt)) / 86400000;
    return days <= 14 ? 100 : days <= 45 ? 80 : days <= 120 ? 60 : 35;
  } },
];

export function score(signals, now = new Date()) {
  const breakdown = rules.map(rule => {
    const signal = signals[rule.key];
    return { key: rule.key, title: rule.title, weight: rule.weight, points: signal ? rule.rate(signal.value, now) : null, signal };
  });
  const seen = breakdown.filter(item => item.points !== null);
  const coverage = seen.reduce((sum, item) => sum + item.weight, 0);
  const weighted = seen.reduce((sum, item) => sum + item.weight * item.points, 0);
  const value = coverage >= 45 ? Math.round(weighted / coverage) : null;
  const grade = value === null ? null : value >= 85 ? 'A' : value >= 70 ? 'B' : value >= 55 ? 'C' : value >= 40 ? 'D' : 'E';
  return { value, grade, coverage, breakdown, trend: null, asOf: now.toISOString() };
}
