// A new loopback-only Redis process per test. Never touches the developer's databases.
import {spawn} from 'node:child_process';
import net from 'node:net';
import {existsSync} from 'node:fs';
import {createClient} from 'redis';
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function stop(child){
 if(!child||child.exitCode!==null||child.signalCode)return;
 const ended=new Promise(r=>child.once('close',r));child.kill('SIGTERM');
 let timer;await Promise.race([ended,new Promise(r=>timer=setTimeout(r,3000))]);clearTimeout(timer);
 if(child.exitCode===null&&!child.signalCode){child.kill('SIGKILL');await ended;}
}
export async function isolatedRuntime(modules='support,battle',fixture={}){
 const redisPort=await freePort();
 const executable=process.env.REDIS_SERVER||(existsSync('/tmp/corvus-redis-tests/source/src/redis-server')?'/tmp/corvus-redis-tests/source/src/redis-server':'redis-server');
 const redis=spawn(executable,['--bind','127.0.0.1','--port',String(redisPort),'--save','','--appendonly','no'],{stdio:['ignore','pipe','pipe']});
 let redisLog='',redisReady=false,redisFailure,output='',rust,client;
 for(const pipe of[redis.stdout,redis.stderr])pipe.on('data',d=>{redisLog=(redisLog+d).slice(-4000);if(/Ready to accept connections/.test(redisLog))redisReady=true;});
 redis.on('error',e=>redisFailure=e);redis.on('exit',(code,signal)=>{redisFailure=Error(`Redis child exited (${code??signal})`)});
 const secret='isolated-browser-fixture';
 const env={PATH:process.env.PATH,LANG:'en_US.UTF-8',REDIS_URL:`redis://127.0.0.1:${redisPort}/1`,SESSION_SECRET:secret,CALL_ADMIN_KEY:secret,BATTLE_ADMIN_KEY:secret,COMPOUND_V2_ADMIN_PASSWORD:secret,COMPOUND_ADMIN_PASSWORD:secret,COMPOUND_STATS_PASSWORD:secret,CORVUS_RUST_MODULES:modules,CORVUS_RUST_WRITES:'isolated'};
 for(const k of ['CORVUS_RUST_BLOB_FIXTURE_URL','BLOB_READ_WRITE_TOKEN','ADMIN_PASSWORD','LEGION_TEST_MAIL','BMC_TOKEN','BMC_WEBHOOK_SECRET','PIDGY_WEBHOOK_SECRET','DISCORD_PUBLIC_KEY','DISCORD_APPLICATION_ID','CRON_SECRET','PIDGY_POSTHOG_KEY','PIDGY_POSTHOG_PROJECT','PIDGY_SIGNUP_EVENT','POSTHOG_HOST','POSTHOG_PROJECT_ID','POSTHOG_PERSONAL_API_KEY','CARTO_BASEMAPS_KEY','CORVUS_RUST_ANALYTICS_FIXTURE_URL','CORVUS_RUST_WRITES'])if(fixture[k])env[k]=fixture[k];
 const close=async()=>{if(rust&&(rust.exitCode!==null||rust.signalCode)&&output.trim())console.error(output);if(client?.isOpen)await client.disconnect().catch(()=>{});await Promise.all([stop(rust),stop(redis)]);};
 try{
  // Allocate the Rust port only after our Redis child has bound its own port.
  // Merely connecting to an available port is not proof that the database is ours.
  const deadline=Date.now()+15000;
  while(!redisReady){if(redisFailure)throw redisFailure;if(Date.now()>deadline)throw Error('Redis startup deadline');await delay(25);}
  if(redisFailure)throw redisFailure;
  client=createClient({url:env.REDIS_URL,socket:{connectTimeout:5000,reconnectStrategy:()=>false}});client.on('error',()=>{});await client.connect();
  const info=await client.info('server');
  if(!new RegExp(`^process_id:${redis.pid}\\r?$`,'m').test(info)||redisFailure)throw Error('Redis child ownership verification failed');
  const rustPort=await freePort();env.RUST_DEV_PORT=String(rustPort);
  rust=spawn('target/debug/corvus-dev',[],{env,stdio:['ignore','pipe','pipe']});let rustFailure,rustReady=false,rustStartup='';
  rust.stdout.on('data',d=>{rustStartup=(rustStartup+d).slice(-4000);if(rustStartup.includes(`Corvus Rust local server: http://127.0.0.1:${rustPort}`))rustReady=true;});
  rust.on('error',e=>rustFailure=e);rust.stderr.on('data',d=>output=(output+d).slice(-4000));
  const url=`http://127.0.0.1:${rustPort}/api/rust`,rustDeadline=Date.now()+15000;
  while(Date.now()<rustDeadline){
   if(rustFailure||rust.exitCode!==null||rust.signalCode)throw rustFailure||Error('Rust child exited');
   if(!rustReady){await delay(25);continue;}
   try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok&&(await r.json()).runtime==='rust')return{url,client,secret,close};}catch{}
   await delay(50);
  }
  throw Error('Isolated Rust server startup deadline');
 }catch(error){await close();throw Error(`${error.message}\nRedis fixture: ${redisLog.trim()}\nRust fixture: ${output.trim()}`);}
}
