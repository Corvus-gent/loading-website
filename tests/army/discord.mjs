import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createClient} from 'redis';
import {armyStore} from '../../api/_army/_store.js';
import {armyDiscord,discordPlan,permissionFindings,verifyInteraction,DISCORD_ROLES,roleAbove} from '../../api/_army/_discord.js';
import {interactionHandler} from '../../api/discord.js';
const guild='100000000000000001',bot='100000000000000002',owners=['100000000000000003','100000000000000004'],discordId='100000000000000005';
const roles=Object.fromEntries(DISCORD_ROLES.map((name,i)=>[name,'1000000000000000'+String(i+10)]));
const config={guild,bot,owners,roles,channels:{'the-gate':'100000000000000030'}},plan=discordPlan(config);
assert(roleAbove({id:'100',position:1},{id:'101',position:1}));assert(!roleAbove({id:'101',position:1},{id:'100',position:1}));assert.equal(plan.roles.length,7);assert.equal(plan.channels.length,10);
for(const role of plan.roles)assert.equal(BigInt(role.permissions)&9n,0n);
for(const channel of plan.channels)for(const row of channel.permission_overwrites)if(BigInt(row.allow)&1n)assert([bot,...owners].includes(row.id)&&row.type===1);
assert.deepEqual(permissionFindings(config,plan.roles,plan.channels),[]);
assert(permissionFindings(config,[{id:'bad',permissions:'8'}],[]).length);
assert(permissionFindings(config,[],[{id:'bad',permission_overwrites:[{id:discordId,type:1,allow:'1'}]}]).length);
const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519'),pub=publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex'),ts=String(Math.floor(Date.now()/1000));
const payload=Buffer.from(JSON.stringify({type:1,application_id:bot})),sign=raw=>crypto.sign(null,Buffer.concat([Buffer.from(ts),raw]),privateKey).toString('hex');
assert(verifyInteraction(payload,sign(payload),ts,pub));assert(!verifyInteraction(Buffer.from('{}'),sign(payload),ts,pub));assert(!verifyInteraction(payload,sign(payload),ts,pub,Date.now()+600000));
const handler=interactionHandler({publicKey:()=>pub,application:()=>bot,background:()=>{}}),req=(raw,sig)=>new Request('https://corvus.gent/api/discord',{method:'POST',body:raw,headers:{'x-signature-ed25519':sig,'x-signature-timestamp':ts}});
assert.equal((await handler(req(payload,'bad'))).status,401);assert.deepEqual(await (await handler(req(payload,sign(payload)))).json(),{type:1});
const url=process.env.REDIS_URL;if(url!=='redis://127.0.0.1:16380/6')throw Error('local database required');
const client=createClient({url});await client.connect();const prefix='army:discord-test:',store=armyStore({redis:args=>client.sendCommand(args),prefix});let memberRoles=[],invites=0;
const request=async(url,options)=>{
 if(url.endsWith('/invites')){const body=JSON.parse(options.body);assert.equal(body.max_uses,1);assert.equal(body.max_age,604800);assert.equal(body.unique,true);invites++;return Response.json({code:'one-use-test'});}
 if(url.includes('/members/'+discordId+'/roles/')){const role=url.split('/').at(-1);memberRoles=options.method==='PUT'?[...new Set([...memberRoles,role])]:memberRoles.filter(id=>id!==role);return new Response(null,{status:204});}
 if(url.endsWith('/members/'+discordId)){if(options.method==='PATCH'){memberRoles=JSON.parse(options.body).roles;return Response.json({});}return Response.json({roles:memberRoles});}
 throw Error('unexpected mocked Discord path');
};
try{
 await store.run(['SET',store.key('discord:config'),JSON.stringify(config)]);
 const discord=armyDiscord(store,{token:()=> 'mock-token',request}),u=await store.create();await store.register(u.id,{username:'discord_test',email:'discord@example.test'});let user=await store.verify(u.id);
 await assert.rejects(()=>discord.issue(user),/unverified/);
 user.status='approved';await store.persist(user);
 const issued=await discord.issue(user);assert.equal(issued.expires,600);
 await discord.claim(issued.code,discordId,guild);assert(memberRoles.includes(roles.tiro));
 await assert.rejects(()=>discord.claim(issued.code,discordId,guild),/expired/);
 user=await store.getUser(u.id);user.membership={tier:'centurio',state:'active',until:new Date(Date.now()+60000).toISOString()};await store.persist(user);await discord.sync(user);assert(memberRoles.includes(roles.centurio));assert(!memberRoles.includes(roles.tiro));
 user.membership.until=new Date(Date.now()-1000).toISOString();await discord.sync(user);assert(memberRoles.includes(roles.tiro));assert(!memberRoles.includes(roles.centurio));
 assert.equal(await discord.invite(user),'https://discord.gg/one-use-test');await discord.invite(user);assert.equal(invites,1);
 await store.remove(u.id);assert.equal(await store.get('discord:owner:'+discordId),null);
 assert.equal(await armyDiscord(store,{token:()=>null}).invite(user),null);
 console.log('Discord mocks passed: signature/replay window, permissions, one-use linking, tier expiry, invite reuse, deletion and missing token.');
}finally{const keys=await client.keys(prefix+'*');if(keys.length)await client.del(keys);await client.quit();}
