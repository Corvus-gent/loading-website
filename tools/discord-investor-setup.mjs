// Additive setup: touches only the investor role, war-council overwrites and routing config.
// Load secrets through the environment. No credentials or invite URLs are printed.
import {armyStore} from '../api/_army/_store.js';
import {armyDiscord,investorChannel,permissionFindings,roleAbove} from '../api/_army/_discord.js';
const apply=process.argv.includes('--apply'),store=armyStore(),discord=armyDiscord(store);
try{
 const config=await discord.configuration();
 const roles=await discord.api('/guilds/'+config.guild+'/roles');
 const channels=await discord.api('/guilds/'+config.guild+'/channels');
 const matches=roles.filter(r=>r.name==='investor'&&!r.managed),rooms=channels.filter(c=>c.name==='war-council');
 if(matches.length>1||rooms.length>1)throw Error('ambiguous investor configuration');
 if(!apply){console.log(JSON.stringify({mode:'plan',createRole:!matches.length,createChannel:!rooms.length,ownerCount:config.owners.length}));}
 else{
  const role=await discord.api('/guilds/'+config.guild+'/roles'+(matches[0]?'/'+matches[0].id:''),{method:matches[0]?'PATCH':'POST',body:{name:'investor',permissions:'0',color:0xb8862b,hoist:false,mentionable:false}});
  config.investorRole=role.id;delete config.roles.investor;
  const plan=investorChannel(config);
  const room=await discord.api(rooms[0]?'/channels/'+rooms[0].id:'/guilds/'+config.guild+'/channels',{method:rooms[0]?'PATCH':'POST',body:plan});
  config.channels['war-council']=room.id;
  const actualRoles=await discord.api('/guilds/'+config.guild+'/roles'),member=await discord.api('/guilds/'+config.guild+'/members/'+config.bot);
  const top=actualRoles.filter(r=>member.roles.includes(r.id)).sort((a,b)=>roleAbove(a,b)?-1:1)[0];
  if(!top||!roleAbove(top,actualRoles.find(r=>r.id===role.id)))throw Error('investor role must be below bot');
  const findings=permissionFindings(config,actualRoles,await discord.api('/guilds/'+config.guild+'/channels'));
  if(findings.length)throw Error('invite permission audit failed');
  await store.run(['SET',store.key('discord:config'),JSON.stringify(config)]);
  console.log(JSON.stringify({state:'ready',investorRole:true,privateWarCouncil:true,botAboveRole:true,inviteAudit:'ok',assignedMembers:0}));
 }
}catch(error){console.error(['discord_not_configured','ambiguous investor configuration','investor role must be below bot','invite permission audit failed'].includes(error.message)?error.message:'investor setup failed');process.exitCode=1;}
process.exit(process.exitCode||0);
