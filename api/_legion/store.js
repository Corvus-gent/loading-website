import * as senate from './senate.js';
import {sendMail} from './mail.js';
import {redis,pipeline} from '../_redis.js';
import {armyStore} from '../_army/_store.js';
import {armyAuth} from '../_army/_auth.js';
import {id,recruitCode,digest,cookie} from '../_army/_security.js';
import {normalizeEmail,cleanUsername,validUsername,DAY,rank as earnedRank} from '../../js/army/domain.js';
import {LEGION_RANKS,RANK_MEANING} from '../../js/site/legion-config.js';
import {key,sha,token,validToken,clean} from './security.js';
export const army=()=>armyStore();
export const get=async k=>{const r=await redis(['GET',key(k)]);return r?JSON.parse(r):null;};
export const put=(k,value,seconds)=>redis(['SET',key(k),JSON.stringify(value),...(seconds?['EX',seconds]:[])]);
export const now=()=>new Date().toISOString();
export const memberRank=u=>earnedRank(u);
export const isMember=u=>!!u.legion||u.status==='approved'||!!u.verifiedAt&&!!u.membership&&u.membership.state!=='refunded';
export async function members(){const all=await army().all();return all.filter(u=>u.status!=='deleting'&&isMember(u)).map(u=>({id:u.id,name:u.legion?.name||u.username||'anonymous soldier',handle:u.username||'',email:u.email||'',rank:memberRank(u),source:u.legion?.source||(u.membership?'paid':'application'),joined_at:u.legion?.joined_at||u.approvedAt||u.verifiedAt||u.created,hidden:!!u.hidden,legacy:!u.legion,honorary:u.legion?.type==='honorary',title:u.legion?.title||'',spotlight_slug:u.legion?.spotlight_slug||''}));}
export async function createInvite(b,origin='https://corvus.gent'){
 if(!LEGION_RANKS.includes(b.rank))throw Error('rank');
 const honorary=b.type==='honorary';if(honorary&&(b.rank!=='senator'||Number(b.max_uses??1)!==1))throw Error('fields');
 const max=Number(b.max_uses??1),days=Number(b.days??30);if(!Number.isInteger(max)||max<1||max>100||!Number.isInteger(days)||days<1||days>90)throw Error('fields');
 const raw=token(),hash=sha(raw),entry={id:hash,rank:b.rank,name:clean(b.name,80),note:clean(b.note,600),max_uses:max,uses:0,expires_at:new Date(Date.now()+days*86400000).toISOString(),created_at:now(),opened_at:null,claimed_at:null,revoked_at:null};
 if(honorary){const p=await senate.reserve(b);Object.assign(entry,{type:'honorary',title:p.title,spotlight_slug:p.slug});}
 await put('invite:'+hash,entry,days*86400+90*86400);await redis(['ZADD',key('invites'),Date.now(),hash]);return {...entry,link:origin+'/legion/join/'+raw};
}
export async function invite(raw,{open=false}={}){
 if(!validToken(raw))throw Error('invite');const hash=sha(raw),entry=await get('invite:'+hash);
 if(!entry||entry.revoked_at||Date.parse(entry.expires_at)<=Date.now()||entry.uses>=entry.max_uses)throw Error('invite');
 if(open){await redis(['EVAL',`local s=redis.call('GET',KEYS[1]);if not s then return 0 end;local r=cjson.decode(s);if not r.opened_at or r.opened_at==cjson.null then r.opened_at=ARGV[1];redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL') end;return 1`,1,key('invite:'+hash),now()]);}
 return {type:entry.type||'standard',title:entry.title||'',spotlight_slug:entry.spotlight_slug||'',rank:entry.rank,name:entry.name,note:entry.note,meaning:RANK_MEANING[entry.rank],expires_at:entry.expires_at};
}
export async function invitations(){const ids=await redis(['ZREVRANGE',key('invites'),0,499]);const rows=ids.length?await pipeline(ids.map(x=>['GET',key('invite:'+x)])):[];return rows.filter(Boolean).map(JSON.parse);}
export async function revoke(id){if(!/^[a-f0-9]{64}$/.test(id||''))throw Error('fields');return redis(['EVAL',`local s=redis.call('GET',KEYS[1]);if not s then return 0 end;local r=cjson.decode(s);r.revoked_at=ARGV[1];redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1`,1,key('invite:'+id),now()]);}
// Admission is atomic with the invitation/payment receipt. Existing email accounts
// require their own signed session; an invitation must never become account takeover.
export async function admit({email,handle,name,rank,source,inviteToken,receipt,existingUid}){
 const s=army();email=normalizeEmail(email);let username=cleanUsername(handle);if(username&&!validUsername(username))throw Error('handle');
 const existing=await s.byEmail(email);if(existing&&source==='invite'&&existing.id!==existingUid)throw Error('account_login');
 if(existing&&source==='paid')existingUid=existing.id; // Credit payment; do not issue that account's session.
 if(existing&&existing.id!==existingUid)throw Error('account_login');
 const uid=existing?.id||id(),created=now(),code=existing?.code||recruitCode();if(source==='paid'&&!existing&&username&&await s.byName(username))username='';username=existing?.username||username||'soldier_'+uid.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12);
 const user=existing||{id:uid,code,created,status:'approved',streak:0,best:0,feathers:[],recruits:0,missionPoints:0,weeklyWins:0,username,email,lang:'en'};
 const ttl=365*DAY;user.expires=new Date(Date.now()+ttl*1000).toISOString();
 const grant=source==='paid'&&user.legion?user.legion:{rank,source,name:clean(name,80)||username,joined_at:user.legion?.joined_at||created,updated_at:created};
 const invitation=inviteToken?await get('invite:'+sha(inviteToken)):null;let editRaw='',spotlight=null;if(invitation?.type==='honorary'){const p=await senate.profile(invitation.spotlight_slug);if(!p||p.status!=='pending')throw Error('invite');editRaw=token();spotlight={...p,status:'active',member_uid:uid,email,edit_hash:sha(editRaw),revision:1,published_at:created,last_edited_at:created,last_edited_by:'Gabe'};Object.assign(grant,{type:'honorary',title:invitation.title,spotlight_slug:p.slug});}
 const gate=inviteToken?key('invite:'+sha(inviteToken)):key('payment:'+sha(receipt));
 const keys=[gate,s.key('u:'+uid),s.key('email:'+digest(email)),s.key('name:'+username),s.key('code:'+code),s.key('users'),s.key('owned:'+uid),s.key('revision'),s.key('legion'),s.key('public'),key('members'),key('spotlight:'+(spotlight?.slug||'unused')),key('spotlight-edit:'+(spotlight?.edit_hash||'unused')),key('spotlight-versions:'+(spotlight?.slug||'unused'))];
 const lua=`local gate=redis.call('GET',KEYS[1]);local method=ARGV[5]
if method=='invite' then if not gate then return 'invite' end;local i=cjson.decode(gate);if i.revoked_at~=cjson.null and i.revoked_at or i.uses>=i.max_uses or i.expires_at<=ARGV[7] then return 'invite' end;if i.rank~=ARGV[8] then return 'invite' end
else if gate then return 'duplicate' end end
if ARGV[12]~='' then local p=redis.call('GET',KEYS[12]);if not p or cjson.decode(p).status~='pending' then return 'invite' end end
local e=redis.call('GET',KEYS[3]);local n=redis.call('GET',KEYS[4]);if e and e~=ARGV[3] or n and n~=ARGV[3] then return 'account_login' end
local existing=redis.call('GET',KEYS[2]);local u=existing and cjson.decode(existing) or cjson.decode(ARGV[1]);if u.status=='deleting' then return 'account_login' end
if not (method=='paid' and u.legion) then u.legion=cjson.decode(ARGV[2]) end;u.expires=ARGV[9];u.status='approved';u.username=ARGV[10];u.email=ARGV[11]
redis.call('SET',KEYS[2],cjson.encode(u),'EX',ARGV[4]);for j=3,5 do redis.call('SET',KEYS[j],ARGV[3],'EX',ARGV[4]);redis.call('SADD',KEYS[7],KEYS[j]) end
redis.call('SADD',KEYS[7],KEYS[2]);redis.call('EXPIRE',KEYS[7],ARGV[4]);redis.call('ZADD',KEYS[6],ARGV[6]+ARGV[4]*1000,u.id);redis.call('SADD',KEYS[11],u.id)
if method=='invite' then local i=cjson.decode(gate);i.uses=i.uses+1;i.claimed_at=ARGV[7];redis.call('SET',KEYS[1],cjson.encode(i),'KEEPTTL') else redis.call('SET',KEYS[1],u.id,'EX',34560000) end
if ARGV[12]~='' then redis.call('SET',KEYS[12],ARGV[12]);redis.call('SET',KEYS[13],ARGV[13]);redis.call('RPUSH',KEYS[14],ARGV[14]) end
redis.call('INCR',KEYS[8]);redis.call('DEL',KEYS[9],KEYS[10]);return u.id`;
 const result=await redis(['EVAL',lua,keys.length,...keys,JSON.stringify(user),JSON.stringify(grant),JSON.stringify(uid),ttl,source,Date.now(),created,rank,user.expires,username,email,spotlight?JSON.stringify(spotlight):'',spotlight?.slug||'',spotlight?JSON.stringify({revision:1,content:spotlight.content,at:created,by:'Gabe'}):'']);
 if(result==='duplicate')return {duplicate:true};if(['invite','account_login'].includes(result))throw Error(result);
 return {user:await s.getUser(uid),newAccount:!existing,editRaw,spotlight};
}
export async function claim(req,res,b){
 const item=await invite(b.token),s=army(),session=await armyAuth(s).session(req);const result=await admit({email:b.email,handle:b.handle,name:item.name||b.handle,rank:item.rank,source:'invite',inviteToken:b.token,existingUid:session?.id});
 const sid=id();await s.own(result.user.id,'session:'+digest(sid),{uid:result.user.id},7*DAY);cookie(res,'army_session',sid,7*DAY);cookie(res,'army_id',result.user.id,90*DAY);
 let extra={};if(result.editRaw){const origin=process.env.VERCEL_ENV==='production'?'https://corvus.gent':req.headers.origin,edit_link=origin+'/legion/edit/'+result.editRaw;const mail=await sendMail({to:result.user.email,subject:'Your Corvus Senate seat · '+result.spotlight.title,text:'Welcome, '+result.user.legion.name+'.\n\nYour spotlight: '+origin+'/legion/senate/'+result.spotlight.slug+'\n\nYour private edit link (keep it private): '+edit_link+'\n\nThis link edits only your spotlight. Gabe can revoke it at any time.\n\nGabe'},'senate-'+result.user.id);extra={edit_link,email_sent:mail.ok,spotlight:'/legion/senate/'+result.spotlight.slug,title:result.spotlight.title};}
 return {...extra,ok:true,rank:result.user.legion.rank,name:result.user.legion.name,meaning:RANK_MEANING[result.user.legion.rank]};
}
export async function setRank(id,rank,source){if(!LEGION_RANKS.includes(rank))throw Error('rank');const s=army();return s.lock(id,async()=>{const u=await s.getUser(id);if(!u)throw Error('missing');u.legion={...(u.legion||{name:u.username,joined_at:now()}),rank,source:source||u.legion?.source||'invite',updated_at:now()};u.status='approved';u.expires=new Date(Math.max(Date.parse(u.expires),Date.now()+365*DAY*1000)).toISOString();await s.persist(u);return {ok:true};});}
