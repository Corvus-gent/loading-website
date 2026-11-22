local n=tonumber(ARGV[1]);local k=n;local unique=1
if redis.call('SET',KEYS[k+9],ARGV[3],'NX') then
 local old=redis.call('HGETALL',KEYS[k+1]);for i=1,#old,2 do redis.call('HSET',KEYS[k+10],old[i],old[i+1]) end
end
for i=1,n do if redis.call('EXISTS',KEYS[i])==1 then unique=0 end end
redis.call('HINCRBY',KEYS[k+2],ARGV[2],1)
redis.call('ZREMRANGEBYSCORE',KEYS[k+6],'-inf',ARGV[8]);redis.call('ZADD',KEYS[k+6],ARGV[3],ARGV[4]);redis.call('EXPIREAT',KEYS[k+6],ARGV[12])
redis.call('HINCRBY',KEYS[k+7],'r|'..ARGV[5],1);redis.call('ZADD',KEYS[k+8],ARGV[10],ARGV[9])
if unique==1 then
 redis.call('SET',KEYS[1],'1','EX',1800)
 redis.call('HINCRBY',KEYS[k+1],ARGV[2],1);redis.call('HINCRBY',KEYS[k+3],ARGV[6],1);redis.call('HINCRBY',KEYS[k+4],ARGV[7],1)
 redis.call('ZREMRANGEBYSCORE',KEYS[k+5],'-inf',ARGV[11]);redis.call('ZADD',KEYS[k+5],ARGV[3],ARGV[4]);redis.call('EXPIRE',KEYS[k+5],90000)
 redis.call('HINCRBY',KEYS[k+7],'u|'..ARGV[5],1)
end
return unique