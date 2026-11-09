import {report,latestVotes} from './store.js';
import {DEADLINE,parseSlug,voteCode} from '../../compound/v2/config.js';
const code=voteCode;
export function summarize(report,events,now=Date.now()){
 const videos=report.videos.filter(v=>!v.is_example),known=new Set(videos.map(v=>v.slug));
 // Same ordering as the public v2 hub: reported social views, then votes.
 const ranked=[...videos].sort((a,b)=>b.views-a.views||b.votes-a.votes||a.slug.localeCompare(b.slug));
 const top=ranked[0],leader=top&&(top.views>0||top.votes>0)?{code:code(top),views:top.views,votes:top.votes}:null;
 const latest=events.filter(e=>e.type==='vote'&&parseSlug(e.slug)&&known.has(e.slug)&&['up','down'].includes(e.choice)&&Date.parse(e.at)>now-86400000&&Date.parse(e.at)<=now+1000).slice(0,3).map(e=>({type:'vote',code:code(parseSlug(e.slug)),choice:e.choice,at:e.at}));
 return{ready:true,totals:{views:report.totals.views,votes:report.totals.votes},leader,leader_by:'views_then_votes',latest,deadline:DEADLINE,updated_at:new Date(now).toISOString()};
}
let last,pending;
async function snapshot(){
 if(last&&Date.now()-Date.parse(last.updated_at)<15000)return last;
 if(!pending)pending=Promise.all([report(),latestVotes()]).then(([r,events])=>(last=summarize(r,events))).finally(()=>{pending=null;});
 let timer;try{return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),4000);})]);}finally{clearTimeout(timer);}
}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=15, stale-while-revalidate=30, stale-if-error=300');
 try{const body=await snapshot();return req.method==='HEAD'?res.status(200).end():res.status(200).json(body);}
 catch{res.setHeader('Cache-Control','no-store');if(last)return res.status(200).json({...last,stale:true});return res.status(503).json({ready:false,error:'Live counts are reconnecting.'});}
}
