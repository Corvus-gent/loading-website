import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {retentionDay,rememberCompletion,todayCompletion,newsSince} from '../../js/site/daily-state.js';
import {nextRealmReset} from '../../js/realm-reset.js';
import {siteStrings} from '../../js/i18n/site-copy.js';
const original=process.env.TZ;
try{
 for(const zone of ['Europe/Brussels','America/Los_Angeles','Asia/Shanghai','Asia/Kolkata']){
  process.env.TZ=zone;
  for(const day of ['2026-03-08','2026-03-29','2026-10-25','2026-11-01','2026-11-12']){
   const before=new Date(day+'T04:01:59'),after=new Date(day+'T04:02:00');
   const saved={days:['2026-11-11'],streak:4};
   assert(rememberCompletion(saved,{done:true,day,streak:5},before));
   assert(todayCompletion(saved,before));assert.equal(todayCompletion(saved,after),null);
   assert.equal(retentionDay(after),day,zone+': 04:02 local');
   assert(!rememberCompletion(saved,{done:true,day,streak:5},after),'same puzzle cannot renew the card after reset');
   assert.equal(nextRealmReset(before).getTime(),after.getTime());
   assert.equal(saved.streak,4,'existing game stats untouched');
  }
 }
 const saved={};assert(!rememberCompletion(saved,{done:false,day:'2026-11-12',streak:2}));assert.deepEqual(saved,{});
 const entries=JSON.parse(await fs.readFile('data/daily-changelog.json','utf8'));
 assert(entries.length>=3&&entries.length<=5);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
 const now=Date.parse('2026-11-14T12:00Z'),last=Date.parse('2026-11-12T18:00Z');
 assert.equal(newsSince(entries,null,now).length,0,'first visit is quiet');
 assert.equal(newsSince(entries,now+1,now).length,0,'future visit ignored');
 assert.deepEqual(newsSince(entries,last,now).map(e=>e.id),['languages','map','flyer']);
 assert.equal(newsSince(entries,last,last).length,0,'no future announcements');
 for(const entry of entries){
  assert(entry.href.startsWith('/')&&!entry.href.startsWith('//'));assert(Number.isFinite(Date.parse(entry.published)));
  for(const lang of ['en','nl','es','fr','pt','de','zh'])assert(siteStrings(lang)[entry.key],lang+': translated changelog');
 }
 console.log('PASS: local 04:02 across four zones/DST, no duplicate renewal, game stats preserved, first/repeat visits and seven-language changelog.');
}finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
