import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
export async function voterContracts({client,secret}){
 const {makeChallenge,verifyChallenge,zeroBits}=await import('../../api/_music-security.js');
 const env={PATH:process.env.PATH,SESSION_SECRET:secret,REDIS_URL:process.env.REDIS_URL,CORVUS_RUST_WRITES:'isolated'};
 // execFile has no stdin option: the process gets exactly one JSON fixture, never shell interpolation.
 const rust=body=>new Promise((resolve,reject)=>{
  const p=execFile('target/debug/corvus-contract',[],{env,timeout:10000,maxBuffer:100000},(error,stdout)=>{if(error)return reject(error);try{resolve(JSON.parse(stdout));}catch(e){reject(e);}});p.stdin.end(JSON.stringify({operation:'voter-proof',...body})+'\n');
 });
 const solve=ch=>{for(let nonce=0;nonce<20_000_000;nonce++)if(zeroBits(createHash('sha256').update(ch.salt+':'+nonce).digest())>=ch.bits)return{challenge:ch.id,nonce};throw Error('fixture proof exceeded work bound');};
 const who='cross-runtime-proof-fixture';
 await client.set('music:seen:'+who,String(Date.now()-4000),{EX:3600});
 const old=await makeChallenge(who,'suggest'),proof={...solve(old),action:'suggest'};
 assert.equal((await rust({value:who,body:proof})).valid,true);assert.equal(await verifyChallenge(who,proof),false);
 const fresh=await rust({value:who,make:true,action:'vote'});assert.equal(fresh.bits,16);assert.equal(fresh.notBefore,Number(await client.get('music:seen:'+who))+2000);assert((await client.ttl('music:challenge:'+fresh.id))>290);
 const fromRust={...solve(fresh),action:'vote'};assert.equal(await verifyChallenge(who,fromRust),true);assert.equal((await rust({value:who,body:fromRust})).valid,false);
 const shared=await makeChallenge(who,'vote'),sharedProof={...solve(shared),action:'vote'};
 const race=await Promise.all(Array.from({length:8},(_,i)=>i%2?rust({value:who,body:sharedProof}).then(r=>r.valid):verifyChallenge(who,sharedProof)));
 assert.equal(race.filter(Boolean).length,1,'GETDEL protects proof single-use across runtimes');
 const wrong=await rust({value:who,make:true,action:'vote'}),wrongProof={...solve(wrong),action:'vote'};assert.equal((await rust({value:'different-voter',body:wrongProof})).valid,false);assert.equal(await verifyChallenge(who,wrongProof),false);
 const soon=await rust({value:'first-time-proof-fixture',make:true,action:'suggest'});const tooSoon={challenge:soon.id,nonce:0,action:'suggest'};assert.equal((await rust({value:'first-time-proof-fixture',body:tooSoon})).valid,false);assert.equal(await client.exists('music:challenge:'+soon.id),0);
 for(const nonce of [-1,0.5,'1',9007199254740992,null])assert.equal((await rust({value:who,body:{challenge:'a'.repeat(24),nonce,action:'vote'}})).valid,false);
 console.log('PASS: voter challenge signatures/timestamps, Rust→JS and JS→Rust proofs, concurrent single-use, nonce limits and early/wrong-voter consumption.');
}
