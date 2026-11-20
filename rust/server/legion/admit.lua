local gate=redis.call('GET',KEYS[1]);local method=ARGV[5]
if method=='invite' then if not gate then return 'invite' end;local i=cjson.decode(gate);if i.revoked_at~=cjson.null and i.revoked_at or i.uses>=i.max_uses or i.expires_at<=ARGV[7] then return 'invite' end;if i.rank~=ARGV[8] then return 'invite' end
else if gate then return 'duplicate' end end
if ARGV[12]~='' then local p=redis.call('GET',KEYS[12]);if not p or cjson.decode(p).status~='pending' then return 'invite' end end
local e=redis.call('GET',KEYS[3]);local n=redis.call('GET',KEYS[4]);if e and e~=ARGV[3] or n and n~=ARGV[3] then return 'account_login' end
local existing=redis.call('GET',KEYS[2]);local u=existing and cjson.decode(existing) or cjson.decode(ARGV[1]);if u.status=='deleting' then return 'account_login' end
if not (method=='paid' and u.legion) then u.legion=cjson.decode(ARGV[2]) end;u.expires=ARGV[9];u.status='approved';u.username=ARGV[10];u.email=ARGV[11]
redis.call('SET',KEYS[2],cjson.encode(u),'EX',ARGV[4]);for j=3,5 do redis.call('SET',KEYS[j],ARGV[3],'EX',ARGV[4]);redis.call('SADD',KEYS[7],KEYS[j]) end
redis.call('SADD',KEYS[7],KEYS[2]);redis.call('EXPIRE',KEYS[7],ARGV[4]);redis.call('ZADD',KEYS[6],ARGV[6]+ARGV[4]*1000,u.id);redis.call('SADD',KEYS[11],u.id)
if method=='invite' then local i=cjson.decode(gate);i.uses=i.uses+1;i.claimed_at=ARGV[7];redis.call('SET',KEYS[1],cjson.encode(i),'KEEPTTL') else redis.call('SET',KEYS[1],u.id,'EX',34560000) end
if ARGV[12]~='' then redis.call('SET',KEYS[12],ARGV[12]);redis.call('SET',KEYS[13],ARGV[13]);redis.call('RPUSH',KEYS[14],ARGV[14]) end
redis.call('INCR',KEYS[8]);redis.call('DEL',KEYS[9],KEYS[10]);return u.id
