import {redis} from '../../_redis.js';
import {dailyIPHash} from '../../_privacy.js';
import {ikey} from './store.js';
export function targetURL(raw){let u;try{u=new URL(raw||'https://compound.mov/');}catch{throw Error('Invalid Compound destination.');}
 if(u.protocol!=='https:'||!['compound.mov','www.compound.mov'].includes(u.hostname)||u.username||u.password||u.port||u.href.length>2000)throw Error('Invalid Compound destination.');
 const ref=process.env.COMPOUND_REF_CODE,param=process.env.COMPOUND_REF_PARAM||'ref';if(ref&&/^[a-zA-Z][\w-]{0,39}$/.test(param))u.searchParams.set(param,ref);return u.href;}
export async function countClick(req,placement){if(req.method!=='GET'||/bot|crawler|spider|preview|curl|wget|headless|facebookexternalhit|discord|slack/i.test(req.headers['user-agent']||'')||/prefetch/i.test(req.headers.purpose||req.headers['sec-purpose']||''))return false;
 const id='compound-'+placement,hash=dailyIPHash(req,'compound-click:'+id),day=new Date().toISOString().slice(0,10);
 return redis(['EVAL',"redis.call('HINCRBY',KEYS[4],ARGV[1],1);if not redis.call('SET',KEYS[1],'1','NX','EX',1800) then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('EXPIRE',KEYS[3],31536000);return 1",4,ikey('click-dedupe:'+id+':'+hash),ikey('clicks'),ikey('clicks:'+day),ikey('raw-clicks'),id]);
}
