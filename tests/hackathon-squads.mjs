import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import middleware from '../middleware.js';
import {privacyEvent,pathCategory} from '../js/analytics-policy.js';
import {renderTeams} from '../tools/build-hackathons.mjs';
const teams=JSON.parse(await fs.readFile('hackathons/teams.json','utf8'));
assert.deepEqual(teams[0].members.map(m=>m.name),['Gabe','Siebe Baree','XX']);
assert.equal(teams[0].teamSize,3);
assert.equal(teams[0].members[2].url,undefined);
const anonymous=renderTeams([teams[0]]);assert(anonymous.includes('class="squad-anonymous" aria-label="XX"'));assert(!anonymous.includes('data-squad-member="xx"'));
assert.equal(teams[0].repo,'https://github.com/SiebeBaree/hackthefeed');
const next={...teams[0],id:'next-team',name:'<future squad>',date:'2026-12',members:[{name:'A & B',label:'A & B',url:'/hack/'}]};
const output=renderTeams([...teams,next]);assert(output.indexOf('id="next-team"')<output.indexOf('id="hackthefeed"'));assert(output.includes('&lt;future squad&gt;'));assert(output.includes('A &amp; B'));
assert.throws(()=>renderTeams([{...next,repo:'javascript:alert(1)'}]));
for(const suffix of ['', '/','?utm_source=linkedin','/?utm_source=x&utm_content=team-post']){
 const response=middleware(new Request('https://corvus.gent/squads'+suffix,{headers:{'user-agent':'Mozilla/5.0'}}));assert.equal(response.status,307);
 const url=new URL(response.headers.get('location'));assert.equal(url.pathname,'/hackathons/');assert.equal(url.searchParams.get('utm_campaign'),'hack');assert.equal(url.searchParams.get('utm_medium'),'links');
 assert.equal(url.searchParams.get('utm_source'),suffix.includes('linkedin')?'linkedin':suffix.includes('utm_source=x')?'x':'share');
}
assert.equal(pathCategory('/hackathons/'),'/hackathons/');
const event=privacyEvent({event:'$pageview',properties:{$cookieless_mode:true,$host:'corvus.gent',$pathname:'/hackathons/',utm_source:'linkedin',utm_medium:'links',utm_campaign:'hack',utm_content:'squads',short_slug:'squads'}});
assert.equal(event.properties.$pathname,'/hackathons/');assert.equal(event.properties.short_slug,'squads');assert.equal(event.properties.utm_source,'linkedin');assert.equal(event.properties.utm_content,'squads');
assert.equal(privacyEvent({event:'$pageview',properties:{$cookieless_mode:true,short_slug:'private@example.test'}}).properties.short_slug,undefined);
console.log('Squad cards, future teams, escaping, redirect variants, source preservation and bounded analytics passed.');
