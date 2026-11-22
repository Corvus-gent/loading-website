-- Preserved atomic transaction from api/_army/_tolls.js.
local previous=tonumber(redis.call('GET',KEYS[1]) or '0');local target=tonumber(ARGV[1]);if ARGV[2]=='refunded' then target=-1 elseif previous==-1 then return 0 end;local delta=math.max(0,target)-math.max(0,previous);redis.call('SET',KEYS[1],target,'EX',ARGV[3]);redis.call('INCRBY',KEYS[2],delta);return delta
