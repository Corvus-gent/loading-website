import { redis, pipeline, plaintextExceptionUntil } from './_redis.js';
import { waitUntil } from '@vercel/functions';

const MIN = 60000,
  HOUR = 60 * MIN,
  DAY = 24 * HOUR,
  STEP = 5 * MIN;
const prefix = 'health:v2:';
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' });
export const names = [
  'site',
  'redirects',
  'stats',
  'redis',
  'posthog',
  'resend',
  'notion',
  'coffee',
  'tiles',
  'spotify',
  'snapshots',
  'cron'
];
export const slowMs = 1500;
const ranges = { '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY };
const state = (c) => (!c || c.skipped || c.ok == null ? 0 : !c.ok ? 3 : c.ms >= slowMs ? 2 : 1);
const floor = (t, step) => Math.floor(t / step) * step;
const parse = (s) => (s ? JSON.parse(s) : null);
const sum = (a, i) => a.reduce((total, v) => total + (v?.[i] || 0), 0);
const pct = (a) => (sum(a, 0) ? (100 * sum(a, 1)) / sum(a, 0) : null);

// A bucket contains [observations, reachable, total ms, peak ms, worst state, incident count].
// One atomic write updates both resolutions, incident transitions and the raw point.
// Regular traffic shares a five-minute slot. A monitor ping records its own live run.
const ingest = `
 local at, slot, cells = tonumber(ARGV[1]), tonumber(ARGV[2]), cjson.decode(ARGV[3])
 local archive = ARGV[4] == '1'
 if not archive then
   local latest=redis.call('GET',KEYS[6])
   if not latest or cjson.decode(latest).checked_at<ARGV[10] then
     redis.call('SET',KEYS[6],ARGV[9],'EX',2592000)
   end
 end
 local first = tonumber(redis.call('GET', KEYS[5]) or '0')
 if archive and (first == 0 or slot >= first) then return 0 end
 local ledger = cjson.decode(redis.call('GET', KEYS[4]) or '{"slot":0,"open":{},"recent":[]}')
 local monitor = ARGV[11]=='1'
 if at <= (ledger.at or 0) then return 0 end
 if not monitor and (slot <= ledger.slot or at-(ledger.monitor or 0)<300000) then return 0 end
 if monitor then ledger.monitor=at end
 ledger.at=at
 for i=#ledger.recent,1,-1 do
   if ledger.recent[i].finish < at-10368000000 then table.remove(ledger.recent,i) end
 end
 for name,incident in pairs(ledger.open) do
   if incident.last < at-10368000000 then ledger.open[name]=nil end
 end
 if not archive and first == 0 then redis.call('SET', KEYS[5], slot, 'EX', 10368000) end
 ledger.slot = slot
 local hour = cjson.decode(redis.call('GET',KEYS[2]) or '{}')
 local day = cjson.decode(redis.call('GET',KEYS[3]) or '{}')
 local function accumulate(bucket, name, cell, started)
   local v=bucket[name] or {0,0,0,0,0,0}
   if started or (v[1]==0 and cell[1]>1) then v[6]=v[6]+1 end
   v[1]=v[1]+1; v[2]=v[2]+cell[3]; v[3]=v[3]+cell[2]
   v[7]=math.max(v[7] or 0,cell[1]==3 and at or 0)
   v[4]=math.max(v[4],cell[2]); v[5]=math.max(v[5],cell[1]); bucket[name]=v
 end
 for name, cell in pairs(cells) do
   local started=false
   if name~='overall' then
     local incident=ledger.open[name]
     if cell[1]>1 then
       if not incident then started=true;incident={name=name,start=at,worst=cell[1]};ledger.open[name]=incident end
       incident.worst=math.max(incident.worst,cell[1]);incident.last=at
     elseif incident then
       incident.finish=at;table.insert(ledger.recent,1,incident);ledger.open[name]=nil
       table.sort(ledger.recent,function(a,b) return a.start>b.start end)
       if #ledger.recent>10 then table.remove(ledger.recent) end
     end
   end
   accumulate(hour,name,cell,started);accumulate(day,name,cell,started)
 end
 redis.call('SET',KEYS[2],cjson.encode(hour),'PXAT',ARGV[5])
 redis.call('SET',KEYS[3],cjson.encode(day),'PXAT',ARGV[6])
 redis.call('SET',KEYS[4],cjson.encode(ledger),'EX',10368000)
 if at>=tonumber(ARGV[7]) then
   redis.call('ZADD',KEYS[1],at,ARGV[8]);redis.call('EXPIRE',KEYS[1],172800)
 end
 redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[7])
 return 1
`;
function writeCommand(sample, now, archive, monitor = false) {
  const at = Date.parse(sample.checked_at),
    slot = floor(at, STEP),
    hour = floor(at, HOUR);
  const cells = {};
  for (const name of names) {
    const c = sample.checks[name],
      level = state(c);
    if (level) cells[name] = [level, Math.max(0, Math.round(c.ms) || 0), Number(c.ok)];
  }
  const measured = Object.values(cells);
  if (measured.length)
    cells.overall = [
      Math.max(...measured.map((c) => c[0])),
      Math.round(sum(measured, 1) / measured.length),
      Number(measured.every((c) => c[2]))
    ];
  return [
    'EVAL',
    ingest,
    '6',
    prefix + 'raw',
    prefix + 'h:' + hour,
    prefix + 'd:' + calendar.format(at),
    prefix + (archive ? 'legacy-ledger' : 'ledger'),
    prefix + 'first',
    'health:last',
    at,
    slot,
    JSON.stringify(cells),
    archive ? '1' : '0',
    hour + 30 * DAY + HOUR,
    at + 120 * DAY,
    now - 2 * DAY,
    JSON.stringify({ at, cells }),
    JSON.stringify(sample),
    sample.checked_at,
    Number(monitor)
  ].map(String);
}
export async function record(sample, now = Date.now(), monitor = false) {
  return redis(writeCommand(sample, now, false, monitor));
}
// Gradually import real pre-deploy observations. The chronological cursor and separate
// ledger let live pings continue while retries replay an unfinished batch safely.
export async function importLegacy() {
  const [first, cursor] = await redis(['MGET', prefix + 'first', prefix + 'legacy-cursor']);
  if (!first || cursor === 'done') return;
  const rows = await redis([
    'ZRANGEBYSCORE',
    'health:log',
    '(' + (cursor || 0),
    '(' + first,
    'LIMIT',
    '0',
    '240'
  ]);
  const samples = rows.map(JSON.parse);
  if (samples.length) {
    const commands = samples.map(({ at, checks, status }) =>
      writeCommand(
        {
          checked_at: new Date(at).toISOString(),
          status,
          checks: Object.fromEntries(
            Object.entries(checks).map(([key, [ok, ms]]) => [
              key,
              { ok: ok === 2 ? null : Boolean(ok), ms }
            ])
          )
        },
        Date.now(),
        true
      )
    );
    await pipeline(commands);
  }
  // Only advance a matching cursor; overlapping importers cannot move it backwards.
  const next = samples.length < 240 ? 'done' : String(samples.at(-1).at);
  await redis([
    'EVAL',
    `
    if (redis.call('GET',KEYS[1]) or '0')==ARGV[1] then
      redis.call('SET',KEYS[1],ARGV[2],'EX',10368000)
      redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[3])
      if ARGV[2]=='done' then redis.call('EXPIRE',KEYS[2],172800) end
    end; return 1`,
    '2',
    prefix + 'legacy-cursor',
    'health:log',
    cursor || '0',
    next,
    next === 'done' ? '(' + first : next
  ]);
}
function dayKeys(at) {
  // Calendar arithmetic on the Brussels date, including 23- and 25-hour days.
  const today = Date.parse(calendar.format(at) + 'T12:00Z');
  return Array.from({ length: 90 }, (_, i) =>
    new Date(today - (89 - i) * DAY).toISOString().slice(0, 10)
  );
}
function incidentList(live, legacy, first) {
  const incidents = [
    ...Object.values(live?.open || {}),
    ...Object.values(live?.recent || {}),
    ...Object.values(legacy?.recent || {})
  ];
  for (const old of Object.values(legacy?.open || {})) {
    const next = incidents.find((i) => i.name === old.name && floor(i.start, STEP) === first);
    if (next) {
      next.start = old.start;
      next.worst = Math.max(next.worst, old.worst);
    } else incidents.push({ ...old, interrupted: true });
  }
  return incidents.sort((a, b) => b.start - a.start || a.name.localeCompare(b.name)).slice(0, 10);
}
export function emptyHistory(range, at = Date.now()) {
  return {
    range,
    built_at: at,
    status: 'unknown',
    checked_at: null,
    uptime: [null, null, null, null],
    days: dayKeys(at),
    times: [],
    step: range === '24h' ? STEP : HOUR,
    series: {},
    checks: [],
    incidents: []
  };
}
export async function history(at = Date.now(), range = '24h') {
  const result = emptyHistory(range, at),
    hour = floor(at, HOUR);
  const hourCount = range === '24h' ? 24 : ranges[range] / HOUR + 1;
  const hours = Array.from({ length: hourCount }, (_, i) => hour - (hourCount - 1 - i) * HOUR);
  const [raw, hourly, daily, meta] = await pipeline([
    ['ZRANGEBYSCORE', prefix + 'raw', String(at - DAY), String(at)],
    ['MGET', ...hours.map((h) => prefix + 'h:' + h)],
    ['MGET', ...result.days.map((d) => prefix + 'd:' + d)],
    ['MGET', 'health:last', prefix + 'ledger', prefix + 'legacy-ledger', prefix + 'first']
  ]);
  const points = raw.map(JSON.parse),
    byHour = hourly.map(parse),
    byDay = daily.map(parse);
  const [last, live, legacy, first] = meta.map(parse);
  const frames =
    range === '24h'
      ? points.map((p) => [p.at, p.cells])
      : hours.flatMap((t, i) => (byHour[i] && t + HOUR > at - ranges[range] ? [[t, byHour[i]]] : []));
  result.times = frames.map((f) => f[0]);
  for (const name of ['overall', ...names]) {
    // Fold 24h raw availability and aligned calendar/hour windows without averaging percentages.
    const rawCells = points.map((p) => p.cells[name]).filter(Boolean);
    const uptime = [
      rawCells.length ? (100 * sum(rawCells, 2)) / rawCells.length : null,
      pct(byDay.slice(-7).map((b) => b?.[name])),
      pct(byDay.slice(-30).map((b) => b?.[name])),
      pct(byDay.map((b) => b?.[name]))
    ];
    result.series[name] = frames.map(([, bucket]) => {
      const v = bucket[name];
      if (!v) return null;
      return range === '24h' ? [v[1], v[1], v[0]] : [Math.round(v[2] / v[0]), v[3], v[4]];
    });
    if (name === 'overall') {
      result.uptime = uptime;
      continue;
    }
    // Twenty-four hourly peaks retain spikes without shipping another full raw timeline.
    const spark = byHour.slice(-24).map((b) => (b?.[name] ? [b[name][3], b[name][4]] : null));
    const month = byDay.slice(-30).map((b) => b?.[name]);
    const average = sum(month, 0) ? Math.round(sum(month, 2) / sum(month, 0)) : null;
    const lastIncident = Math.max(0, ...month.map((v) => v?.[6] || 0));
    result.checks.push({
      name,
      state: state(last?.checks?.[name]),
      uptime,
      spark,
      average,
      lastIncident: lastIncident ? new Date(lastIncident).toISOString() : null,
      days: byDay.map((b) => {
        const v = b?.[name];
        return v ? [v[4], (100 * v[1]) / v[0], Math.round(v[2] / v[0]), v[5]] : null;
      })
    });
  }
  result.status = last?.status || 'unknown';
  result.checked_at = last?.checked_at || null;
  result.incidents = incidentList(live, legacy, first);
  return result;
}

const cacheKey = (range) => prefix + 'view:' + range;
async function refresh(range) {
  const body = await history(Date.now(), range);
  await pipeline([
    ['SET', cacheKey(range), JSON.stringify(body), 'EX', '3600'],
    ['SET', 'health:summary', JSON.stringify({ uptime: body.uptime[2] }), 'EX', '2592000']
  ]);
  return body;
}
const pending = new Map(),
  recent = new Map();
function rebuild(range) {
  if (!pending.has(range))
    pending.set(
      range,
      refresh(range)
        .then((body) => {
          recent.set(range, body);
          return body;
        })
        .finally(() => pending.delete(range))
    );
  return pending.get(range);
}
export default async function historyEndpoint(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  const range = req.query.range ?? '24h';
  if (typeof range !== 'string' || !Object.hasOwn(ranges, range))
    return res.status(400).json({ error: 'invalid range' });
  const { bounded } = await import('./_stats-snap.js');
  try {
    let body = parse(await bounded(redis(['GET', cacheKey(range)]), 600));
    if (!body) body = await bounded(rebuild(range), 2500);
    else if (Date.now() - body.built_at >= 60000)
      waitUntil(
        (async () => {
          if (await redis(['SET', prefix + 'refresh:' + range, '1', 'NX', 'EX', '10']))
            await rebuild(range);
        })().catch(() => {})
      );
    recent.set(range, body);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ ...body, storage_plaintext_until: plaintextExceptionUntil() });
  } catch {
    const saved = recent.get(range);
    const body = saved && Date.now() - saved.built_at < DAY ? { ...saved } : emptyHistory(range);
    // Preserve the current status even if the database holding its history goes down.
    const { liveStatus } = await import('./_stats-recovery.js');
    try {
      const live = await bounded(liveStatus(), 6500);
      body.status = live.status;
      body.checked_at = live.checked_at;
      body.checks = names.map((name) => ({
        ...body.checks.find((c) => c.name === name),
        name,
        state: state(live.checks.find((c) => c.name === name))
      }));
    } catch {
      /* The UI distinguishes an unavailable endpoint from an unsampled day. */
    }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    return res.status(200).json({ ...body, historyUnavailable: true, storage_plaintext_until: plaintextExceptionUntil() });
  }
}
