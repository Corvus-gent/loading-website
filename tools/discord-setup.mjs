// No token is printed. Plan mode is offline; --apply requires an installed bot.
import {armyStore} from '../api/_army/_store.js';
import {armyDiscord,discordPlan,permissionFindings,roleAbove} from '../api/_army/_discord.js';
const args=process.argv.slice(2),value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined;
const apply=args.includes('--apply');
const guild=value('--guild')||process.env.DISCORD_GUILD_ID,owners=(value('--owners')||process.env.DISCORD_OWNER_IDS||'').split(',');
const store=armyStore(),discord=armyDiscord(store);
const bot=apply?(await discord.api('/users/@me')).id:value('--bot');
let config={guild,bot,owners,roles:{},channels:{}};
let plan=discordPlan(config);
if(!apply){
 console.log(JSON.stringify({dryRun:true,roles:plan.roles,channels:plan.channels,inviteCreators:'two explicit owner IDs, plus the bot for approved single-use invites'},null,2));
}else{
 const server=await discord.api('/guilds/'+guild);if(!owners.includes(server.owner_id))throw Error('guild owner must be one of the two authorised IDs');
 for(const uid of owners)await discord.api('/guilds/'+guild+'/members/'+uid);
 const roles=await discord.api('/guilds/'+guild+'/roles');
 config.restrictedBots=roles.filter(r=>r.tags?.bot_id&&r.tags.bot_id!==bot).map(r=>r.tags.bot_id);
 // Never give a human role ADMINISTRATOR; it would bypass the invite policy.
 const everyone=roles.find(r=>r.id===guild);
 await discord.api('/guilds/'+guild+'/roles/'+guild,{method:'PATCH',body:{permissions:String(BigInt(everyone.permissions)&~(9n|1024n|2048n|1048576n))}});
 for(const role of plan.roles){
  const matches=roles.filter(r=>r.name===role.name&&!r.managed);if(matches.length>1)throw Error('ambiguous role; reconcile before applying');
  const existing=matches[0],row=await discord.api('/guilds/'+guild+'/roles'+(existing?'/'+existing.id:''),{method:existing?'PATCH':'POST',body:role});config.roles[role.name]=row.id;
 }
 plan=discordPlan(config);const channels=await discord.api('/guilds/'+guild+'/channels');
 for(const channel of plan.channels){
  const matches=channels.filter(c=>c.name===channel.name);if(matches.length>1)throw Error('ambiguous channel; reconcile before applying');
  const existing=matches[0],row=await discord.api(existing?'/channels/'+existing.id:'/guilds/'+guild+'/channels',{method:existing?'PATCH':'POST',body:channel});config.channels[channel.name]=row.id;
 }
 // Block other integrations from creating invitations, including existing categories/channels.
 for(const channel of channels.filter(c=>!plan.channels.some(p=>p.name===c.name))){for(const id of config.restrictedBots)await discord.api('/channels/'+channel.id+'/permissions/'+id,{method:'PUT',body:{type:1,allow:'0',deny:'1'}});}
 for(const uid of owners)await discord.api('/guilds/'+guild+'/members/'+uid+'/roles/'+config.roles.imperator,{method:'PUT'});
 const [actualRoles,actualChannels]=await Promise.all([discord.api('/guilds/'+guild+'/roles'),discord.api('/guilds/'+guild+'/channels')]);
 const botRoles=(await discord.api('/guilds/'+guild+'/members/'+bot)).roles;
 const top=actualRoles.filter(r=>botRoles.includes(r.id)).sort((a,b)=>roleAbove(a,b)?-1:1)[0];
 const findings=permissionFindings(config,actualRoles,actualChannels);
 for(const role of actualRoles.filter(r=>Object.values(config.roles).includes(r.id)))if(!roleAbove(top,role))findings.push('role:'+role.name+':above_bot');
 if(findings.length){console.log(JSON.stringify({state:'blocked',findings}));process.exitCode=1;}
 else{
  // Configuration is non-personal routing data. No bot credential is persisted.
  await store.run(['SET',store.key('discord:config'),JSON.stringify(config)]);
  await discord.api('/applications/'+process.env.DISCORD_APPLICATION_ID+'/guilds/'+guild+'/commands',{method:'PUT',body:[{name:'claim',description:'link your approved corvus account',type:1,options:[{name:'code',description:'the one-time code from your corvus account',type:3,required:true}]}]});
  console.log(JSON.stringify({state:'ready',roles:Object.keys(config.roles).length,channels:Object.keys(config.channels).length}));
 }
}
process.exit(process.exitCode||0);
