import {refreshMs} from '../../../compound/impact/metrics.js';
import crypto from 'node:crypto';import {redis} from '../../_redis.js';
import {records,save,snapshot,ikey} from './store.js';
import {ACCOUNTS,configuredAccounts,normalizedHandle} from '../../../compound/impact/accounts.js';
import {settings,saveStatus} from './accounts.js';
import tt from './adapters/tt.js';import ig from './adapters/ig.js';import x from './adapters/x.js';import li from './adapters/li.js';import yt from './adapters/yt.js';import twitch from './adapters/tw.js';
export async function sync({force=false,platform}={}){
 if(platform&&!ACCOUNTS[platform])throw Error('Unknown platform.');
 const token=crypto.randomUUID();if(!await redis(['SET',ikey('sync-lock'),token,'NX','EX',120]))return{busy:true};
 try{const old=await redis(['GET',ikey('sync-status')]);if(!force&&old&&Date.now()-Date.parse(JSON.parse(old).at)<1790000)return{...JSON.parse(old),cached:true};
 const all=await records(),config=await settings(),state={at:new Date().toISOString(),platforms:{},updated:0};
 for(const [p,adapter]of Object.entries({tt,ig,x,li,tw:twitch,yt})){if(platform&&platform!==p)continue;
 const accounts=configuredAccounts().filter(a=>a.platform===p);if(p==='yt')for(const account of new Set(all.filter(r=>r.platform==='yt').map(r=>r.account)))if(!accounts.some(a=>a.account===account))accounts.push({account});
 for(const {account}of accounts){
 const accountRows=all.filter(r=>r.platform===p&&normalizedHandle(r.account)===normalizedHandle(account));const now=Date.now(),cadence=r=>Math.floor(now/refreshMs(r,now)),rows=[];
 const backoff=ikey('provider-backoff:'+p+':'+account);if(await redis(['EXISTS',backoff]))continue;
 for(const row of accountRows)if(force||String(await redis(['HGET',ikey('refresh:'+p),row.id]))!==String(cadence(row)))rows.push(row);
 if(accountRows.length&&!rows.length&&!['tt','ig','tw'].includes(p))continue;let result;
 try{result=p==='tw'?await twitch(account,{includeArchives:config.include_twitch_archives}):await adapter(rows,{account,registered:accountRows});let updated=0;
 for(const {row,patch}of result.updates||[])if(await save({post_url:row.post_url,...patch},{source:result.mode,expected:row}))updated++;
 for(const post of result.posts||[]){const existing=accountRows.find(r=>r.post_url===post.post_url);if(existing&&!rows.some(r=>r.id===existing.id))continue;if(await save(post,{source:result.mode}))updated++;}
 for(const row of rows)await redis(['HSET',ikey('refresh:'+p),row.id,cadence(row)]);state.updated+=updated;result={mode:result.mode,updated,found:(result.posts?.length||0)+(result.updates?.length||0),note:result.note,error:result.error||null};
 }catch(e){if(e.status===429||/429/.test(e.message))await redis(['SET',backoff,'1','EX',Math.min(86400,Math.max(3600,Math.ceil(e.retryAfter||0)))]);result={mode:'error',error:String(e.message).slice(0,400),found:0,note:'Existing posts and metrics kept.'};}
 if(['tt','ig'].includes(p)){
 await redis(['SADD',ikey('browser-queue'),p+':'+account]);
 const previous=await redis(['HGET',ikey('account-sync'),p+':'+account]);
 if(previous){const prior=JSON.parse(previous);await redis(['HSET',ikey('account-sync'),p+':'+account,JSON.stringify({...prior,provider_error:result.error||null,queued_at:state.at})]);}
 else await saveStatus(p,account,{...result,mode:'queued',provider_error:result.error||null,note:'Public-profile browser check queued; no posts have been declared missing.',queued_at:state.at});
 }else await saveStatus(p,account,result);
 state.platforms[p]={mode:result.mode,note:result.note||result.error,updated:(state.platforms[p]?.updated||0)+(result.updated||0)};
 }}
 state.completed_at=new Date().toISOString();state.next_at=new Date(Date.now()+3600000).toISOString();await snapshot();await redis(['SET',ikey('sync-status'),JSON.stringify(state)]);return state;
 }finally{await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,ikey('sync-lock'),token]);}
}
