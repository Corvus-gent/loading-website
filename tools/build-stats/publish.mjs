import fs from 'node:fs/promises';
const url=process.env.BUILD_INGEST_URL,token=process.env.BUILD_INGEST_TOKEN;if(!url||!token)throw Error('Snapshot publishing is not configured');
const data=await fs.readFile('build/seed.json','utf8');const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:data,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Snapshot publish failed: '+r.status);console.log('Verified snapshot saved.');
