import crypto from 'node:crypto';
import {armyStore} from './_store.js';
import {armyAuth} from './_auth.js';
import {armyMail} from './_mail.js';
import {armyPublic} from './_public.js';
import {armyDiscord} from './_discord.js';
import {id,digest,readCookie,cookie,validID,validCode,rateHash,country} from './_security.js';
import {readVoter as gameVoter} from '../_music-security.js';
import {zeroBits} from '../_music-security.js';
import {publicSoldier,normalizeEmail,LANGUAGES,DAY,RETENTION,dayKey,priority} from '../../js/army/domain.js';

export function armyService({store=armyStore(),mailOptions={},bits=16}={}) {
  const auth=armyAuth(store),mail=armyMail(store,auth,mailOptions),publicAPI=armyPublic(store);
  async function identity(req,res,{create=false}={}) {
    const logged=await auth.session(req); if(logged)return logged;
    const uid=readCookie(req,'army_id','army_id');
    let user=validID(uid)?await store.getUser(uid):null;
    const vid=gameVoter(req);
    if(!user&&vid){const owner=await store.get('game-owner:'+digest(vid));if(owner)user=await store.getUser(owner);}
    if(!user&&create){
      if(!await store.rate('begin',rateHash(req,'begin',store.now()),30,600))throw Error('rate');
      const old=vid?await store.run(['GET','game:streak:'+vid]):null;
      user=await store.create({existingBrowser:!!old});
      if(old){try{const s=JSON.parse(old);user.streak=Math.max(0,Number(s.streak)||0);user.best=user.streak;await store.persist(user);}catch{}}
    }
    if(user&&create){
      cookie(res,'army_id',user.id,90*DAY);
      await store.seen(user.id,rateHash(req,'referral',store.now()));
      if(vid)await store.own(user.id,'game-owner:'+digest(vid),user.id,365*DAY);
      const ref=readCookie(req,'army_ref','army_ref');
      if(validCode(ref))await store.rememberReferral(user.id,ref,rateHash(req,'referral',store.now()));
    }
    return user;
  }
  async function self(user,logged=false){
    if(!user)return null;
    const subs=await Promise.all(['daily','weekly'].map(kind=>store.get('sub:'+user.id+':'+kind)));
    const referrer=user.referral?await store.byCode(user.referral.code):null;
    return {...publicSoldier(user),username:user.username||null,code:user.code,status:user.status,verified:!!user.verifiedAt,
      tollWaived:user.recruits>=3,paid:!!user.paid,canManage:logged,
      discordReady:!!process.env.DISCORD_BOT_TOKEN&&user.status==='approved',
      subscriptions:{daily:subs[0]?.confirmed||false,weekly:subs[1]?.confirmed||false},
      ...(logged?{email:user.email||'',why:user.why||'',expires:user.expires}:{}),
      referrer:referrer?.verifiedAt?referrer.username||null:null};
  }
  async function challenge(req,res,action){
    if(!['enlist','register','login','subscribe','feather'].includes(action))throw Error('action');
    const user=await identity(req,res,{create:true});
    if(!await store.rate('challenge',rateHash(req,'challenge',store.now()),30,600))throw Error('rate');
    const challenge={id:id(),salt:crypto.randomBytes(20).toString('hex'),bits,notBefore:store.now()+3000};
    await store.own(user.id,'challenge:'+challenge.id,{...challenge,uid:user.id,action},300);
    return {challenge,self:await self(user,!!await auth.session(req))};
  }
  async function verifyProof(req,body){
    const user=await identity(req,{},{});
    if(!user||!validID(body.challenge)||!Number.isSafeInteger(body.nonce)||body.nonce<0)throw Error('verification');
    const raw=await store.run(['GETDEL',store.key('challenge:'+body.challenge)]);
    if(!raw)throw Error('verification');const ch=JSON.parse(raw);
    if(ch.uid!==user.id||ch.action!==body.action||store.now()<ch.notBefore||zeroBits(crypto.createHash('sha256').update(ch.salt+':'+body.nonce).digest())<ch.bits)throw Error('verification');
    return user;
  }
  async function submit(req,res,body){
    if(body.website||JSON.stringify(body).length>5000)throw Error('fields');
    const user=await verifyProof(req,body);
    const ip=rateHash(req,body.action,store.now());
    if(!await store.rate(body.action,ip,body.action==='feather'?20:5,3600))throw Error('rate');
    if(body.action==='enlist'||body.action==='register'){
      if(user.verifiedAt&&!await auth.session(req))throw Error('login');
      const email=normalizeEmail(body.email);if(!await store.rate('mail',digest(email),3,3600))throw Error('rate');
      const enlisted=body.action==='enlist'?await store.enlist(user.id,body):await store.register(user.id,body);
      const {job}=await auth.issue(user.id);
      const delivery=await mail.flush({only:job}).catch(()=>({sent:0}));
      return {self:await self(enlisted),mail:delivery.sent?'sent':'queued'};
    }
    if(body.action==='login'){
      const email=normalizeEmail(body.email);
      if(!await store.rate('mail',digest(email),3,3600))throw Error('rate');
      const target=await store.byEmail(email);
      if(target){const {job}=await auth.issue(target.id);await mail.flush({only:job}).catch(()=>{});}
      return {ok:true}; // Same response for unknown addresses.
    }
    if(body.action==='subscribe'){
      if(!['daily','weekly'].includes(body.kind))throw Error('fields');
      const email=normalizeEmail(body.email),lang=LANGUAGES.includes(body.lang)?body.lang:'en';
      if(!await store.rate('subscription',digest(email),3,3600))throw Error('rate');
      let target=await store.byEmail(email);
      if(!target)target=await store.attachEmail(user.id,email,lang);
      const suffix='sub:'+target.id+':'+body.kind;
      const existing=await store.get(suffix);
      if(!existing?.confirmed){
        await store.own(target.id,suffix,{confirmed:false,lang,created:new Date(store.now()).toISOString(),lastSent:null},7*DAY);
        const {job}=await auth.issue(target.id,body.kind);await mail.flush({only:job}).catch(()=>{});
      }
      return {ok:true};
    }
    if(body.action==='feather')return {self:await self(await store.feather(user.id,body.spot))};
    throw Error('action');
  }
  async function claim(req,res,token){
    if(!await store.rate('claim',rateHash(req,'claim',store.now()),20,600))throw Error('rate');
    const result=await auth.consume(token,res);
    if(result.purpose==='claim'&&result.user.applied)await store.qualify(result.user.id,rateHash(req,'referral',store.now()));
    return {purpose:result.purpose,self:await self(await store.getUser(result.user.id),true)};
  }
  async function admin(action,uid,body={}){
    return store.lock(uid,async()=>{
      const user=await store.getUser(uid);if(!user?.applied)throw Error('missing');
      if(action==='approve'){
        if(!user.verifiedAt)throw Error('unverified');
        user.status='approved';user.expires=new Date(store.now()+RETENTION.member*DAY*1000).toISOString();
        await store.persist(user);
        if(!user.invitedAt)await auth.queue(uid,'welcome',{},RETENTION.member*DAY,digest('welcome:'+uid).slice(0,24));
      }else if(action==='reject'){
        await store.run(['ZREM',store.key('outbox'),digest('welcome:'+uid).slice(0,24)]);await store.run(['DEL',store.key('mail:'+digest('welcome:'+uid).slice(0,24))]);
        user.status='rejected';user.expires=new Date(store.now()+RETENTION.rejected*DAY*1000).toISOString();await store.persist(user);
        if(body.notify===true)await auth.queue(uid,'reject');
      }else if(action==='later'){
        user.status='later';user.expires=new Date(Date.parse(user.applied)+RETENTION.waiting*DAY*1000).toISOString();await store.persist(user);
      }else throw Error('action');
      return {ok:true};
    });
  }
  async function adminList(filters={}){
    let rows=(await store.all()).filter(s=>s.applied&&s.status!=='deleting');
    if(filters.status)rows=rows.filter(s=>s.status===filters.status);
    if(filters.paid==='1')rows=rows.filter(s=>s.paid);
    const search=String(filters.search||'').trim().toLowerCase().slice(0,100);
    if(search)rows=rows.filter(s=>(s.username+' '+s.email).toLowerCase().includes(search));
    rows.sort((a,b)=>priority(b)-priority(a)||a.applied.localeCompare(b.applied));
    const page=Math.max(0,Math.min(rows.length,Math.floor(Number(filters.offset)||0)));
    return {discordAudit:await store.get('discord:audit'),total:rows.length,rows:rows.slice(page,page+40).map(s=>({id:s.id,username:s.username,email:s.email,link:s.link,why:s.why,status:s.status,verified:!!s.verifiedAt,paid:!!s.paid,recruits:s.recruits,pidgyTrials:s.pidgyTrials||0,priority:priority(s),applied:s.applied,expires:s.expires,inviteSent:!!s.invitedAt})),mail:await store.get('mail-status'),discordReady:!!process.env.DISCORD_BOT_TOKEN,unmatched:await (await import('./_tolls.js')).bmcPayments(store).unmatched()};
  }
  return {store,auth,mail,publicAPI,identity,self,challenge,submit,claim,admin,adminList};
}
