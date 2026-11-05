import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const clean={...process.env};
for(const key of Object.keys(clean))if(/REDIS|KV_|SECRET|REST_API|POSTHOG/.test(key))delete clean[key];
const run=(code,env={})=>spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:process.cwd(),env:{...clean,...env},encoding:'utf8',timeout:15000});
const pin=(env,file)=>spawnSync(process.execPath,['tools/pin-redis-secrets.mjs','--output',file],{env:{...clean,...env},encoding:'utf8',timeout:15000});
const sha=s=>createHash('sha256').update(s).digest('hex');
const dir=await mkdtemp(join(tmpdir(),'corvus-signing-test-'));
try{
 const configurations=[
  {REDIS_URL:'rediss://default:old-test-password@old.example:6379'},
  {KV_REST_API_TOKEN:'old-rest-test-token'},
  {REDIS_URL:'rediss://default:old-test-password@old.example:6379',SESSION_SECRET:'session-test',VOTE_SECRET:'vote-test',GAME_SECRET:'game-test',PRIVACY_SECRET:'privacy-test'},
 ];
 for(let i=0;i<configurations.length;i++){
  const env=configurations[i],file=join(dir,`${i}.json`),result=pin(env,file);assert.equal(result.status,0,result.stderr);
  const values=JSON.parse(await readFile(file,'utf8'));assert.equal((await stat(file)).mode&0o777,0o600);
  const seed=env.REDIS_URL||env.KV_REST_API_TOKEN;
  assert.deepEqual(values,{SESSION_SECRET:env.SESSION_SECRET||sha('corvus'+seed),LANGUAGE_VOTE_SECRET:env.VOTE_SECRET||sha(seed),MUSIC_VOTE_SECRET:env.VOTE_SECRET||env.SESSION_SECRET||seed,GAME_SECRET:env.GAME_SECRET||env.SESSION_SECRET||env.VOTE_SECRET||seed,PRIVACY_SECRET:env.PRIVACY_SECRET||env.SESSION_SECRET||env.VOTE_SECRET||env.KV_REST_API_TOKEN||seed});
  const after=run(`import {serverSecret,sessionSecret,languageVoteSecret,musicVoteSecret,gameSecret} from './api/_secrets.js'; console.log(JSON.stringify([sessionSecret(),languageVoteSecret(),musicVoteSecret(),gameSecret(),serverSecret()]));`,{...env,...values,REDIS_URL:'rediss://default:new-test-password@frankfurt.example:6379',KV_REST_API_TOKEN:'new-rest-token'});
  assert.equal(after.status,0,after.stderr);assert.deepEqual(JSON.parse(after.stdout),Object.values(values));assert.equal(pin(env,file).status,1);
  for(const value of Object.values(values))assert.equal(result.stdout.includes(value),false);
 }
 assert.equal(pin(configurations[0],'signing-test-must-not-exist.json').status,1);
 const adapter=`import assert from 'node:assert/strict'; import {redis,pipeline,connected} from './api/_redis.js';`;
 let result=run(adapter+`globalThis.fetch=()=>{throw Error('must use explicit TCP')};assert.equal(await redis(['PING']),'PONG');assert.deepEqual(await pipeline([['PING']]),['PONG']);process.exit(0);`,{REDIS_URL:'redis://127.0.0.1:16380/11',KV_REST_API_URL:'https://old.example',KV_REST_API_TOKEN:'old'});
 assert.equal(result.status,0,result.stderr);
 result=run(adapter+`let count=0;globalThis.fetch=async(url)=>{count++;return {ok:true,json:async()=>url.endsWith('/pipeline')?[{result:'PONG'}]:{result:'PONG'}}};assert.equal(await redis(['PING']),'PONG');assert.deepEqual(await pipeline([['PING']]),['PONG']);assert.equal(count,2);`,{LEGACY_REDIS_URL:'rediss://old.example',KV_REST_API_URL:'https://old.example',KV_REST_API_TOKEN:'old'});
 assert.equal(result.status,0,result.stderr);
 result=run(adapter+`globalThis.fetch=()=>{throw Error('no network in maintenance')};assert.equal(connected(),false);await assert.rejects(redis(['SET','a','b']),/paused/);await assert.rejects(pipeline([['SET','a','b']]),/paused/);`,{REDIS_MAINTENANCE:'1',REDIS_URL:'redis://127.0.0.1:16380/11'});assert.equal(result.status,0,result.stderr);
 for(const host of ['https://us.posthog.com','https://eu.posthog.com.evil.example','http://eu.posthog.com','https://eu.posthog.com@evil.example']){
  result=run(`import assert from 'node:assert/strict';import {posthogReady,hogql} from './api/_posthog.js';globalThis.fetch=()=>{throw Error('must not send credentials')};assert.equal(posthogReady(),false);await assert.rejects(hogql('select 1'),/EU/);`,{POSTHOG_HOST:host,POSTHOG_PERSONAL_API_KEY:'test'});assert.equal(result.status,0,result.stderr);
 }
 result=run(`import assert from 'node:assert/strict';import {posthogReady,hogql} from './api/_posthog.js';assert.equal(posthogReady(),true);globalThis.fetch=async url=>{assert.equal(new URL(url).hostname,'eu.posthog.com');return {ok:true,json:async()=>({results:[[1]]})}};assert.deepEqual(await hogql('select 1'),[[1]]);`,{POSTHOG_PERSONAL_API_KEY:'test'});assert.equal(result.status,0,result.stderr);
 assert.deepEqual(JSON.parse(await readFile('vercel.json','utf8')).regions,['fra1']);
 console.log('EU config: signing keys survive the Redis change, private secret-file guards, explicit target precedence, maintenance freeze, EU-only PostHog and fra1 passed.');
}finally{await rm(dir,{recursive:true,force:true});}
