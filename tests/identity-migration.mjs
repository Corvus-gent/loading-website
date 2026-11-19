import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const code=`import{sessionSecret,languageVoteSecret,musicVoteSecret,gameSecret,serverSecret}from'./api/_secrets.js';console.log(JSON.stringify([sessionSecret(),languageVoteSecret(),musicVoteSecret(),gameSecret(),serverSecret()]));`;
const clean={...process.env};for(const key of Object.keys(clean))if(/REDIS|KV_|SECRET|REST_API/.test(key))delete clean[key];
const before='redis://default:fixture-old-password@old.example:12345',after='rediss://default:fixture-new-password@new.example:6379';
for(const extra of [{},{SESSION_SECRET:'existing-session'},{VOTE_SECRET:'existing-vote'},{PRIVACY_SECRET:'existing-privacy'},{KV_REST_API_TOKEN:'existing-legacy-rest'}]){
 const run=env=>{const r=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{...clean,...env},encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const old=run({...extra,REDIS_URL:before});
 const privacyAnchor=extra.KV_REST_API_TOKEN?{REDIS_PRIVACY_SEED_ENV:'KV_REST_API_TOKEN'}:{REDIS_PRIVACY_SEED:before};
 const moved=run({...extra,REDIS_URL:after,REDIS_IDENTITY_SEED:before,...privacyAnchor,CORVUS_TLS_KV_REST_API_TOKEN:'new-target-token'});
 assert.deepEqual(moved,old,'all five signing identities survive a transport change');
}
console.log('PASS: identity anchors preserve sessions, votes, games and privacy across TLS migration, including dedicated and legacy secrets.');
