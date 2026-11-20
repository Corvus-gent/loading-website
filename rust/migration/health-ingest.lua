
 local at, slot, cells = tonumber(ARGV[1]), tonumber(ARGV[2]), cjson.decode(ARGV[3])
 local archive = ARGV[4] == '1'
 if not archive then
   local latest=redis.call('GET',KEYS[6])
   if not latest or cjson.decode(latest).checked_at<ARGV[10] then
     redis.call('SET',KEYS[6],ARGV[9],'EX',2592000)
   end
 end
 local first = tonumber(redis.call('GET', KEYS[5]) or '0')
 if archive and (first == 0 or slot >= first) then return 0 end
 local ledger = cjson.decode(redis.call('GET', KEYS[4]) or '{"slot":0,"open":{},"recent":[]}')
 local monitor = ARGV[11]=='1'
 if at <= (ledger.at or 0) then return 0 end
 if not monitor and (slot <= ledger.slot or at-(ledger.monitor or 0)<300000) then return 0 end
 if monitor then ledger.monitor=at end
 ledger.at=at
 for i=#ledger.recent,1,-1 do
   if ledger.recent[i].finish < at-10368000000 then table.remove(ledger.recent,i) end
 end
 for name,incident in pairs(ledger.open) do
   if incident.last < at-10368000000 then ledger.open[name]=nil end
 end
 if not archive and first == 0 then redis.call('SET', KEYS[5], slot, 'EX', 10368000) end
 ledger.slot = slot
 local hour = cjson.decode(redis.call('GET',KEYS[2]) or '{}')
 local day = cjson.decode(redis.call('GET',KEYS[3]) or '{}')
 local function accumulate(bucket, name, cell, started)
   local v=bucket[name] or {0,0,0,0,0,0}
   if started or (v[1]==0 and cell[1]>1) then v[6]=v[6]+1 end
   v[1]=v[1]+1; v[2]=v[2]+cell[3]; v[3]=v[3]+cell[2]
   v[7]=math.max(v[7] or 0,cell[1]==3 and at or 0)
   v[4]=math.max(v[4],cell[2]); v[5]=math.max(v[5],cell[1]); bucket[name]=v
 end
 for name, cell in pairs(cells) do
   local started=false
   if name~='overall' then
     local incident=ledger.open[name]
     if cell[1]>1 then
       if not incident then started=true;incident={name=name,start=at,worst=cell[1]};ledger.open[name]=incident end
       incident.worst=math.max(incident.worst,cell[1]);incident.last=at
     elseif incident then
       incident.finish=at;table.insert(ledger.recent,1,incident);ledger.open[name]=nil
       table.sort(ledger.recent,function(a,b) return a.start>b.start end)
       if #ledger.recent>10 then table.remove(ledger.recent) end
     end
   end
   accumulate(hour,name,cell,started);accumulate(day,name,cell,started)
 end
 redis.call('SET',KEYS[2],cjson.encode(hour),'PXAT',ARGV[5])
 redis.call('SET',KEYS[3],cjson.encode(day),'PXAT',ARGV[6])
 redis.call('SET',KEYS[4],cjson.encode(ledger),'EX',10368000)
 if at>=tonumber(ARGV[7]) then
   redis.call('ZADD',KEYS[1],at,ARGV[8]);redis.call('EXPIRE',KEYS[1],172800)
 end
 redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[7])
 return 1
