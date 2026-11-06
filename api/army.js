import {armyService} from './_army/_service.js';
import {sameOrigin,validCode,validID,cookie,rateHash} from './_army/_security.js';
import {getSession,safeEqual} from './_session.js';
import {connected} from './_redis.js';
import {cleanUsername,publicSoldier,publicLink,activeTier,TIERS} from '../js/army/domain.js';

export function createArmyHandler({service=armyService(),ready=connected,ownerSession=getSession,job}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  if(!ready())return res.status(503).json({error:'resting'});
  const q=req.query||{},body=req.body||{};
  try{
   if(q.job==='1'){
    if(!process.env.CRON_SECRET||!safeEqual(req.headers.authorization||'','Bearer '+process.env.CRON_SECRET))return res.status(401).json({error:'unauthorized'});
    const run=job||(await import('./_army/_jobs.js')).armyJobs(service).run;
    return res.status(200).json(await run({dryRun:q.dry==='1'}));
   }
   if(q.unsubscribe!==undefined){
    if(!['GET','POST'].includes(req.method))return res.status(405).end();
    await service.auth.unsubscribe(q.unsubscribe);res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><meta name="referrer" content="no-referrer"><title>the crow is quiet</title><body style="background:#000;color:#ddd;font:18px monospace;padding:10vw"><h1>the crow is quiet.</h1><p>you are unsubscribed. that subscription is deleted.</p><a style="color:#ffd76a" href="/games/">back to the games →</a></body></html>');
   }
   if(q.ref!==undefined){
    if(req.method!=='GET'||!validCode(q.ref))return res.status(404).json({error:'missing'});
    const parent=await service.store.byCode(q.ref);if(!parent||parent.status==='deleting')return res.status(404).json({error:'missing'});
    if(!await service.store.rate('redirect',rateHash(req,'redirect',service.store.now()),60,60))return res.status(429).json({error:'rate'});
    // First touch wins for 30 days; only a signed code, never the referrer's identity.
    const {readCookie}=await import('./_army/_security.js');
    if(!readCookie(req,'army_ref','army_ref'))cookie(res,'army_ref',q.ref,30*86400);
    res.setHeader('Location',q.to==='games'?'/games/':'/join-the-army-now/');return res.status(307).end();
   }
   if(q.profile!==undefined){
    const user=await service.store.byName(cleanUsername(q.profile));
    if(!user?.verifiedAt||user.status==='deleting')return res.status(404).json({error:'missing'});
    if(q.image==='1')return (await import('./_army/_images.js')).serveImage(res,publicSoldier(user),user.code,q.poster==='1');
    if(q.html==='1')return (await import('./_army/_images.js')).serveProfile(res,publicSoldier(user));
    return res.status(200).json({soldier:publicSoldier(user),code:user.code});
   }
   if(q.admin==='1'){
    const owner=await ownerSession(req);if(owner?.email?.toLowerCase()!=='gabriel@corvus.gent')return res.status(403).json({error:'forbidden'});
    if(req.method==='GET')return res.status(200).json(await service.adminList(q));
    if(req.method!=='POST'||!sameOrigin(req))return res.status(403).json({error:'forbidden'});
    if(body.action==='flush-mail')return res.status(200).json(await service.mail.flush());
    if(body.action==='sync-tolls')return res.status(200).json(await (await import('./_army/_tolls.js')).bmcPayments(service.store).drain());
    if(body.action==='link-toll')return res.status(200).json(await (await import('./_army/_tolls.js')).linkToll(service.store,body.payment,body.username));
    if(!validID(body.id))return res.status(400).json({error:'fields'});
    return res.status(200).json(await service.admin(body.action,body.id,body));
   }
   if(req.method==='GET'){
    if(q.view==='legion'){
     const cached=await service.store.get('legion');if(cached)return res.status(200).json(cached);
     const revision=await service.store.run(['GET',service.store.key('revision')])||'0';
     const users=(await service.store.all()).filter(s=>s.verifiedAt&&s.username&&!s.hidden&&s.status!=='deleting');
     const members=users.map(s=>{const {username,tier,rank,country,link,created}=publicSoldier(s);return {username,tier,rank,country,link,created};}).sort((a,b)=>(TIERS.indexOf(b.tier)-TIERS.indexOf(a.tier))||a.created.localeCompare(b.created));
     const result={updated:new Date().toISOString(),members};
     await service.store.run(['EVAL',"if (redis.call('GET',KEYS[1]) or '0')==ARGV[1] then redis.call('SET',KEYS[2],ARGV[2],'EX',30);return 1 end;return 0",2,service.store.key('revision'),service.store.key('legion'),revision,JSON.stringify(result)]);
     return res.status(200).json(result);
    }
    if(q.view==='public')return res.status(200).json(await service.publicAPI.summary());
    const user=await service.identity(req,res),logged=await service.auth.session(req);
    return res.status(200).json({self:await service.self(user,!!logged)});
   }
   if(req.method!=='POST')return res.status(405).json({error:'method'});
   if(!sameOrigin(req))return res.status(403).json({error:'forbidden'});
   if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>5000)return res.status(400).json({error:'fields'});
   if(body.action==='begin')return res.status(200).json({self:await service.self(await service.identity(req,res,{create:true}),!!await service.auth.session(req))});
   if(body.action==='challenge')return res.status(200).json(await service.challenge(req,res,body.for));
   if(body.action==='claim')return res.status(200).json(await service.claim(req,res,body.token));
   if(body.action==='discord-code'){
    const user=await service.auth.session(req);if(!user)return res.status(401).json({error:'login'});
    return res.status(200).json(await (await import('./_army/_discord.js')).armyDiscord(service.store).issue(user));
   }
   if(body.action==='profile'){
    const user=await service.auth.session(req);if(!user)return res.status(401).json({error:'login'});
    await service.store.lock(user.id,async()=>{const current=await service.store.getUser(user.id);current.link=publicLink(body.link);current.country=typeof body.country==='string'&&/^[A-Z]{2}$/.test(body.country)?body.country:null;current.hidden=body.hidden===true;await service.store.persist(current);});
    return res.status(200).json({self:await service.self(await service.store.getUser(user.id),true)});
   }
   if(['export','delete','logout'].includes(body.action)){
    let user=await service.auth.session(req);
    if(!user){const anon=await service.identity(req,res);if(anon&&!anon.email)user=anon;}
    if(!user)return res.status(401).json({error:'login'});
    if(body.action==='export')return res.status(200).json(await service.store.exportData(user.id));
    if(body.action==='delete'){
     if(body.confirm!==true)return res.status(400).json({error:'confirm'});
     await service.store.remove(user.id);for(const name of ['army_id','army_session','army_ref'])cookie(res,name,'',0);
    }else cookie(res,'army_session','',0);
    return res.status(200).json({ok:true});
   }
   return res.status(200).json(await service.submit(req,res,body));
  }catch(error){
   const code=['fields','username','email','link','why','action','verification','expired','session','already_enlisted','unavailable_name_or_email','unverified','missing','feather'].includes(error.message)?error.message:error.message==='login'?'login':error.message==='rate'?'rate':error.message==='busy'?'busy':'resting';
   if(code==='rate')res.setHeader('Retry-After','60');
   return res.status(code==='login'?401:code==='rate'?429:code==='busy'?409:code==='resting'?503:400).json({error:code});
  }
 };
}
export default createArmyHandler();
