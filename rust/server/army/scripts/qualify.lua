-- Preserved atomic transaction from api/_army/_store.js.
local c=redis.call('GET',KEYS[1]);local p=redis.call('GET',KEYS[2]);if not c or not p then return 0 end
local child=cjson.decode(c);local parent=cjson.decode(p)
if child.status=='deleting' or parent.status=='deleting' or child.parent or child.existingBrowser or child.id==parent.id or not child.referral or child.referral.code~=parent.code then return 0 end
if tonumber(redis.call('GET',KEYS[4]) or '0')>=10 or redis.call('EXISTS',KEYS[5])==1 or redis.call('EXISTS',KEYS[6])==1 then return 0 end
child.parent=parent.id;child.qualifiedAt=ARGV[1];child.creditWeek=ARGV[4];child.referral=nil;parent.recruits=(parent.recruits or 0)+1
redis.call('SET',KEYS[1],cjson.encode(child),'KEEPTTL');redis.call('SET',KEYS[2],cjson.encode(parent),'KEEPTTL')
redis.call('HSET',KEYS[3],ARGV[2],ARGV[1]);redis.call('EXPIRE',KEYS[3],ARGV[6]);redis.call('INCR',KEYS[4]);redis.call('EXPIRE',KEYS[4],86400)
redis.call('SET',KEYS[5],'1','EX',86400);redis.call('SET',KEYS[6],'1','EX',ARGV[6]);redis.call('SADD',KEYS[7],KEYS[6]);redis.call('EXPIRE',KEYS[7],ARGV[6]);redis.call('ZINCRBY',KEYS[8],1,ARGV[3]);redis.call('EXPIRE',KEYS[8],777600)
redis.call('SADD',KEYS[9],KEYS[3]);redis.call('EXPIRE',KEYS[9],ARGV[6]);return 1
