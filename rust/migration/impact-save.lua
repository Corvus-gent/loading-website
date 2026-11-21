if ARGV[4]=='1' and redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 0 end
if (redis.call('HGET',KEYS[1],ARGV[1]) or '')~=ARGV[2] then return -2 end
if redis.call('HLEN',KEYS[1])>=1200 and redis.call('HEXISTS',KEYS[1],ARGV[1])==0 then return -1 end
local changes=cjson.decode(ARGV[5]);for _,c in ipairs(changes) do if (redis.call('HGET',KEYS[2],c.slug) or '')~=c.old then return -2 end end
redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]);for _,c in ipairs(changes) do redis.call('HSET',KEYS[2],c.slug,c.next) end
if ARGV[6]~='' then redis.call('HSET',KEYS[4],ARGV[6],ARGV[7]);redis.call('EXPIRE',KEYS[4],31536000) end
redis.call('LPUSH',KEYS[3],ARGV[3]);redis.call('LTRIM',KEYS[3],0,1999);redis.call('EXPIRE',KEYS[3],31536000);return 1
