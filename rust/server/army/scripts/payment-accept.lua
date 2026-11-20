-- Preserved atomic transaction from api/_army/_tolls.js.
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
local record=cjson.decode(ARGV[1]);if record.uid~=cjson.null then local user=redis.call('GET',KEYS[4]);if not user or cjson.decode(user).status=='deleting' then record.uid=cjson.null;record.username=cjson.null else redis.call('SADD',KEYS[5],KEYS[2]);redis.call('EXPIRE',KEYS[5],31708800) end end
redis.call('SET',KEYS[1],'1','EX',ARGV[3]);redis.call('SET',KEYS[2],cjson.encode(record),'EX',ARGV[4]);redis.call('ZADD',KEYS[3],ARGV[2],ARGV[5]);return 1
