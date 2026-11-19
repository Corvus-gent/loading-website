import { redis } from '../_redis.js';
const prefix = 'feedback:forms:v1:';
const rowKey = (slug, sessionId) => prefix + 'row:' + slug + ':' + sessionId;
const indexKey = slug => prefix + 'index:' + slug;
const parse = raw => raw ? JSON.parse(raw) : null;

// Timestamp comparison and write happen together: an older debounced request
// must never overwrite newer answers (including a final beacon).
const upsert = `
local raw=redis.call('GET',KEYS[1]); local row=raw and cjson.decode(raw) or nil
local incoming=cjson.decode(ARGV[1])
if row and row.updatedAt>=incoming.updatedAt then return raw end
incoming.createdAt=row and row.createdAt or incoming.receivedAt
incoming.lastEmailedHash=row and row.lastEmailedHash or cjson.null
incoming.lastEmailedAt=row and row.lastEmailedAt or cjson.null
local encoded=cjson.encode(incoming)
redis.call('SET',KEYS[1],encoded)
redis.call('ZADD',KEYS[2],ARGV[2],incoming.sessionId)
return encoded`;
const acknowledge = `
local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
local row=cjson.decode(raw)
row.lastEmailedHash=ARGV[1]; row.lastEmailedAt=ARGV[2]
redis.call('SET',KEYS[1],cjson.encode(row)); return 1`;

export function formStore(run = redis) {
  return {
    get: async (slug, id) => parse(await run(['GET', rowKey(slug, id)])),
    save: async row => parse(await run(['EVAL', upsert, 2, rowKey(row.slug, row.sessionId), indexKey(row.slug), JSON.stringify(row), Date.parse(row.receivedAt)])),
    async list(slug, since = '-inf') {
      const ids = await run(['ZRANGEBYSCORE', indexKey(slug), since, '+inf']);
      const rows = [];
      // Bound each Redis response; exports don't issue an unbounded MGET.
      for (let i = 0; i < ids.length; i += 100) {
        const batch = await run(['MGET', ...ids.slice(i, i + 100).map(id => rowKey(slug, id))]);
        rows.push(...batch.filter(Boolean).map(JSON.parse));
      }
      return rows;
    },
    emailed: (row, hash, at) => run(['EVAL', acknowledge, 1, rowKey(row.slug, row.sessionId), hash, at]),
    acquire: async (name, token) => !!await run(['SET', prefix + 'lock:' + name, token, 'NX', 'EX', 120]),
    release: (name, token) => run(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, prefix + 'lock:' + name, token]),
    delivered: async key => !!await run(['GET', prefix + 'delivered:' + key]),
    markDelivered: key => run(['SET', prefix + 'delivered:' + key, '1', 'EX', 172800])
  };
}
