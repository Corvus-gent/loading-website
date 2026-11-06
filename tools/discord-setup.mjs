// No token is printed. Plan mode is offline; --apply requires an installed bot.
import {armyStore} from '../api/_army/_store.js';
import {armyDiscord,discordPlan,permissionFindings} from '../api/_army/_discord.js';
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
const apply=args.includes('--apply');
const guild=value('--guild'),owners=(value('--owners')||'').split(',');
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
 // Never give a human role ADMINISTRATOR; it would bypass the invite policy.
 const everyone=roles.find(r=>r.id===guild);
 await discord.api('/guilds/'+guild+'/roles/'+guild,{method:'PATCH',body:{permissions:String(BigInt(everyone.permissions)&~9n)}});
 for(const role of plan.roles){
  const matches=roles.filter(r=>r.name===role.name&&!r.managed);if(matches.length>1)throw Error('ambiguous role; reconcile before applying');
  const existing=matches[0],row=await discord.api('/guilds/'+guild+'/roles'+(existing?'/'+existing.id:''),{method:existing?'PATCH':'POST',body:role});config.roles[role.name]=row.id;
 }
 plan=discordPlan(config);const channels=await discord.api('/guilds/'+guild+'/channels');
 for(const channel of plan.channels){
  const matches=channels.filter(c=>c.name===channel.name);if(matches.length>1)throw Error('ambiguous channel; reconcile before applying');
  const existing=matches[0],row=await discord.api(existing?'/channels/'+existing.id:'/guilds/'+guild+'/channels',{method:existing?'PATCH':'POST',body:channel});config.channels[channel.name]=row.id;
 }
 for(const uid of owners)await discord.api('/guilds/'+guild+'/members/'+uid+'/roles/'+config.roles.imperator,{method:'PUT'});
 const [actualRoles,actualChannels]=await Promise.all([discord.api('/guilds/'+guild+'/roles'),discord.api('/guilds/'+guild+'/channels')]);
 const findings=permissionFindings(config,actualRoles,actualChannels);
 if(findings.length){console.log(JSON.stringify({state:'blocked',findings}));process.exitCode=1;}
 else{
  // Configuration is non-personal routing data. No bot credential is persisted.
  await store.run(['SET',store.key('discord:config'),JSON.stringify(config)]);
  await discord.api('/applications/'+process.env.DISCORD_APPLICATION_ID+'/guilds/'+guild+'/commands',{method:'PUT',body:[{name:'claim',description:'link your approved corvus account',type:1,options:[{name:'code',description:'the one-time code from your corvus account',type:3,required:true}]}]});
  console.log(JSON.stringify({state:'ready',roles:Object.keys(config.roles).length,channels:Object.keys(config.channels).length}));
 }
}
process.exit(process.exitCode||0);
