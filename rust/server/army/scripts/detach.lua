-- Preserved atomic transaction from api/_army/_store.js.
if redis.call('HDEL',KEYS[1],ARGV[1])==0 then return 0 end
local raw=redis.call('GET',KEYS[2]);if raw then local p=cjson.decode(raw);p.recruits=math.max(0,(p.recruits or 0)-1);redis.call('SET',KEYS[2],cjson.encode(p),'KEEPTTL') end
if redis.call('EXISTS',KEYS[3])==1 then redis.call('ZINCRBY',KEYS[3],-1,ARGV[2]) end;return 1
