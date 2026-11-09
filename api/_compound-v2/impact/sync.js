import crypto from 'node:crypto';import {redis} from '../../_redis.js';
import {records,save,snapshot,ikey} from './store.js';
import tt from './adapters/tt.js';import ig from './adapters/ig.js';import x from './adapters/x.js';import li from './adapters/li.js';import yt from './adapters/yt.js';
export async function sync({force=false}={}){
 const token=crypto.randomUUID();if(!await redis(['SET',ikey('sync-lock'),token,'NX','EX',120]))return{busy:true};
 try{const old=await redis(['GET',ikey('sync-status')]);if(!force&&old&&Date.now()-Date.parse(JSON.parse(old).at)<1790000)return{...JSON.parse(old),cached:true};
 const all=await records(),state={at:new Date().toISOString(),platforms:{},updated:0};
 for(const [platform,adapter]of Object.entries({tt,ig,x,li,yt})){try{const result=await adapter(all.filter(p=>p.platform===platform));let updated=0;for(const {row,patch}of result.updates)if(await save({post_url:row.post_url,...patch},{source:result.mode,expected:row}))updated++;state.updated+=updated;state.platforms[platform]={mode:result.mode,updated,note:result.note};}catch(e){state.platforms[platform]={mode:'error',note:e.message};}}
 state.completed_at=new Date().toISOString();state.next_at=new Date(Date.now()+1800000).toISOString();await snapshot();await redis(['SET',ikey('sync-status'),JSON.stringify(state)]);return state;
 }finally{await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,ikey('sync-lock'),token]);}
}
