import {nextRealmReset} from '../realm-reset.js';

// The retention card follows the realm's local 04:02 day, not the puzzle API's calendar.
export function retentionDay(now=new Date()) {
  const day=nextRealmReset(now);day.setDate(day.getDate()-1);
  return [day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
}
export function rememberCompletion(saved,state,now=new Date()) {
  if(!state?.done || !/^\d{4}-\d{2}-\d{2}$/.test(state.day) || saved.retention?.puzzleDay===state.day)return false;
  saved.retention={puzzleDay:state.day,day:retentionDay(now),streak:Number.isSafeInteger(state.streak)&&state.streak>=0?state.streak:0};
  return true;
}
export function todayCompletion(saved,now=new Date()) {
  const done=saved?.retention;
  return done?.day===retentionDay(now)&&Number.isSafeInteger(done.streak)&&done.streak>=0?done:null;
}
export function newsSince(entries,lastVisit,now=Date.now()) {
  if(!Number.isFinite(lastVisit)||lastVisit<=0||lastVisit>now)return [];
  return entries.filter(entry=>Date.parse(entry.published)>lastVisit&&Date.parse(entry.published)<=now)
    .sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));
}
