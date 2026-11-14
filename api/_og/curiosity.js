import {ImageResponse} from '@vercel/og';
import {readFile} from 'node:fs/promises';
import {redis,pipeline} from '../_redis.js';
const prefix=process.env.VERCEL_ENV==='preview'?'worldcraft:preview:features:v2':'worldcraft:features:v2';
const object=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],x[i*2+1]])):x||{};
export function duration(value,avg=false){const n=Math.max(0,Math.floor(Number(value)||0)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?(avg?`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`:`${h}h ${m}m`):m?`${m}m ${String(s).padStart(2,'0')}s`:`${s}s`;}
export async function liveStats(){const [players,raw]=await pipeline([['SCARD',prefix+':players'],['HGETALL',prefix+':stats']]);const stats=object(raw),total=Number(stats.total_play_seconds||0);return {players:Number(players),total,avg:Number(players)?total/Number(players):0,comments:Number(stats.comments||0),shares:Number(stats.shares||0)};}
const h=(type,style,children)=>({type,props:{style,children}});let font;
export async function renderCuriosity(stats){if(!font)font=readFile(new URL('./fonts/NotoSans.woff',import.meta.url));const labels=[['Players',stats.players.toLocaleString('en-US')],['Total play time',duration(stats.total)],['Avg per player',duration(stats.avg,true)],['Comments',stats.comments.toLocaleString('en-US')],['Shares',stats.shares.toLocaleString('en-US')]];
 const card=h('div',{display:'flex',flexDirection:'column',width:'100%',height:'100%',padding:'44px 48px',backgroundImage:'linear-gradient(135deg,#101321 0%,#2e1b38 100%)',color:'#fff',fontFamily:'Curiosity',borderTop:'9px solid #d1ff9b'},[
 h('div',{display:'flex',color:'#f0afd9',fontSize:20,letterSpacing:3},'LIVE FROM THE BUILD'),
 h('div',{display:'flex',fontSize:76,fontWeight:700,color:'#d1ff9b',marginTop:12},'Curiosity Craft'),
 h('div',{display:'flex',fontSize:34,marginTop:2,color:'#f4e9ff'},'Kids level up by asking why'),
 h('div',{display:'flex',gap:12,marginTop:42},labels.map(([label,value])=>h('div',{display:'flex',flexDirection:'column',width:210,height:156,padding:'18px 15px',border:'1px solid #66516c',borderRadius:18,background:'#ffffff08'},[h('div',{display:'flex',fontSize:value.length>9?30:value.length>7?37:49,fontWeight:700,color:'#d1ff9b',whiteSpace:'nowrap'},value),h('div',{display:'flex',fontSize:19,marginTop:12,color:'#d6c5e1'},label)]))),
 h('div',{display:'flex',justifyContent:'space-between',marginTop:'auto',paddingTop:25,borderTop:'1px solid #705165',fontSize:21,color:'#f2c4e6'},[h('span',{display:'flex'},'PLAY. COMMENT. PASS IT ON.'),h('span',{display:'flex',color:'#d1ff9b'},'corvus.gent/curiositycraft')])]);
 const image=new ImageResponse(card,{width:1200,height:630,fonts:[{name:'Curiosity',data:await font,weight:400,style:'normal'},{name:'Curiosity',data:await font,weight:700,style:'normal'}]});return Buffer.from(await image.arrayBuffer());}
let cache=null,pending=null;
export default async function handler(req,res){res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');res.setHeader('Content-Type','image/png');res.setHeader('X-Content-Type-Options','nosniff');if(req.method==='HEAD')return res.status(200).end();try{if(!cache||Date.now()-cache.at>=60000){if(!pending)pending=liveStats().then(renderCuriosity).then(bytes=>(cache={at:Date.now(),bytes})).finally(()=>pending=null);await pending;}return res.status(200).end(cache.bytes);}catch{res.setHeader('Cache-Control','no-store');return res.status(503).end();}}
