import {open, seal, digest} from './_security.js';
import {dayKey, rank, DAY, LANGUAGES} from '../../js/army/domain.js';
import {mailCopy,fill} from './_copy.js';
import {armyDiscord} from './_discord.js';
const BASE = 'https://corvus.gent';
const localizedKinds = {en:['daily reminders','the weekly drop'],nl:['dagelijkse herinneringen','de wekelijkse drop'],es:['recordatorios diarios','la entrega semanal'],fr:['les rappels quotidiens','le rendez-vous hebdomadaire'],pt:['lembretes diários','a entrega semanal'],de:['tägliche erinnerungen','die wöchentliche lieferung'],zh:['每日提醒','每周来信']};
export function armyMail(store, auth, {request = fetch, apiKey = () => process.env.RESEND_API_KEY, invite = (user,options) => armyDiscord(store).invite(user,options)} = {}) {
  const sendRequest = (path, init = {}) => request('https://api.resend.com' + path, {redirect:'error',signal:AbortSignal.timeout(8000), ...init,
    headers:{Authorization:'Bearer ' + apiKey(), 'Content-Type':'application/json', ...init.headers}});
  const writeStatus = async value => store.run(['SET', store.key('mail-status'), JSON.stringify({...value,checked:new Date(store.now()).toISOString()}),'EX',7 * DAY]);
  async function quota() {
    const utc = new Date(store.now()).toISOString().slice(0,10), month = utc.slice(0,7);
    const local = await store.run(['MGET', store.key('mail-count:' + utc), store.key('mail-month:' + month)]);
    const conservative = Math.max(0,Math.min(100-Number(local[0]||0),3000-Number(local[1]||0)));
    try {
      const response = await sendRequest('/usage'); if (!response.ok) return {remaining:conservative,verified:false};
      const data = (await response.json()).emails;
      if (!data?.daily || !data?.monthly) return {remaining:conservative,verified:false};
      const available = row => row.limit === null ? 100 : Number.isFinite(row.limit)&&Number.isFinite(row.used) ? Math.max(0,row.limit-row.used) : 0;
      return {remaining:Math.min(100,available(data.daily),available(data.monthly)),verified:true};
    } catch { return {remaining:conservative,verified:false}; }
  }
  async function compose(job, user, {dryRun=false}={}) {
    const lang = LANGUAGES.includes(user.lang) ? user.lang : 'en', copy = await mailCopy(lang);
    const values = {...job.data,rank:rank(user),streak:user.streak||0};
    let kind = job.kind, unsub;
    if (kind === 'claim' || kind === 'confirm') {
      const token = open(job.data.secret);
      if (!await store.get('token:' + digest('token:' + token))) return null;
      values.url = BASE + '/army/access/#token=' + token;
      values.kind = localizedKinds[lang][job.data.purpose === 'weekly' ? 1 : 0];
    } else if (kind === 'welcome') {
      if (user.status !== 'approved') return null;
      const invitation=await invite(user,{dryRun});if(!invitation)return null;
      let url;try{url=new URL(invitation);}catch{return null;}
      if (url.protocol !== 'https:' || !['discord.gg','discord.com'].includes(url.hostname)) return null;
      values.url = url.href;
    } else if (kind === 'daily' || kind === 'weekly') {
      const sub = await store.get('sub:' + user.id + ':' + kind);
      if (!sub?.confirmed || sub.lastSent === job.data.day) return null;
      if (!sub.unsubscribeSecret && !dryRun) {
        sub.unsubscribeSecret = seal(await auth.unsubscribeToken(user.id,kind));
        await store.own(user.id,'sub:' + user.id + ':' + kind,sub,365*DAY);
      }
      unsub = BASE + '/api/army?unsubscribe=' + (dryRun?'preview-only':open(sub.unsubscribeSecret));
      values.unsubscribe = unsub;
      values.url = kind === 'daily' ? BASE + '/games/?utm_source=email&utm_medium=reminder&utm_campaign=gabe-daily-' + job.data.type : BASE + '/army/';
    } else values.url = BASE + '/army/access/';
    if (!copy[kind+'.subject'] || !copy[kind+'.body']) return null;
    return {from:(kind === 'weekly' ? 'diogenes' : 'the crow') + ' <crow@corvus.gent>',to:[user.email],subject:copy[kind+'.subject'],
      text:fill(copy[kind+'.body'],values), ...(unsub ? {headers:{'List-Unsubscribe':`<${unsub}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}} : {})};
  }
  async function finish(jobs) {
    const utc = new Date(store.now()).toISOString().slice(0,10), month = utc.slice(0,7);
    await store.run(['EVAL', `redis.call('INCRBY',KEYS[1],ARGV[1]);redis.call('EXPIRE',KEYS[1],34560000);redis.call('INCRBY',KEYS[2],ARGV[1]);redis.call('EXPIRE',KEYS[2],34560000);return 1`,2,store.key('mail-count:'+utc),store.key('mail-month:'+month),jobs.length]);
    for (const {id,job} of jobs) {
      const user = await store.getUser(job.uid);
      if (user && ['daily','weekly'].includes(job.kind)) {
        const sub = await store.get('sub:'+user.id+':'+job.kind);
        if(sub) {sub.lastSent=job.data.day;await store.own(user.id,'sub:'+user.id+':'+job.kind,sub,365*DAY);}
      }
      if(user && job.kind==='welcome') {user.invitedAt=new Date(store.now()).toISOString();await store.persist(user);}
      await store.run(['ZREM',store.key('outbox'),id]);
      await store.run(['DEL',store.key('mail:'+id)]);
    }
    await store.run(['DEL',store.key('mail-batch'),store.key('public')]);
  }
  async function flush({dryRun=false,only=null}={}) {
    return store.lock('mailer',async()=>{
      if(!apiKey()) {await writeStatus({state:'not_configured',waiting:Number(await store.run(['ZCARD',store.key('outbox')]))});return {sent:0,state:'not_configured'};}
      const budget=await quota();
      if(!budget.remaining) {const waiting=Number(await store.run(['ZCARD',store.key('outbox')]));await writeStatus({state:'quota',waiting,upgradeNeeded:waiting>0,...budget});return {sent:0,state:'quota',waiting};}
      let batch=await store.get('mail-batch');
      const ids=batch?.ids || (only?[only]:await store.run(['ZRANGE',store.key('outbox'),0,99]));
      const jobs=[];
      for(const id of ids) {
        const job=await store.get('mail:'+id),user=job&&await store.getUser(job.uid);
        if(!job||!user||job.expires<=store.now()) {if(!dryRun)await store.run(['ZREM',store.key('outbox'),id]);continue;}
        if(['daily','weekly'].includes(job.kind)&&!await store.get('sub:'+job.uid+':'+job.kind))continue;

        const payload=job.delivery?JSON.parse(open(job.delivery)):await compose(job,user,{dryRun});
        if(!payload)continue;
        if(!job.delivery&&!dryRun){job.delivery=seal(JSON.stringify(payload));await store.own(job.uid,'mail:'+id,job,Math.max(1,Math.ceil((job.expires-store.now())/1000)));}
        jobs.push({id,job,payload});
        if(!batch&&jobs.length>=Math.min(100,budget.remaining))break;
      }
      if(batch&&batch.ids.join(',')!==jobs.map(j=>j.id).join(',')) {
        // A deleted user or withdrawn consent must never be sent again. If a prior
        // delivery timed out, hold the remaining batch for operator review instead
        // of retrying it with a new idempotency key and risking duplicate mail.
        if(batch.uncertain) {await writeStatus({state:'review',waiting:jobs.length});return {sent:0,state:'review'};}
        batch=null;if(!dryRun)await store.run(['DEL',store.key('mail-batch')]);
      }
      if(dryRun)return {sent:0,wouldSend:jobs.length,queued:ids.length,remaining:budget.remaining,kinds:jobs.map(j=>j.job.kind)};
      if(!jobs.length){await writeStatus({state:process.env.DISCORD_BOT_TOKEN?'idle':'waiting_for_discord',waiting:Number(await store.run(['ZCARD',store.key('outbox')]))});return {sent:0,state:'idle'};}
      batch ||= {ids:jobs.map(j=>j.id),key:'army/'+digest(jobs.map(j=>j.id).join(':')),created:store.now(),uncertain:false};
      if(store.now()-batch.created>23*3600000){await writeStatus({state:'review',waiting:jobs.length});return {sent:0,state:'review'};}
      batch.uncertain=true;await store.run(['SET',store.key('mail-batch'),JSON.stringify(batch),'EX',2*DAY]);
      let response;
      try {response=await sendRequest('/emails/batch',{method:'POST',headers:{'Idempotency-Key':batch.key},body:JSON.stringify(jobs.map(j=>j.payload))});}
      catch {await writeStatus({state:'retry',waiting:jobs.length});return {sent:0,state:'retry'};}
      if(!response.ok){
        if(response.status===429){batch.uncertain=false;await store.run(['SET',store.key('mail-batch'),JSON.stringify(batch),'EX',2*DAY]);}
        await writeStatus({state:response.status===429?'quota':'retry',waiting:Number(await store.run(['ZCARD',store.key('outbox')])),providerStatus:response.status,upgradeNeeded:response.status===429});
        return {sent:0,state:response.status===429?'quota':'retry'};
      }
      const result=await response.json();
      if(!Array.isArray(result.data)||result.data.length!==jobs.length){await writeStatus({state:'review',waiting:jobs.length});return {sent:0,state:'review'};}
      await finish(jobs);
      const waiting=Number(await store.run(['ZCARD',store.key('outbox')]));
      await writeStatus({state:waiting?'queued':'ok',waiting,sent:jobs.length,remaining:Math.max(0,budget.remaining-jobs.length),quotaVerified:budget.verified});
      return {sent:jobs.length,waiting,state:'ok'};
    },60);
  }
  return {quota,compose,flush};
}
