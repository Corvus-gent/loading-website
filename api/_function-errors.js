import {redis} from './_redis.js';
// Only codes and module labels: never exception messages, URLs, headers or input.
export async function recordError(area,code,store=redis){
 if(!/^[a-z-]{1,24}$/.test(area)||!/^[a-z0-9:_-]{1,80}$/.test(code))return;
 const item=JSON.stringify({at:new Date().toISOString(),area,code});
 try{await store(['EVAL',"redis.call('LPUSH',KEYS[1],ARGV[1]);redis.call('LTRIM',KEYS[1],0,9);redis.call('EXPIRE',KEYS[1],604800);return 1",'1','report:errors',item]);}catch{}
}
