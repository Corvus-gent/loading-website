import {redis} from '../_redis.js';
import {key,get,videos} from './store.js';
import {DEADLINE} from '../../compound/v2/config.js';

export function postURL(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
 const h=u.hostname.replace(/^www\./,'');let platform,id;
 if(['x.com','twitter.com'].includes(h)){platform='x';id=/^\/[^/]+\/status\/(\d+)\/?$/.exec(u.pathname)?.[1];}
 if(h==='tiktok.com'){platform='tt';id=/^\/@[^/]+\/video\/(\d+)\/?$/.exec(u.pathname)?.[1];}
 if(h==='instagram.com'){platform='ig';id=/^\/(?:reel|p)\/([\w-]+)\/?$/.exec(u.pathname)?.[1];}
 if(!id)return null;u.search='';u.hash='';return{url:u.href,platform,id};
 }catch{return null;}
}
export async function winner(){
 const saved=await redis(['GET',key('winner')]);let selection=saved?JSON.parse(saved):null,row;
 if(selection?.slug)row=await get(selection.slug);
 if(!selection&&process.env.WINNER_POST_URL){const post=postURL(process.env.WINNER_POST_URL);if(post)selection={post_url:post.url};}
 if(!selection){row=(await videos()).filter(v=>!v.is_example&&postURL(v.post_url)).sort((a,b)=>(b.views||0)-(a.views||0))[0];if(row)selection={slug:row.slug,post_url:row.post_url};}
 const post=postURL(row?.post_url||selection?.post_url);if(!post)return{winner:null,deadline:DEADLINE};
 return{winner:{...post,slug:row?.slug||selection?.slug||null,views:row&&row.metric_source!=='pending'?row.views:null,metric_source:row?.metric_source||'unavailable',updated_at:row?.updated_at||null},deadline:DEADLINE};
}
export async function selectWinner(slug){const row=await get(slug);if(!row||row.is_example||!postURL(row.post_url))throw Error('Choose a real TikTok, Instagram or X post with its published URL.');await redis(['SET',key('winner'),JSON.stringify({slug:row.slug,post_url:postURL(row.post_url).url,selected_at:new Date().toISOString()})]);return winner();}
