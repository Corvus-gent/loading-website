import crypto from 'node:crypto';
import {activeTier,DAY} from '../../js/army/domain.js';
import {digest,seal,open} from './_security.js';
export const DISCORD_ROLES=['imperator','senator','legatus','centurio','miles','tiro','recruit (unverified)'];
export const DISCORD_CHANNELS=['the-gate','announcements','general','missions','bangers','build-in-public','sf','introductions','campfire','centurio-tent'];
const snowflake=value=>typeof value==='string'&&/^\d{15,22}$/.test(value);
export function verifyInteraction(raw,signature,timestamp,publicKey,now=Date.now()){
 if(!/^[a-f0-9]{128}$/i.test(signature||'')||!/^\d{10}$/.test(timestamp||'')||Math.abs(now-Number(timestamp)*1000)>300000||!/^[a-f0-9]{64}$/i.test(publicKey||''))return false;
 try{return crypto.verify(null,Buffer.concat([Buffer.from(timestamp),raw]),crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(publicKey,'hex')]),format:'der',type:'spki'}),Buffer.from(signature,'hex'));}catch{return false;}
}
export const roleAbove=(a,b)=>a.position>b.position||a.position===b.position&&BigInt(a.id)<BigInt(b.id);
export function discordPlan({guild,bot,owners,roles={},restrictedBots=[]}){
 if(!snowflake(guild)||!snowflake(bot)||!Array.isArray(owners)||owners.length!==2||new Set(owners).size!==2||owners.some(id=>!snowflake(id)))throw Error('discord_configuration');
 const memberRoles=DISCORD_ROLES.filter(name=>name!=='recruit (unverified)');
 return {
  roles:DISCORD_ROLES.map((name,i)=>({name,permissions:'0',color:[0xffd76a,0xd7ae59,0xb8862b,0x96805a,0x777777,0x555555,0x333333][i],hoist:false,mentionable:false})),
  channels:DISCORD_CHANNELS.map(name=>{
   const gate=name==='the-gate',announcement=name==='announcements',tent=name==='centurio-tent';
   const allowed=tent?['imperator','senator','legatus','centurio']:memberRoles;
   const overwrites=[{id:guild,type:0,deny:gate?'2049':'1025',allow:gate?'2147550208':'0'},
    ...restrictedBots.map(id=>({id,type:1,allow:'0',deny:'1'})),...owners.map(id=>({id,type:1,allow:'3073',deny:'0'})),{id:bot,type:1,allow:'3073',deny:'0'},
    ...allowed.filter(n=>roles[n]).map(n=>({id:roles[n],type:0,allow:name==='campfire'?'3146752':announcement&&n!=='imperator'?'1024':'3072',deny:announcement&&n!=='imperator'?'2049':'1'}))];
   if(gate)for(const row of overwrites.filter(x=>x.type===0))row.deny=String(BigInt(row.deny)|2048n);
   return {name,type:name==='campfire'?2:0,permission_overwrites:overwrites};
  })
 };
}
export function permissionFindings(config,roles,channels){
 const allowed=new Set([...config.owners,config.bot]),findings=[];
 for(const role of roles){
  if(role.tags?.bot_id===config.bot)continue;
  const permissions=BigInt(role.permissions||'0');
  const blockedBot=role.tags?.bot_id&&config.restrictedBots?.includes(role.tags.bot_id)&&channels.every(c=>(c.permission_overwrites||[]).some(o=>o.type===1&&o.id===role.tags.bot_id&&(BigInt(o.deny||'0')&1n)));
  if(permissions&8n||permissions&1n&&!blockedBot)findings.push('role:'+role.id+':invite_or_admin');
 }
 for(const channel of channels)for(const row of channel.permission_overwrites||[]){
  if(BigInt(row.allow||'0')&1n && !(row.type===1&&allowed.has(row.id)))findings.push('channel:'+channel.id+':invite_override');
 }
 return findings;
}
export function armyDiscord(store,{request=fetch,token=()=>process.env.DISCORD_BOT_TOKEN}={}){
 async function api(path,{method='GET',body}={}){
  if(!token())throw Error('discord_not_configured');
  const response=await request('https://discord.com/api/v10'+path,{method,redirect:'error',signal:AbortSignal.timeout(6000),headers:{Authorization:'Bot '+token(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error(response.status===429?'discord_rate':'discord_http_'+response.status);
  return response.status===204?null:response.json();
 }
 async function configuration(){const c=await store.get('discord:config');if(!token()||!c?.guild||!c?.channels?.['the-gate'])throw Error('discord_not_configured');return c;}
 async function invite(user,{dryRun=false}={}){
  if(!token()||user.status!=='approved')return null;
  if(dryRun)return 'https://discord.gg/preview-only';
  const config=await configuration(),suffix='discord:invite:'+user.id,cached=await store.get(suffix);
  if(cached&&cached.until>store.now()+60000)return open(cached.secret);
  const value=await api('/channels/'+config.channels['the-gate']+'/invites',{method:'POST',body:{max_age:604800,max_uses:1,unique:true}});
  if(!/^[a-zA-Z0-9-]{2,100}$/.test(value.code||''))throw Error('discord_unavailable');
  const url='https://discord.gg/'+value.code;await store.own(user.id,suffix,{secret:seal(url),until:store.now()+7*DAY*1000},7*DAY);
  const week=new Date(store.now()).toISOString().slice(0,10);await store.run(['INCR',store.key('discord:invites:'+week)]);await store.run(['EXPIRE',store.key('discord:invites:'+week),120*DAY]);return url;
 }
 async function issue(user){
  await configuration();if(!user.verifiedAt||user.status!=='approved')throw Error('unverified');
  if(!await store.rate('discord-code',user.id,5,600))throw Error('rate');
  const code=crypto.randomBytes(12).toString('hex');
  await store.own(user.id,'discord:code:'+digest(code),{uid:user.id},600);return {code,expires:600};
 }
 async function sync(user){
  if(!user.discordId||!snowflake(user.discordId))return {skipped:true};
  const config=await configuration(),member=await api('/guilds/'+config.guild+'/members/'+user.discordId),wanted=user.status==='approved'?(activeTier(user,store.now())||'tiro'):'recruit (unverified)';
  const role=config.roles[wanted];if(!role)throw Error('discord_configuration');
  const managed=new Set(Object.values(config.roles));
  for(const old of member.roles.filter(id=>managed.has(id)&&id!==role))await api('/guilds/'+config.guild+'/members/'+user.discordId+'/roles/'+old,{method:'DELETE'});
  if(!member.roles.includes(role))await api('/guilds/'+config.guild+'/members/'+user.discordId+'/roles/'+role,{method:'PUT'});
  return {ok:true};
 }
 async function claim(code,discordId,guild){
  const config=await configuration();
  if(guild!==config.guild||!snowflake(discordId)||!/^[a-f0-9]{24}$/.test(code||''))throw Error('verification');
  const raw=await store.run(['GETDEL',store.key('discord:code:'+digest(code))]);if(!raw)throw Error('expired');
  const {uid}=JSON.parse(raw);
  return store.lock(uid,async()=>{
   const user=await store.getUser(uid);if(!user?.verifiedAt||user.status!=='approved'||user.discordId&&user.discordId!==discordId)throw Error('unverified');
   const owner=await store.get('discord:owner:'+discordId);if(owner&&owner!==uid)throw Error('verification');
   // Reserve the Discord identity once; a second site account cannot take it.
   const reserved=await store.run(['SET',store.key('discord:owner:'+discordId),JSON.stringify(uid),'NX','EX',Math.min(store.ttl(user),365*DAY)]);
   if(!reserved&&await store.get('discord:owner:'+discordId)!==uid)throw Error('verification');
   await store.own(uid,'discord:owner:'+discordId,uid,365*DAY);user.discordId=discordId;await store.persist(user);await sync(user);return {ok:true};
  });
 }
 async function audit(){
  if(!token())return {state:'not_configured'};
  const config=await configuration(),[roles,channels]=await Promise.all([api('/guilds/'+config.guild+'/roles'),api('/guilds/'+config.guild+'/channels')]);
  const findings=permissionFindings(config,roles,channels),result={state:findings.length?'unsafe':'ok',findings,checked:new Date(store.now()).toISOString()};
  await store.run(['SET',store.key('discord:audit'),JSON.stringify(result),'EX',2*DAY]);
  if(findings.length&&process.env.RESEND_API_KEY&&!await store.get('discord:alert')){
   const response=await request('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(6000),headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'discord-audit-'+new Date(store.now()).toISOString().slice(0,10)},body:JSON.stringify({from:'the crow <crow@corvus.gent>',to:['gabriel@corvus.gent'],subject:'corvus: discord invite permissions changed',text:'the daily audit found '+findings.length+' unsafe permission settings. review the legion section on your private dashboard.\n\n'+findings.join('\n')})});
   if(response.ok)await store.run(['SET',store.key('discord:alert'),JSON.stringify(true),'EX',DAY]);
  }
  return result;
 }
 async function refresh(users){
  if(!token())return {state:'not_configured',synced:0};
  const config=await configuration(),linked=users.filter(u=>u.discordId),offset=Number(await store.get('discord:sync-offset')||0)%Math.max(1,linked.length);
  let synced=0,failed=0;for(const user of [...linked.slice(offset),...linked.slice(0,offset)].slice(0,10)){try{await sync(user);synced++;}catch{failed++;}}
  await store.run(['SET',store.key('discord:sync-offset'),String((offset+10)%Math.max(1,linked.length)),'EX',DAY]);
  // Clean roles after account deletion/TTL expiry; no deleted person's ID needs to be retained in Redis.
  let removed=0;const after=await store.get('discord:member-cursor');
  const members=await api('/guilds/'+config.guild+'/members?limit=100'+(after?'&after='+after:''));
  const managed=new Set(Object.values(config.roles)),allowed=new Set([...config.owners,config.bot]);
  const managedMembers=members.filter(m=>!allowed.has(m.user.id)&&m.roles.some(id=>managed.has(id)&&id!==config.roles['recruit (unverified)']));
  const owners=managedMembers.length?await store.run(['MGET',...managedMembers.map(m=>store.key('discord:owner:'+m.user.id))]):[];
  for(let i=0;i<managedMembers.length;i++){
   const uid=owners[i]?JSON.parse(owners[i]):null,user=uid?await store.getUser(uid):null;if(user?.status==='approved')continue;
   const member=managedMembers[i];for(const role of member.roles.filter(id=>managed.has(id)))await api('/guilds/'+config.guild+'/members/'+member.user.id+'/roles/'+role,{method:'DELETE'});removed++;
  }
  await store.run(['SET',store.key('discord:member-cursor'),JSON.stringify(members.length===100?members.at(-1).user.id:null),'EX',DAY]);
  const last=await store.get('discord:audit');if(!last||Date.parse(last.checked)<store.now()-DAY*1000)await audit();
  return {synced,failed,removed};
 }
 async function respond(interaction){
  const config=await configuration();
  if(interaction.guild_id!==config.guild||interaction.data?.name!=='claim')throw Error('verification');
  const code=interaction.data.options?.find(o=>o.name==='code')?.value;
  await claim(code,interaction.member?.user?.id,interaction.guild_id);
  return 'linked. your place in the legion is ready.';
 }
 async function complete(interaction){
  let content;try{content=await respond(interaction);}catch{content='the code expired or could not be linked. get a fresh code on corvus.gent/army/access/.';}
  // Interaction token is used in memory only; never logged or stored.
  await request('https://discord.com/api/v10/webhooks/'+interaction.application_id+'/'+interaction.token+'/messages/@original',{method:'PATCH',redirect:'error',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json'},body:JSON.stringify({content,allowed_mentions:{parse:[]}})});
 }
 return {api,configuration,invite,issue,sync,claim,audit,refresh,complete};
}
