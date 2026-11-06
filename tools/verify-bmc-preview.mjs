// Sends provider-schema TEST deliveries only. No payment or account is created.
import crypto from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const deployment=process.argv[2],secret=process.env.BMC_WEBHOOK_SECRET;
if(!deployment||!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(deployment)||!secret)throw Error('preview URL and BMC_WEBHOOK_SECRET required');
const dir=await mkdtemp(join(tmpdir(),'corvus-bmc-test-'));
try{
 const body=JSON.stringify({event_id:1,type:'donation.created',live_mode:false,created:Math.floor(Date.now()/1000),attempt:1,data:{id:1,amount:1,currency:'USD',coffee_count:1}},null,2);
 const payload=join(dir,'event.json'),headers=join(dir,'headers.txt');await writeFile(payload,body,{mode:0o600});
 const signature=crypto.createHmac('sha256',secret).update(body).digest('hex');
 for(const [name,sig,expected] of [['valid test',signature,200],['duplicate test',signature,200],['invalid signature','0'.repeat(64),401]]){
  await writeFile(headers,'Content-Type: application/json\nx-signature-sha256: '+sig+'\n',{mode:0o600});
  const result=spawnSync('npx',['--yes','vercel@65.12.1','curl','/api/bmc-webhook','--deployment',deployment,'--scope','corvus11','--','--request','POST','--header','@'+headers,'--data-binary','@'+payload,'--silent','--show-error','--max-time','40','--write-out','\nHTTP_STATUS=%{http_code}\n'],{encoding:'utf8',timeout:120000});
  const status=Number(/HTTP_STATUS=(\d+)/.exec(result.stdout||'')?.[1]);
  const test=/"test"\s*:\s*true/.test(result.stdout||'');
  console.log(name+': '+(status||'unavailable')+(status===200?' · test acknowledged='+test:''));
  if(result.status!==0||status!==expected||expected===200&&!test)throw Error('live webhook verification failed; no secrets printed');
 }
 console.log('Vercel raw-body verification passed. Provider-schema test events sent by CLI; no real charge.');
}finally{await rm(dir,{recursive:true,force:true});}
