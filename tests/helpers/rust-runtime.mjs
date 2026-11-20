// A new loopback-only Redis process per test. Never touches the developer's databases.
import {spawn} from 'node:child_process';
import net from 'node:net';
import {existsSync} from 'node:fs';
import {createClient} from 'redis';
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
export async function isolatedRuntime(modules='support,battle',fixture={}){
 const redisPort=await freePort(),rustPort=await freePort();
 const executable=process.env.REDIS_SERVER||(existsSync('/tmp/corvus-redis-tests/source/src/redis-server')?'/tmp/corvus-redis-tests/source/src/redis-server':'redis-server');
 const redis=spawn(executable,['--bind','127.0.0.1','--port',String(redisPort),'--save','','--appendonly','no'],{stdio:'ignore'});
 const secret='isolated-browser-fixture';
 const env={PATH:process.env.PATH,LANG:'en_US.UTF-8',REDIS_URL:`redis://127.0.0.1:${redisPort}/1`,SESSION_SECRET:secret,CALL_ADMIN_KEY:secret,BATTLE_ADMIN_KEY:secret,COMPOUND_V2_ADMIN_PASSWORD:secret,COMPOUND_ADMIN_PASSWORD:secret,COMPOUND_STATS_PASSWORD:secret,CORVUS_RUST_MODULES:modules,CORVUS_RUST_WRITES:'isolated',RUST_DEV_PORT:String(rustPort)};
 for(const k of ['CORVUS_RUST_BLOB_FIXTURE_URL','BLOB_READ_WRITE_TOKEN','ADMIN_PASSWORD','LEGION_TEST_MAIL'])if(fixture[k])env[k]=fixture[k];
 const rust=spawn('target/debug/corvus-dev',[],{env,stdio:['ignore','ignore','pipe']});let output='';rust.stderr.on('data',d=>output+=d);
 const client=createClient({url:env.REDIS_URL,socket:{reconnectStrategy:()=>50}});client.on('error',()=>{});
 const close=async()=>{await client.disconnect().catch(()=>{});rust.kill('SIGTERM');redis.kill('SIGTERM');};
 try{
  await Promise.race([client.connect(),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Isolated Redis failed to start')),5000);t.unref();})]);
  const url=`http://127.0.0.1:${rustPort}/api/rust`;
  for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return{url,client,secret,close};}catch{}await new Promise(r=>setTimeout(r,50));}
  throw Error('Isolated Rust server failed to start: '+output);
 }catch(error){await close();throw error;}
}
