import {redis} from '../_redis.js';
import {key,get} from './store.js';
import {video,parseSlug,safePostURL} from './model.js';
import {voteCode} from '../../compound/v2/config.js';
function text(value,name,max){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('invalid '+name);return value;}
export function validateExport(raw){
 const p=parseSlug(raw?.slug);if(!p)throw Error('invalid export slug');
 for(const k of ['platform','account','lang','hook'])if(raw[k]!==p[k])throw Error('export '+k+' does not match slug');
 if(raw.vote_code!==voteCode(p))throw Error('export vote code does not match slug');
 const share_url=safePostURL(raw.share_url,true);if(!share_url)throw Error('export needs a share URL');
 const download_url=text(raw.download_url,'download URL',4000),u=new URL(download_url);if(u.protocol!=='https:'||u.username||u.password)throw Error('export download needs HTTPS');
 const local_path=text(raw.local_path,'local path',2000);if(!local_path.startsWith('/')||!local_path.toLowerCase().endsWith('.mp4'))throw Error('export needs an absolute MP4 path');
 const caption=text(raw.caption,'caption',10000);if(!caption.trim())throw Error('export needs a caption');
 if(!Number.isSafeInteger(raw.export_order)||raw.export_order<0)throw Error('invalid export order');
 return{...p,vote_code:raw.vote_code,share_url,download_url,local_path,filename:local_path.split('/').at(-1),caption,export_order:raw.export_order,round:['R03','R04'].includes(raw.round)?raw.round:''};
}
// Compare-and-set preserves metrics, votes and edits even when an import races a refresh.
async function mutate(slug,change){
 for(let attempt=0;attempt<5;attempt++){
  const old=await redis(['HGET',key('videos'),slug]),existing=old?JSON.parse(old):await get(slug),{row,asset}=change(existing);
  const result=await redis(['EVAL',`local current=redis.call('HGET',KEYS[1],ARGV[1])
if (current or '')~=ARGV[2] then return 0 end
if not current and redis.call('HLEN',KEYS[1])>=1000 then return -1 end
redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]);if ARGV[4]~='' then redis.call('HSET',KEYS[2],ARGV[1],ARGV[4]) end;return 1`,2,key('videos'),key('export-assets'),slug,old||'',JSON.stringify(row),asset?JSON.stringify(asset):'']);
  if(Number(result)===1)return row;if(Number(result)<0)throw Error('video registry is full');
 }
 throw Error('This video changed. Please retry.');
}
export async function importExport(raw){const asset=validateExport(raw);return mutate(asset.slug,existing=>{
 const row=video({...asset,...existing,slug:asset.slug,vote_code:asset.vote_code,compound_url:asset.share_url,status:existing?.post_url?'posted':'ready'},{allowPending:true});
 for(const k of ['metric_source','synced_at','interview_n','interview_clip_url'])if(existing?.[k]!==undefined)row[k]=existing[k];
 return{row,asset};
});}
export async function markPosted(slug,url,now=new Date()){
 const p=parseSlug(slug);if(!p)throw Error('Choose a registered slug.');const post_url=safePostURL(url);if(!post_url)throw Error('Paste the published post URL.');
 const host=new URL(post_url).hostname.replace(/^www\./,'');const hosts={tt:['tiktok.com','vm.tiktok.com','vt.tiktok.com','m.tiktok.com'],ig:['instagram.com'],x:['x.com','twitter.com'],li:['linkedin.com','lnkd.in'],tw:['twitch.tv']};
 if(!hosts[p.platform].includes(host))throw Error('The post URL must match this slug’s platform.');
 return mutate(slug,existing=>{if(!existing)throw Error('This slug is not registered.');if(existing.post_url&&existing.post_url!==post_url)throw Error('Already posted at another URL. Use the full editor to correct it.');
 const row={...existing,...video({...existing,post_url,status:'posted',posted_at:existing.posted_at||now.toISOString()},{allowPending:true})};return{row};
 });
}
