import {bmcPayments} from './_tolls.js';
import {dayKey,weekKey,DAY,activeTier} from '../../js/army/domain.js';
import {armyDiscord} from './_discord.js';
import {digest} from './_security.js';
export function armyJobs(service){
 const {store,auth,mail}=service;
 async function run({dryRun=false}={}){return store.lock('jobs',async()=>{
  const now=store.now(),day=dayKey(now),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',hour12:false}).format(now));
  const users=await store.all();let queued=0;
  // Keep active entitlements alive, including lifetime senators; every record still has a TTL.
  if(!dryRun)for(const user of users)if(activeTier(user,now)&&Date.parse(user.expires)<now+30*DAY*1000)await store.lock(user.id,async()=>{const latest=await store.getUser(user.id);if(latest&&latest.status!=='deleting'&&activeTier(latest,now)){latest.expires=new Date(now+365*DAY*1000).toISOString();await store.persist(latest);}});
  if(hour>=8){
   const number=Math.max(1,Math.round((Date.parse(day)-Date.parse('2026-11-04'))/86400000)+1),type=['babel','borders','wordle','flags','combo','bangle','pingle','lantern'][(number-1)%8];
   const sunday=new Date(day+'T12:00:00Z').getUTCDay()===0;
   for(const user of users.filter(u=>u.verifiedAt&&u.email&&u.status!=='deleting'))for(const kind of ['daily',...(sunday?['weekly']:[])]){
    const sub=await store.get('sub:'+user.id+':'+kind);if(!sub?.confirmed||sub.lastSent===day)continue;
    const jobID=digest('reminder:'+user.id+':'+kind+':'+day).slice(0,24);if(await store.get('mail:'+jobID))continue;
    if(!dryRun)await auth.queue(user.id,kind,{day,number,type,winner:'the legion',song:'https://corvus.gent/music/'},2*DAY,jobID);queued++;
   }
  }
  const payments=dryRun?{processed:0}:await bmcPayments(store).drain();
  const discord=dryRun?{state:'dry_run'}:await armyDiscord(store).refresh(users).catch(()=>({state:'retry'}));
  const delivery=await mail.flush({dryRun}).catch(()=>({state:'retry',sent:0}));
  const removed=dryRun?0:await store.cleanup();
  if(!dryRun)await store.run(['SET',store.key('job-last'),new Date(now).toISOString(),'EX',7*DAY]);
  return {dryRun,queued,payments,discord,delivery,removed};
 },60);}
 return {run};
}
