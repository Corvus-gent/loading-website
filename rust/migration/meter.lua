
local now, limit, lease = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local previous = redis.call('HMGET', KEYS[1], 'at', 'used')
local last = tonumber(previous[1]) or now
now = math.max(now, last)
local used = tonumber(previous[2]) or 0
local active = redis.call('ZREVRANGE', KEYS[2], 0, 0, 'WITHSCORES')
local untilTime = tonumber(active[2]) or last
used = math.min(limit, used + math.max(0, math.min(now, untilTime) - last))
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if ARGV[5] == 'pause' then redis.call('ZREM', KEYS[2], ARGV[4])
elseif used < limit then redis.call('ZADD', KEYS[2], now + math.min(lease, limit-used), ARGV[4]) end
redis.call('HSET', KEYS[1], 'at', now, 'used', used)
redis.call('EXPIRE', KEYS[1], 172800)
redis.call('EXPIRE', KEYS[2], 172800)
return limit-used