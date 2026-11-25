#!/usr/bin/env node
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {config} from '../lib/config.mjs';
import {makeReader} from '../lib/reader.mjs';
import {collect} from '../lib/collect.mjs';
import {dedupe} from '../lib/leads.mjs';
if(process.argv[2]!=='run'){console.log('Usage: leadhunter run [--publish] [--output output/leads.json]');process.exit(process.argv[2]?1:0);}
const cfg=config();const i=process.argv.indexOf('--output');const out=resolve(i<0?'output/leads.json':process.argv[i+1]);
const read=await makeReader(cfg);const snapshot=await collect(cfg,read);
let previous;try{previous=JSON.parse(await readFile(out,'utf8'));}catch{}
const old=new Map((previous?.leads||[]).map(x=>[x.id,x]));
for(const row of snapshot.leads)row.first_seen_at=old.get(row.id)?.first_seen_at||row.first_seen_at;
snapshot.leads=dedupe([...snapshot.leads,...old.values()]);
await mkdir(dirname(out),{recursive:true,mode:0o700});await writeFile(out+'.tmp',JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});await rename(out+'.tmp',out);
for(const s of snapshot.statuses)console.log(`${s.source}: ${s.state} — ${s.detail}`);
console.log(`${snapshot.leads.length} leads; snapshot written. Outreach was not sent.`);
if(process.argv.includes('--publish')){
 if(!cfg.ingestUrl||!cfg.ingestToken)throw new Error('Publishing requires LEADS_INGEST_URL and LEADS_INGEST_TOKEN');
 const res=await fetch(cfg.ingestUrl,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${cfg.ingestToken}`},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!res.ok)throw new Error(`Snapshot upload failed (${res.status})`);console.log('Private dashboard snapshot refreshed.');
}
