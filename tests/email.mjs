import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROLE_ADDRESSES, OWNER_EMAIL, senderIdentity} from '../lib/email/addresses.js';
import {prepareEmail, sendTransactional, sendMarketing, emailConfigured, sendPrepared} from '../lib/email/send.js';
import {domainRedirects} from '../config/redirect-domains.js';
import {legionInvite} from '../lib/email/templates/legion-invite.js';
import {tierUpgrade} from '../lib/email/templates/tier-upgrade.js';
import {magicLink} from '../lib/email/templates/magic-link.js';
const message = {to: ['reader@example.com'], subject: 'test', text: 'hello'};
const unsubscribeUrl = 'https://corvus.gent/api/army?unsubscribe=real-token-from-auth';
test('roles and sender identities keep owner separate from public contacts', () => {
  assert.deepEqual(Object.keys(ROLE_ADDRESSES).sort(), ['billing','hack','hello','legion','press','security']);
  assert(!Object.values(ROLE_ADDRESSES).includes(OWNER_EMAIL));
  assert.deepEqual(senderIdentity('transactional'), {from:'Corvus <hello@mail.corvus.gent>',reply_to:ROLE_ADDRESSES.hello});
  assert.deepEqual(senderIdentity('marketing'), {from:'Gabe <gabe@news.corvus.gent>',reply_to:OWNER_EMAIL});
  assert.throws(() => senderIdentity('marketing',{EMAIL_MARKETING_DOMAIN:'evil.example\r\nBcc: reader@example.com'}));
});
test('delivery enforces stream identity, tags and unsubscribe content', async () => {
  let payload, headers;
  const request = async (_, init) => { payload = JSON.parse(init.body); headers = init.headers; return {ok:true}; };
  const options = {request, env:{RESEND_API_KEY:'test-only'},idempotencyKey:'unit'};
  await sendTransactional({...message, from:'ignored',reply_to:'ignored'}, options);
  assert.equal(payload.from, 'Corvus <hello@mail.corvus.gent>'); assert.equal(payload.reply_to,ROLE_ADDRESSES.hello);
  assert.equal(headers['Idempotency-Key'],'unit');
  await sendMarketing({...message,html:'<p>Hello</p>',unsubscribeUrl},options);
  assert.equal(payload.from,'Gabe <gabe@news.corvus.gent>');
  assert.deepEqual(payload.tags,[{name:'stream',value:'marketing'}]);
  assert.match(payload.text,/Unsubscribe:/); assert.match(payload.html,/>Unsubscribe</);
  assert.equal(payload.headers['List-Unsubscribe'],`<${unsubscribeUrl}>`);
  assert.equal(payload.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
  assert.deepEqual(prepareEmail('marketing',{...payload,unsubscribeUrl}),payload,'cached marketing retries have an identical payload');
  for (const url of [undefined,'https://example.com/unsubscribe','http://corvus.gent/api/army?unsubscribe=x','https://corvus.gent/404','https://corvus.gent/api/army?unsubscribe=']) assert.throws(() => prepareEmail('marketing',{...message,unsubscribeUrl:url}));
});
test('missing keys fail in dev/production and skip preview without network traffic', async () => {
  for(const env of [{},{VERCEL_ENV:'production'}])assert.throws(()=>emailConfigured(env),/RESEND_API_KEY/);
  let calls=0;
  const result=await sendTransactional(message,{env:{VERCEL_ENV:'preview'},request:()=>{calls++;}});
  assert.equal(calls,0);assert.equal(result.skipped,true);assert.equal(result.ok,false);
  await assert.rejects(sendTransactional(message,{env:{RESEND_API_KEY:'test'},request:async()=>({ok:false,status:422})}),/422/);
  const response=await sendPrepared([],{env:{RESEND_API_KEY:'test'},batch:true,throwOnError:false,request:async()=>({ok:false,status:429})});
  assert.equal(response.status,429,'batch queue can handle provider quota responses');
});
test('six host redirects precede route redirects and preserve wildcard paths',()=>{
  const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  assert.deepEqual(config.redirects.slice(0,6),domainRedirects);
  assert.equal(domainRedirects.length,6);
  for(const rule of domainRedirects){assert.equal(rule.statusCode,301);assert.equal(rule.source,'/:path*');assert.equal(rule.destination,'https://corvus.gent/:path*');assert.equal(rule.has[0].type,'host');}
  assert(config.rewrites.some(r=>r.source==='/.well-known/security.txt'));
});
test('templates escape user content and reject links off the primary domain',()=>{
  const invite=legionInvite({name:'<script>alert(1)</script>',url:'https://corvus.gent/legion/join/example'});
  assert(!invite.html.includes('<script>'));assert.match(invite.html,/&lt;script&gt;/);
  assert.match(tierUpgrade({tier:'senator'}).text,/senator/);
  assert.match(magicLink({url:'https://corvus.gent/army/access/#token=example'}).html,/Sign in/);
  assert.throws(()=>magicLink({url:'https://evil.example/'}));
});
