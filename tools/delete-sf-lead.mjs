#!/usr/bin/env node
import {redis} from '../api/_redis.js';
const [flag,id]=process.argv.slice(2);
if(flag!=='--id'||!/^[a-f0-9-]{36}$/.test(id||'')||process.argv.length!==4){console.error('usage: node tools/delete-sf-lead.mjs --id <lead-id>');process.exit(1);}
try{const removed=await redis(['DEL',`sf:lead:${id}`,`sf:mail:${id}`,`sf:mail-lock:${id}`]);await redis(['ZREM','sf:leads',id]);await redis(['ZREM','sf:outbox',id]);console.log(JSON.stringify({removed:removed>0}));console.log('Also remove the notification from the receiving mailbox.');process.exit(0);}catch{console.error('Deletion failed. No contact fields were logged.');process.exit(1);}
