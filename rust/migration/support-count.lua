local fresh=1;for i=1,2 do if redis.call('EXISTS',KEYS[i])==1 then fresh=0 end end
redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('HINCRBY',KEYS[4],ARGV[1],1)
if fresh==1 then redis.call('SET',KEYS[1],'1','EX',1800);redis.call('HINCRBY',KEYS[5],ARGV[1],1);redis.call('HINCRBY',KEYS[6],ARGV[1],1) end;return fresh