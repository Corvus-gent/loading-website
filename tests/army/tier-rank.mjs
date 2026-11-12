import assert from 'node:assert/strict';import {armyCopy} from '../../api/_army/_copy.js';import {tagSVG} from '../../js/army/art.js';import {armyMail} from '../../api/_army/_mail.js';import {LANGUAGES,points,rank,activeTier} from '../../js/army/domain.js';
const user={verifiedAt:'yes',username:'sam_thooft',serial:1,created:'2026-11-06',status:'approved',email:'fixture@example.test',membership:{tier:'consul',state:'active'}};
const store={now:()=>Date.now()},mail=armyMail(store,{}, {invite:()=> 'https://discord.gg/test'});
for(const lang of LANGUAGES){
 const labels=await armyCopy(lang);for(const poster of [false,true]){
  const svg=tagSVG({username:user.username,rank:'tiro',tier:'consul'},'test',{poster,labels});assert(svg.includes(labels.rankLabel+' tiro'));assert(svg.includes(labels.tierLabel+' consul'));assert(svg.includes(labels.supporterLifetime));
  assert(!tagSVG({rank:'tiro'},'test',{poster,labels}).includes(labels.tierLabel+' '));
 }
 const msg=await mail.compose({kind:'welcome',data:{}},{...user,lang});assert(msg.text.includes(labels.rankLabel+' tiro'));assert(msg.text.includes(labels.tierLabel+' consul'));assert(msg.text.includes(labels.tierWhy));assert(msg.text.includes(labels.supporterLifetime));
 const free=await mail.compose({kind:'welcome',data:{}},{...user,lang,membership:null});assert(!free.text.includes(labels.tierLabel+' '));
}
assert.equal(points(user),0);assert.equal(rank(user),'tiro');assert.equal(activeTier(user),'consul');console.log('Seven-language art + welcome email split, optional supporter, lifetime wording, unchanged rank/tier passed.');
