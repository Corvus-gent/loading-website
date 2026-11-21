-- Preserved atomic transaction from api/_army/_store.js.
local raw=redis.call('GET',KEYS[1]);if not raw then return -1 end
local user=cjson.decode(raw);if not user.verifiedAt or user.status=='deleting' then return -1 end
if redis.call('EXISTS',KEYS[2])==1 then return 0 end
user.approvedHelp=(user.approvedHelp or 0)+1
redis.call('SET',KEYS[1],cjson.encode(user),'KEEPTTL');redis.call('SET',KEYS[2],'true','EX',ARGV[1]);redis.call('SET',KEYS[3],ARGV[2],'EX',ARGV[3])
redis.call('SADD',KEYS[4],KEYS[2],KEYS[3]);redis.call('EXPIRE',KEYS[4],ARGV[4]);redis.call('INCR',KEYS[5]);redis.call('DEL',KEYS[6],KEYS[7]);return 1
