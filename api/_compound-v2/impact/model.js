import {eligibility,classification} from './eligibility.js';
import crypto from 'node:crypto';
import {ACCOUNTS,isConfigured,accountHandle} from '../../../compound/impact/accounts.js';
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
 else if(host==='twitch.tv'&&/^\/videos\/\d+\/?$/.test(u.pathname)){platform='tw';u.hostname='www.twitch.tv';u.pathname=u.pathname.replace(/\/$/,'');}
 else if((host==='clips.twitch.tv'&&/^\/[\w-]+\/?$/.test(u.pathname))||(host==='twitch.tv'&&(match=/^\/([\w]+)\/clip\/([\w-]+)\/?$/.exec(u.pathname)))){platform='tw';account=match?.[1]||'';u=new URL('https://clips.twitch.tv/'+(match?.[2]||u.pathname.split('/')[1]));}
 else if(['youtube.com','youtu.be'].includes(host)){
  const id=host==='youtu.be'?u.pathname.slice(1):/^\/shorts\/([\w-]+)\/?$/.exec(u.pathname)?.[1]||u.searchParams.get('v');
  if(!/^[\w-]{11}$/.test(id||''))throw Error('Use a YouTube video or Shorts URL.');platform='yt';u=new URL('https://www.youtube.com/watch?v='+id);
 }else throw Error('Use a TikTok, Instagram, X, LinkedIn, Twitch or YouTube post URL.');
 if(platform!=='yt')u.search='';u.hash='';const post_url=u.href,id=crypto.createHash('sha256').update(post_url).digest('hex').slice(0,24);
 return {id,platform,account,post_url};
}
export function validate(raw,previous={}){
 const info=postInfo(raw?.post_url||previous.post_url),out={...previous,...info};
 for(const k of METRICS){if(raw[k]===undefined)continue;if(raw[k]===null||raw[k]===''){out[k]=null;continue;}const n=Number(raw[k]);if(!Number.isSafeInteger(n)||n<0||n>1e12)throw Error(k+' must be a non-negative whole number.');out[k]=n;}
 for(const k of ['original_by_gabe','native_video'])if(raw[k]!==undefined){if(typeof raw[k]!=='boolean')throw Error('Confirm '+k);out[k]=raw[k];}
 for(const [k,values]of Object.entries({post_type:['original','reply','repost','quote','unknown'],media_type:['video','image','gif','carousel','text','link','unknown']}))if(raw[k]!==undefined){if(!values.includes(raw[k]))throw Error('Invalid '+k);out[k]=raw[k];}
 if(raw.post_type===undefined&&raw.post_kind!==undefined)out.post_type=classification(raw).post_type;
 if(raw.made_with_compound!==undefined){if(typeof raw.made_with_compound!=='boolean')throw Error('Choose Compound yes or no.');out.made_with_compound=raw.made_with_compound;}
 if(raw.video_kind!==undefined){if(!['clip','highlight','upload','archive','video'].includes(raw.video_kind))throw Error('Invalid video kind.');out.video_kind=raw.video_kind;}
 for(const k of ['account','label'])if(raw[k]!==undefined)out[k]=clean(raw[k],k==='account'?80:160);
 if(!out.account)out.account=info.account||previous.account||'';
 out.account=accountHandle(info.platform,out.account);
 if(raw.view_metric!==undefined){if(!['views','impressions'].includes(raw.view_metric))throw Error('Choose views or impressions.');out.view_metric=raw.view_metric;}
 if(raw.posted_at!==undefined){if(raw.posted_at&&!Number.isFinite(Date.parse(raw.posted_at)))throw Error('Check the posting date.');out.posted_at=raw.posted_at?new Date(raw.posted_at).toISOString():null;}
 if(raw.thumbnail_url!==undefined){if(!raw.thumbnail_url)out.thumbnail_url='';else{const u=new URL(raw.thumbnail_url);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Thumbnail must use HTTPS.');out.thumbnail_url=u.href.slice(0,1500);}}
 return out;
}
export function bulkRows(text,made=true,{allowUnmeasured=false}={}){
 if(typeof text!=='string'||text.length>16000)throw Error('Paste at most 25 rows.');const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length||lines.length>25)throw Error('Paste 1–25 rows.');
 return lines.map((line,i)=>{try{const url=/https:\/\/[^\s—]+/.exec(line)?.[0],row={post_url:url,made_with_compound:made};postInfo(url);let found=0;
 for(const m of line.slice(line.indexOf(url)+url.length).matchAll(/(-?[\d,]+(?:\.\d+)?)\s*(views?|impressions?|likes?|reactions?|comments?|replies|shares?|reposts?|quotes?|saves?|bookmarks?)/gi)){const unit=m[2].toLowerCase(),key=/view|impression/.test(unit)?'views':/like|reaction/.test(unit)?'likes':/comment|repl/.test(unit)?'comments':/save|bookmark/.test(unit)?'saves':'shares',value=Number(m[1].replaceAll(',',''));if(!Number.isSafeInteger(value)||value<0)throw Error('Metrics must be non-negative whole numbers.');if(key==='views'){if(row.views!==undefined)throw Error('Use views or impressions, not both.');row.view_metric=/impression/.test(unit)?'impressions':'views';}row[key]=(row[key]||0)+value;found++;}
 if(!found&&(!allowUnmeasured||line.trim()!==url))throw Error('include metrics, e.g. 5052 views, 54 likes');return validate(row);
 }catch(e){throw Error('Line '+(i+1)+': '+e.message);}});
}
export function velocity(row,now=Date.now()){
 const posted=Date.parse(row.posted_at),observed=Date.parse(row.metrics_at);if(!Number.isFinite(posted)||!Number.isFinite(observed)||observed<=posted)return null;
 const hours=(observed-posted)/3600000;if(hours<=24)return score(row)/Math.max(hours,1/60);
 return Number.isFinite(row.first24_velocity)?row.first24_velocity:null;
}
export function publicPost(row){const out={};for(const k of ['id','post_url','platform','account','label','slug','posted_at','thumbnail_url','made_with_compound','metric_source','metrics_at','measured_date','view_metric','vote_code','original_by_gabe','native_video','video_kind','post_kind','post_type','media_type','manual_approved','registry_match',...METRICS])out[k]=row[k]??null;return {...out,...classification(row),score:eligibility(row).eligible?score(row):null,engagements:eligibility(row).eligible?engagements(row):null,velocity:eligibility(row).eligible?velocity(row):null,missing_metrics:METRICS.filter(k=>row[k]==null)};}

export function linkedinBulk(text,{account=ACCOUNTS.li.handles[0],has_video,original}={}){account=accountHandle('li',account);if(!isConfigured('li',account))throw Error('Choose the configured LinkedIn account.');if(typeof has_video!=='boolean'||original!==true)throw Error('Confirm that these are original posts by Gabe.');return bulkRows(text,true,{allowUnmeasured:true}).map(row=>{if(row.platform!=='li')throw Error('LinkedIn bulk import accepts LinkedIn URLs only.');return {...row,account,original_by_gabe:true,post_type:'original',media_type:has_video?'video':'text',native_video:has_video};});}
export function linkedinPost(raw){
 if(raw?.has_video!==true)throw Error('Confirm this post contains a native uploaded video.');
 const [confirmed]=linkedinBulk(raw.post_url,raw),patch={...raw,...confirmed};
 // Empty analytics on a new import are unknown; on an update they preserve the previous measurement.
 for(const k of [...METRICS,'posted_at'])if(patch[k]===''||patch[k]==null)delete patch[k];
 if(patch.views===undefined)delete patch.view_metric;
 return validate(patch);
}
