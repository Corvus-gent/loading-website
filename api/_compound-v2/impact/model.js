import crypto from 'node:crypto';
import {METRICS,score,engagements} from '../../../compound/impact/config.js';
export {METRICS,score,engagements};
const clean=(v,n)=>String(v||'').trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n);
export function postInfo(value){
 if(typeof value!=='string'||value.length>1500)throw Error('Paste a valid post URL.');
 let u;try{u=new URL(value.trim());}catch{throw Error('Paste a full https:// post URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use a public HTTPS post URL.');
 const host=u.hostname.toLowerCase().replace(/^(www|m)\./,'');let platform,account='',match;
 if(['x.com','twitter.com'].includes(host)&&(match=/^\/([\w]+)\/status\/(\d+)\/?$/.exec(u.pathname))){platform='x';account=match[1];u.hostname='x.com';u.pathname='/'+account+'/status/'+match[2];}
 else if(host==='tiktok.com'&&(match=/^\/@([^/]+)\/video\/(\d+)\/?$/.exec(u.pathname))){platform='tt';account=match[1];u.hostname='www.tiktok.com';u.pathname='/@'+account+'/video/'+match[2];}
 else if(host==='instagram.com'&&/^\/(p|reel|tv)\/[\w-]+\/?$/.test(u.pathname)){platform='ig';u.hostname='www.instagram.com';u.pathname=u.pathname.replace(/\/$/,'')+'/';}
 else if(host==='linkedin.com'&&/^\/(posts\/[^/]+|feed\/update\/urn:li:activity:\d+)\/?$/.test(u.pathname)){platform='li';u.hostname='www.linkedin.com';u.pathname=u.pathname.replace(/\/$/,'');}
 else if(['youtube.com','youtu.be'].includes(host)){
  const id=host==='youtu.be'?u.pathname.slice(1):/^\/shorts\/([\w-]+)\/?$/.exec(u.pathname)?.[1]||u.searchParams.get('v');
  if(!/^[\w-]{11}$/.test(id||''))throw Error('Use a YouTube video or Shorts URL.');platform='yt';u=new URL('https://www.youtube.com/watch?v='+id);
 }else throw Error('Use a TikTok, Instagram, X, LinkedIn or YouTube post URL.');
 if(platform!=='yt')u.search='';u.hash='';const post_url=u.href,id=crypto.createHash('sha256').update(post_url).digest('hex').slice(0,24);
 return {id,platform,account,post_url};
}
export function validate(raw,previous={}){
 const info=postInfo(raw?.post_url||previous.post_url),out={...previous,...info};
 for(const k of METRICS){if(raw[k]===undefined)continue;if(raw[k]===null||raw[k]===''){out[k]=null;continue;}const n=Number(raw[k]);if(!Number.isSafeInteger(n)||n<0||n>1e12)throw Error(k+' must be a non-negative whole number.');out[k]=n;}
 if(raw.made_with_compound!==undefined){if(typeof raw.made_with_compound!=='boolean')throw Error('Choose Compound yes or no.');out.made_with_compound=raw.made_with_compound;}
 for(const k of ['account','label'])if(raw[k]!==undefined)out[k]=clean(raw[k],k==='account'?80:160);
 if(!out.account)out.account=info.account||previous.account||'';
 if(raw.posted_at!==undefined){if(raw.posted_at&&!Number.isFinite(Date.parse(raw.posted_at)))throw Error('Check the posting date.');out.posted_at=raw.posted_at?new Date(raw.posted_at).toISOString():null;}
 if(raw.thumbnail_url!==undefined){if(!raw.thumbnail_url)out.thumbnail_url='';else{const u=new URL(raw.thumbnail_url);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Thumbnail must use HTTPS.');out.thumbnail_url=u.href.slice(0,1500);}}
 return out;
}
export function bulkRows(text,made=true){
 if(typeof text!=='string'||text.length>16000)throw Error('Paste at most 25 rows.');const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length||lines.length>25)throw Error('Paste 1–25 rows.');
 return lines.map((line,i)=>{try{const url=/https:\/\/[^\s—]+/.exec(line)?.[0],row={post_url:url,made_with_compound:made};postInfo(url);let found=0;
 for(const m of line.slice(url.length).matchAll(/([\d,]+)\s*(views?|likes?|comments?|replies|shares?|reposts?|quotes?|saves?|bookmarks?)/gi)){const unit=m[2].toLowerCase(),key=/view/.test(unit)?'views':/like/.test(unit)?'likes':/comment|repl/.test(unit)?'comments':/save|bookmark/.test(unit)?'saves':'shares';row[key]=(row[key]||0)+Number(m[1].replaceAll(',',''));found++;}
 if(!found)throw Error('include metrics, e.g. 5052 views, 54 likes');return validate(row);
 }catch(e){throw Error('Line '+(i+1)+': '+e.message);}});
}
export function velocity(row,now=Date.now()){
 const posted=Date.parse(row.posted_at),observed=Date.parse(row.metrics_at);if(!Number.isFinite(posted)||!Number.isFinite(observed)||observed<=posted)return null;
 const hours=(observed-posted)/3600000;if(hours<=24)return score(row)/Math.max(hours,1/60);
 return Number.isFinite(row.first24_velocity)?row.first24_velocity:null;
}
export function publicPost(row){const out={};for(const k of ['id','post_url','platform','account','label','slug','posted_at','thumbnail_url','made_with_compound','metric_source','metrics_at','measured_date',...METRICS])out[k]=row[k]??null;return {...out,score:score(row),engagements:engagements(row),velocity:velocity(row),missing_metrics:METRICS.filter(k=>row[k]==null)};}
