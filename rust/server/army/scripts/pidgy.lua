-- Preserved atomic transaction from api/_army/_pidgy.js.
local raw=redis.call('GET',KEYS[3]);if not raw then return {-1,0} end
local user=cjson.decode(raw);if not user.verifiedAt or user.status=='deleting' then return {-1,0} end
if redis.call('EXISTS',KEYS[1])==1 then return {0,0} end
if redis.call('SET',KEYS[2],ARGV[1],'NX','EX',ARGV[2])==false then redis.call('SET',KEYS[1],'1','EX',ARGV[2]);return {0,0} end
redis.call('SET',KEYS[1],'1','EX',ARGV[2]);user.pidgyTrials=(user.pidgyTrials or 0)+1
redis.call('SET',KEYS[3],cjson.encode(user),'KEEPTTL');redis.call('SADD',KEYS[4],KEYS[2]);redis.call('EXPIRE',KEYS[4],ARGV[2]);redis.call('INCR',KEYS[5]);redis.call('DEL',KEYS[6],KEYS[7]);return {1,user.pidgyTrials}
