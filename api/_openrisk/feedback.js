import { randomBytes } from 'node:crypto';
import { connected, redis } from '../_redis.js';
import { Problem } from './store.js';

const boardKey='openrisk:feedback:v1:'+(process.env.VERCEL_ENV || 'local');
let local='';
const load=async()=>{
  if (connected()) return (await redis(['GET',boardKey])) || '';
  if (process.env.VERCEL) throw new Error('Feedback storage unavailable');
  return local;
};
const decode=raw=>JSON.parse(raw || '[]');
const swap="local old=redis.call('GET',KEYS[1]) or ''; if old~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
async function update(transform) {
  for (let attempt=0;attempt<5;attempt++) {
    const raw=await load(), rows=decode(raw);
    const value=transform(rows);
    const next=JSON.stringify(rows);
    if (connected()) {
      if (await redis(['EVAL',swap,1,boardKey,raw,next])) return value;
    } else if (local===raw) { local=next; return value; }
  }
  throw new Problem(409,'Feedback changed. Please retry.');
}

export const feedbackAreas={
  general:'General feedback',explore:'Explore and map',dossier:'Dossier views',estimate:'Live estimate',
  compare:'Compare',founder:'My startup',funds:'Find investors',portfolio:'Watchlist',admin:'Manage map',
};

export async function listFeedback(owner) {
  return decode(await load()).map(({author,likes,priority,mailSent,...row})=>({
    ...row,likes:likes.length,priority:priority.length,liked:likes.includes(owner),prioritized:priority.includes(owner),
    canRetry:row.critical && author===owner && !mailSent,
  }));
}

const clean=(value,max)=>typeof value==='string' ? value.trim().slice(0,max) : '';

async function notify(row) {
  if (!row.critical || row.mailSent) return Boolean(row.mailSent);
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',signal:AbortSignal.timeout(5000),
      headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'openrisk-critical-'+row.id},
      body:JSON.stringify({
        from:'OpenRisk <login@corvus.gent>',to:process.env.OPENRISK_FEEDBACK_TO || 'gabriel@corvus.gent',
        subject:'OpenRisk critical bug: '+row.title.replace(/[\r\n]+/g,' '),
        text:[row.title,row.detail,'Area: '+feedbackAreas[row.area],'https://corvus.gent/project-cto/feedback#feedback-'+row.id].join('\n\n'),
      }),
    });
    if (!response.ok) return false;
    await update(rows=>{ const stored=rows.find(item=>item.id===row.id); if (stored) stored.mailSent=true; });
    return true;
  } catch { return false; }
}

export async function changeFeedback(owner, body) {
  if (body?.action==='submit') {
    const title=clean(body.title,100), detail=clean(body.detail,1600), area=body.area;
    if (title.length<4 || detail.length<8 || !Object.hasOwn(feedbackAreas,area) || !['suggestion','bug'].includes(body.kind)) {
      throw new Problem(400,'Add a title and describe the suggestion or bug.');
    }
    const context=typeof body.context==='string' && /^\/(?:startup|city|country)\/[a-z0-9-]{1,100}$/.test(body.context) ? body.context : '';
    const row={id:randomBytes(8).toString('hex'),author:owner,title,detail,area,context,kind:body.kind,
      critical:body.kind==='bug' && body.critical===true,at:new Date().toISOString(),likes:[],priority:[],mailSent:false};
    await update(rows=>{
      const recent=rows.filter(item=>item.author===owner && Date.now()-Date.parse(item.at)<3600000);
      if (recent.length>=12) throw new Problem(429,'Too many reports. Try again later.');
      if (row.critical && recent.some(item=>item.critical && Date.now()-Date.parse(item.at)<600000)) {
        throw new Problem(429,'A critical alert was recently submitted. Wait before sending another.');
      }
      rows.unshift(row);
    });
    return {id:row.id,critical:row.critical,notified:row.critical && await notify(row)};
  }
  if (body?.action==='retry') {
    const row=decode(await load()).find(item=>item.id===body.id && item.author===owner && item.critical);
    if (!row) throw new Problem(404,'Critical report not found.');
    return {notified:await notify(row)};
  }
  if (body?.action==='vote' && ['likes','priority'].includes(body.vote) && typeof body.enabled==='boolean') {
    await update(rows=>{
      const row=rows.find(item=>item.id===body.id);
      if (!row) throw new Problem(404,'Feedback not found.');
      const voters=new Set(row[body.vote]);
      if (body.enabled) voters.add(owner);
      else voters.delete(owner);
      row[body.vote]=[...voters];
    });
    return {};
  }
  throw new Problem(400,'Invalid feedback action.');
}
