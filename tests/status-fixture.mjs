// Deterministic synthetic monitor readings, exclusively for browser tests and the local lab.
import { names, emptyHistory } from '../api/_health-history.js';
export function statusFixture(scenario = 'healthy', range = '24h', at = Date.now()) {
  const result = emptyHistory(range, at);
  if (scenario === 'empty') return result;
  const end = at - 120000,
    count = { '24h': 288, '7d': 168, '30d': 720 }[range],
    spike = count - 16;
  result.times = Array.from({ length: count }, (_, i) => end - (count - i - 1) * result.step);
  result.status = { healthy: 'ok', slow: 'degraded', outage: 'degraded', down: 'down' }[scenario];
  result.checked_at = new Date(end).toISOString();
  const bad = scenario === 'outage' || scenario === 'down',
    slow = scenario === 'slow';
  const level = bad ? 3 : slow ? 2 : 1;
  for (const [n, name] of names.entries()) {
    const affected = name === 'redis' || (scenario === 'down' && ['site', 'stats'].includes(name));
    const readings = result.times.map((_, i) => {
      const ms = Math.round(
        120 + n * 15 + 32 * Math.sin(i * 0.23 + n) + 22 * Math.cos(i * 0.79 + n) + ((i * 13 + n) % 15)
      );
      if (affected && i >= spike && level > 1)
        return [bad ? 2400 : 1600 + (i % 3) * 100, bad ? 2400 : 1850, level];
      return [ms, ms, 1];
    });
    result.series[name] = readings;
    const uptime = bad && affected ? 99.81 : 100;
    result.checks.push({
      name,
      state: affected ? level : 1,
      uptime: [uptime, uptime, uptime, uptime],
      spark: readings.slice(-24).map((v) => [v[1], v[2]]),
      days: result.days.map((_, i) =>
        i < 9
          ? null
          : [
              affected && i === 89 ? level : 1,
              uptime,
              readings.at(-1)[0],
              affected && i === 89 && level > 1 ? 1 : 0
            ]
      )
    });
  }
  result.series.overall = result.times.map((_, i) => {
    const points = names.map((name) => result.series[name][i]);
    const ms = Math.round(points.reduce((a, v) => a + v[0], 0) / points.length);
    return [ms, ms, i >= spike ? level : 1];
  });
  result.uptime = result.checks.find((c) => c.name === 'redis').uptime;
  if (level > 1)
    result.incidents = [{ name: 'redis', start: result.times[spike], last: end, worst: level }];
  return result;
}
