import { randomUUID } from 'node:crypto';
import { redis } from '../_redis.js';

const key = (kind, variant) => `oli:${kind}:${variant}`;
const parseRows = rows => (rows || []).map(JSON.parse);
const run = (script, keys, ...args) => redis(['EVAL', script, keys.length, ...keys, ...args]);
export const timelineFor = variant => redis(['GET', key('timeline', variant)]);

export async function state(variant) {
  const rows = await run(`
    local ids=redis.call('LRANGE',KEYS[3],0,99)
    local jobs={}
    for i,id in ipairs(ids) do jobs[i]=redis.call('HGET',KEYS[4],id) end
    return {redis.call('LRANGE',KEYS[1],0,-1),redis.call('LRANGE',KEYS[2],0,-1),jobs}
  `, [key('versions', variant), key('chat', variant), key('jobs', variant), 'oli:job-data']);
  return {
    versions: parseRows(rows[0]).map(({ path, label, changelog }) => ({
      label, changelog, url: `/api/oli/media?file=${encodeURIComponent(path)}`
    })),
    chat: parseRows(rows[1]).map(row => ({
      ...row, images: row.images?.map(path => `/api/oli/media?file=${encodeURIComponent(path)}`)
    })),
    jobs: parseRows(rows[2]).map(({ id, summary, status, label, reason }) => ({ id, summary, status, label, reason }))
  };
}

export const history = async variant => parseRows(await redis(['LRANGE', key('chat', variant), '-18', '-1']));

export function saveChat(variant, snapshot, user, reply, job) {
  const rejected = {
    content: 'The cut changed or already has an edit in progress. Send the edit again after the current render settles.',
    role: 'assistant', proposal: { summary: job?.summary, status: 'proposed' }
  };
  return run(`
    local queued=0
    local reply=ARGV[3]
    if ARGV[4]~='' then
      if redis.call('GET',KEYS[1])==ARGV[1] and redis.call('EXISTS',KEYS[2])==0 then
        local job=cjson.decode(ARGV[4])
        redis.call('HSET',KEYS[4],job.id,ARGV[4])
        redis.call('RPUSH',KEYS[5],ARGV[4])
        redis.call('LPUSH',KEYS[6],job.id)
        redis.call('SET',KEYS[2],job.id)
        queued=1
      else reply=ARGV[5] end
    end
    redis.call('RPUSH',KEYS[3],ARGV[2],reply)
    redis.call('LTRIM',KEYS[3],-200,-1)
    return queued
  `, [key('timeline', variant), key('pending', variant), key('chat', variant), 'oli:job-data', 'oli:jobs', key('jobs', variant)],
  snapshot || '', JSON.stringify(user), JSON.stringify(reply), job ? JSON.stringify(job) : '', JSON.stringify(rejected));
}

export async function claim() {
  const result = await run(`
    local now=tonumber(redis.call('TIME')[1])
    local id=redis.call('GET',KEYS[2])
    local job
    if id then
      job=cjson.decode(redis.call('HGET',KEYS[3],id))
      if job.deadline>now then return false end
    else
      local queued=redis.call('LPOP',KEYS[1])
      if not queued then return false end
      job=cjson.decode(queued)
      id=job.id
    end
    job.status='rendering'
    job.claim=ARGV[1]
    job.deadline=now+1800
    redis.call('HSET',KEYS[3],id,cjson.encode(job))
    redis.call('SET',KEYS[2],id)
    return {cjson.encode(job),redis.call('GET','oli:timeline:'..job.variant)}
  `, ['oli:jobs', 'oli:active', 'oli:job-data'], randomUUID());
  return result ? { ...JSON.parse(result[0]), timeline: JSON.parse(result[1]) } : null;
}

export function finish({ id, claim, status, path, changelog, timeline, reason }) {
  return run(`
    local raw=redis.call('HGET',KEYS[1],ARGV[1])
    if not raw then return 0 end
    local job=cjson.decode(raw)
    if job.claim~=ARGV[2] then return 0 end
    if job.status~='rendering' then
      if job.status==ARGV[3] and (job.status=='failed' or job.path==ARGV[4]) then return 1 end
      return 0
    end
    local suffix=':'..job.variant
    if ARGV[3]=='live' then
      if string.sub(ARGV[4],1,#job.variant+5)~='oli/'..job.variant..'/' then return 0 end
      local versions='oli:versions'..suffix
      local previous=cjson.decode(redis.call('LINDEX',versions,0))
      local number=tonumber(string.sub(previous.label,2))+1
      job.label='v'..number
      job.path=ARGV[4]
      redis.call('LPUSH',versions,cjson.encode({label=job.label,path=job.path,changelog=ARGV[5]}))
      redis.call('SET','oli:timeline'..suffix,ARGV[6])
    else job.reason=ARGV[7] end
    job.status=ARGV[3]
    redis.call('HSET',KEYS[1],job.id,cjson.encode(job))
    redis.call('DEL',KEYS[2],'oli:pending'..suffix)
    return 1
  `, ['oli:job-data', 'oli:active'], id, claim, status, path || '', changelog || '', JSON.stringify(timeline ?? null), reason || '');
}

export function seed(variant, timeline, version) {
  return run(`
    local first=redis.call('LINDEX',KEYS[2],-1)
    if first and cjson.decode(first).path==ARGV[3] then return 1 end
    if first or redis.call('EXISTS',KEYS[3])==1 then return 0 end
    redis.call('SET',KEYS[1],ARGV[1])
    redis.call('LPUSH',KEYS[2],ARGV[2])
    return 1
  `, [key('timeline', variant), key('versions', variant), key('pending', variant)],
  JSON.stringify(timeline), JSON.stringify(version), version.path);
}
