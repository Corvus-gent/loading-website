// Both clocks use IANA zones: the transatlantic gap changes on different DST dates.
export const ZONES={bx:'Europe/Brussels',sf:'America/Los_Angeles'};
const formatters=new Map();
export function localClock(at,zone){
 if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
 const p=Object.fromEntries(formatters.get(zone).formatToParts(new Date(at)).map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,hour:Number(p.hour)};
}
const wallStamp=c=>Date.parse(`${c.date}T${c.time}:00Z`);
export function clockPair(at=new Date()){
 const bx=localClock(at,ZONES.bx),sf=localClock(at,ZONES.sf);
 return {bx,sf,gap:(wallStamp(bx)-wallStamp(sf))/3600000};
}
// Return all valid instants for a wall time: none during a spring gap, two
// during a repeated autumn hour. Never silently move a logged hour to another.
export function localInstants(date,time,zone){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return [];
 const desired={date,time},stamp=wallStamp(desired);
 if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date)return [];
 const offsets=new Set([-36,0,36].map(h=>{
  const at=stamp+h*3600000;return wallStamp(localClock(at,zone))-at;
 }));
 return [...offsets].map(offset=>stamp-offset).filter(at=>{
  const c=localClock(at,zone);return c.date===date&&c.time===time;
 }).sort((a,b)=>a-b);
}
const loggedTimes=new Map();
export function sfLoggedTime(date,hour){
 if(!Number.isInteger(hour)||hour<0||hour>23)return 'invalid logged hour';
 const key=`${date}/${hour}`;
 if(loggedTimes.has(key))return loggedTimes.get(key);
 const instants=localInstants(date,`${String(hour).padStart(2,'0')}:00`,ZONES.bx);
 if(!instants.length)return 'no matching time · check bx date/hour';
 const values=instants.map(at=>{const c=localClock(at,ZONES.sf);return `${c.date} ${c.time}`;});
 const result=values.join(' or ')+(values.length>1?' · repeated bx hour':'');
 if(loggedTimes.size>=256)loggedTimes.delete(loggedTimes.keys().next().value);
 loggedTimes.set(key,result);return result;
}
