export const SF_START=Date.parse('2026-11-06T00:00:00-08:00');
export const SF_END=Date.parse('2026-11-16T00:00:00-08:00');
// Keep the existing bjj/intro IDs so older leads remain filterable.
export const SF_LETS=['coffee','walk','surf','bjj','skate','boulder','hike','studio','thrift','hackathon','demo','intro','other'];
export const SF_DAYS=Array.from({length:9},(_,i)=>`2026-11-${String(i+7).padStart(2,'0')}`);
export const dayIn=(at,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(new Date(at));
export function tripState(at=Date.now()){
 const day=dayIn(at,'America/Los_Angeles');
 return {phase:at<SF_START?'before':at<SF_END?'during':'after',day,number:Math.floor((Date.parse(day)-Date.parse('2026-11-06'))/86400000)+1,lands:Math.ceil((Date.parse('2026-11-06')-Date.parse(day))/86400000)};
}
export function sfLocationKey(at=Date.now()){
 const day=dayIn(at,'Europe/Brussels');
 return day<='2026-11-05'?'sf.packing':day==='2026-11-06'?'sf.flying':day<='2026-11-15'?'sf.founder':day==='2026-11-16'?'sf.returned':null;
}
