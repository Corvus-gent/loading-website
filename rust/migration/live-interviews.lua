local saved=redis.call('GET',KEYS[1]);if saved then return {200,saved} end
local cooldown=redis.call('TTL',KEYS[2]);if cooldown>0 then return {429,tostring(cooldown)} end
if tonumber(redis.call('GET',KEYS[3]) or '0')>=3 then return {429,tostring(redis.call('TTL',KEYS[3]))} end
redis.call('INCR',KEYS[3]);if redis.call('TTL',KEYS[3])<0 then redis.call('EXPIRE',KEYS[3],3600) end
redis.call('SET',KEYS[2],'1','EX',60);redis.call('SET',KEYS[1],ARGV[1],'EX',1800)
redis.call('SET',KEYS[4],ARGV[2],'EX',ARGV[3]);redis.call('ZREMRANGEBYSCORE',KEYS[5],'-inf',ARGV[5])
redis.call('ZADD',KEYS[5],ARGV[4],ARGV[1]);redis.call('EXPIRE',KEYS[5],ARGV[3]);return {201,ARGV[1]}