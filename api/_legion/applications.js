import {redis,pipeline} from '../_redis.js';
import {normalizeEmail} from '../../js/army/domain.js';
import {key,clean,sha,token} from './security.js';
import {get,put,now,admit,army,setRank} from './store.js';
import {sendMail} from './mail.js';
const targets={application:'miles',hack:'centurio',call:'legatus'};
export async function puzzle(answer){if(clean(answer,80).toLowerCase().replace(/[^a-z]/g,'')!=='thecrowopensdoors')throw Error('answer');const raw=token();await redis(['SET',key('puzzle:'+sha(raw)),'solved','EX',1800]);return {claim:raw};}
export async function apply(b){
 const source=Object.hasOwn(targets,b.source)?b.source:'application',who=clean(b.who,220),build=clean(b.build,600),why=clean(b.why,600),email=normalizeEmail(who.match(/[^\s<>]+@[^\s<>]+\.[^\s<>]+/)?.[0]);
 if(who.length<5||build.length<3||why.length<3)throw Error('fields');if(source==='hack'&&!await redis(['GET',key('puzzle:'+sha(b.claim||''))]))throw Error('answer');
 const dedupe=key('application-dedupe:'+sha(email+source));if(!await redis(['SET',dedupe,'1','NX','EX',86400]))return {ok:true,message:'Your claim is already with Gabe.'};
 const id=token(),row={id,who,email,build,why,source,rank:targets[source],status:'new',created_at:now()};await put('application:'+id,row,90*86400);await redis(['ZADD',key('applications'),Date.now(),id]);
 const notified=await sendMail({to:'gabriel@corvus.gent',subject:'Legion · '+targets[source]+' application',text:[who,'','Build: '+build,'','Why: '+why,'','Source: '+source,'Review in corvus.gent/admin'].join('\n')},'application-'+id);
 return {ok:true,notified:notified.ok,message:'Received. Gabe reads these himself.'};
}
export async function applications(){const ids=await redis(['ZREVRANGE',key('applications'),0,499]);const rows=ids.length?await pipeline(ids.map(id=>['GET',key('application:'+id)])):[];return rows.filter(Boolean).map(JSON.parse);}
export async function decide(id,decision){
 if(!['approve','decline'].includes(decision)||!/^[A-Za-z0-9_-]{43}$/.test(id||''))throw Error('fields');
 const lock=key('review:'+id),owner=token();if(!await redis(['SET',lock,owner,'NX','EX',30]))throw Error('busy');
 try{const row=await get('application:'+id);if(!row)throw Error('missing');if(row.status!=='new')return {ok:true};
 if(decision==='approve'){const s=army(),u=await s.byEmail(row.email);if(u)await setRank(u.id,row.rank,row.source);else await admit({email:row.email,name:row.who.replace(row.email,'').trim(),rank:row.rank,source:row.source,receipt:'application:'+id});}
 row.status=decision==='approve'?'approved':'declined';row.reviewed_at=now();await put('application:'+id,row,90*86400);return {ok:true};
 }finally{await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",1,lock,owner]);}
}
