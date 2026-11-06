import assert from 'node:assert/strict';
import {createClient} from 'redis';
import {armyStore} from '../../api/_army/_store.js';
import {armyService} from '../../api/_army/_service.js';
import {armyDiscord,investorChannel} from '../../api/_army/_discord.js';
import {createArmyHandler} from '../../api/army.js';
import {publicSoldier} from '../../js/army/domain.js';
assert.equal(process.env.REDIS_URL,'redis://127.0.0.1:16380/6');
const c=createClient({url:process.env.REDIS_URL});await c.connect();
const store=armyStore({redis:args=>c.sendCommand(args),prefix:'army:pidgy-ui:'});
const guild='100000000000000001',bot='100000000000000002',owners=['100000000000000003','100000000000000004'],member='100000000000000005',investorRole='100000000000000006',tierRole='100000000000000007';
const config={guild,bot,owners,investorRole,roles:{tiro:tierRole,miles:'100000000000000008'},channels:{'the-gate':'100000000000000009'}};
let memberRoles=[tierRole],requests=0;
const request=async(url,options)=>{requests++;if(url.endsWith('/members/'+member))return Response.json({roles:memberRoles});const role=url.split('/').at(-1);assert(url.includes('/roles/'));if(options.method==='PUT')memberRoles=[...new Set([...memberRoles,role])];else if(options.method==='DELETE')memberRoles=memberRoles.filter(r=>r!==role);else assert.fail('unexpected Discord request');return new Response(null,{status:204});};
const discordOptions={token:()=> 'mock',request},service=armyService({store,discordOptions}),discord=armyDiscord(store,discordOptions);
const handler=createArmyHandler({service,ready:()=>true,ownerSession:async req=>({email:req.headers['x-test-owner']==='yes'?'gabriel@corvus.gent':'someone@example.test'})});
async function call(query,body,owner=false){let status,data;const res={setHeader(){},status(n){status=n;return this},json(d){data=d;return this},end(){return this}};await handler({method:body?'POST':'GET',query,body,headers:{origin:'https://corvus.gent',...(owner?{'x-test-owner':'yes'}:{})}},res);return {status,data};}
try{
 await store.run(['SET',store.key('discord:config'),JSON.stringify(config)]);
 const u=await store.create();await store.enlist(u.id,{username:'private_recruiter',email:'owner@example.test',link:'https://example.com',why:'i build'});let user=await store.verify(u.id);user.status='approved';user.discordId=member;user.pidgyTrials=5;await store.persist(user);
 const own=await service.self(user,true),anonymous=await service.self(user,false);
 assert.equal(own.pidgyCode,'corvus-private_recruiter');assert.equal(own.pidgyTrials,5);
 for(const data of [anonymous,publicSoldier(user),(await call({profile:'private_recruiter'})).data,(await call({view:'legion'})).data])for(const key of ['pidgyCode','pidgyTrials','investor','discordId'])assert(!JSON.stringify(data).includes('"'+key+'"'));
 assert.equal((await call({admin:'1'},{action:'investor',id:u.id,enabled:true})).status,403);assert.equal(requests,0);
 const channel=investorChannel(config);assert(BigInt(channel.permission_overwrites.find(r=>r.id===guild).deny)&1024n);assert(!channel.permission_overwrites.some(r=>r.id===tierRole));for(const r of channel.permission_overwrites)if(BigInt(r.allow)&1n)assert([bot,...owners].includes(r.id));
 assert.equal((await call({admin:'1'},{action:'investor',id:u.id,enabled:true},true)).status,200);assert(memberRoles.includes(investorRole));assert.equal((await store.getUser(u.id)).investor,true);
 user=await store.getUser(u.id);user.membership={tier:'miles',state:'active',until:new Date(Date.now()+60000).toISOString()};await store.persist(user);await discord.sync(user);assert(memberRoles.includes(investorRole));
 user.membership.state='refunded';await discord.sync(user);assert(memberRoles.includes(investorRole),'refund must not revoke manual investor');
 assert.equal((await call({admin:'1'},{action:'investor',id:u.id,enabled:false},true)).status,200);assert(!memberRoles.includes(investorRole));
 user=await store.getUser(u.id);user.membership={tier:'senator',state:'active'};await discord.sync(user).catch(e=>{assert.equal(e.message,'discord_configuration')});assert(!memberRoles.includes(investorRole),'payment cannot grant investor');
 assert.equal((await call({admin:'1'},{action:'investor',id:u.id,enabled:'true'},true)).status,400);
 console.log('Pidgy UI privacy and investor authorization/role isolation checks passed.');
}finally{const keys=await c.keys('army:pidgy-ui:*');if(keys.length)await c.del(keys);await c.quit();}
