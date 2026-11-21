
local n=tonumber(ARGV[1]);local row=cjson.decode(ARGV[2]);local previous=nil;local oldPhoto=''
if n==0 then
 local retry=redis.call('GET',KEYS[4]);if retry then local d=cjson.decode(retry);if d.hash~=ARGV[8] then return {-3,''} end;local existing=redis.call('GET',ARGV[3]..d.n);if not existing then return {-2,''} end;return {0,existing} end
 if redis.call('HLEN',KEYS[1])>=1000 then return {-4,''} end
 n=tonumber(redis.call('GET',KEYS[3]) or '0');for _,slug in ipairs(redis.call('HKEYS',KEYS[1])) do local x=tonumber(string.match(slug,'^x%-gm%-en%-int(%d+)$'));if x and x>n then n=x end end;n=n+1;if n>9999 then return {-4,''} end
 redis.call('SET',KEYS[3],n)
else
 local old=redis.call('GET',ARGV[3]..n);if not old then return {-2,''} end;previous=cjson.decode(old);if previous.updated_at~=ARGV[6] then return {-3,''} end
 row.created_at=previous.created_at;row.created_ms=previous.created_ms or tonumber(ARGV[5]);row.consent_at=previous.consent_at;oldPhoto=previous.photo_url or '';if ARGV[7]=='keep' then row.photo_url=oldPhoto end
end
row.n=n;row.slug='x-gm-en-int'..n
local videoRaw=redis.call('HGET',KEYS[1],row.slug);local video=videoRaw and cjson.decode(videoRaw) or {slug=row.slug,platform='x',account='gm',lang='en',hook='int',n=n,post_url='',compound_url='',views=0,likes=0,comments=0,shares=0,is_example=false,awaiting_url=true,metric_source='pending'}
video.interview_n=n;video.interview_clip_url=row.clip_url;video.updated_at=row.updated_at
local encoded=cjson.encode(row);redis.call('SET',ARGV[3]..n,encoded,'EX',ARGV[4]);redis.call('ZADD',KEYS[2],row.created_ms,n);redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',tonumber(ARGV[5])-tonumber(ARGV[4])*1000);redis.call('EXPIRE',KEYS[2],ARGV[4]);redis.call('HSET',KEYS[1],row.slug,cjson.encode(video))
if ARGV[1]=='0' then redis.call('SET',KEYS[4],cjson.encode({n=n,hash=ARGV[8]}),'EX',86400) end
return {1,encoded,oldPhoto}
