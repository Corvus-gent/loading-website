import {waitUntil} from '@vercel/functions';
import {authorized,sameOrigin,limit} from '../security.js';
import {authorized as ownerAdmin,sameOrigin as ownerOrigin} from '../../_legion/security.js';
import {equal} from '../../_compound/security.js';
import {report,save,seed,snapshot} from './store.js';
import {bulkRows,validate} from './model.js';
import {targetURL,countClick} from './links.js';
import {sync} from './sync.js';
export default async function handler(req,res){
 const q=req.query||{};res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
 if(q.go){if(!/^[a-z0-9-]{1,48}$/.test(q.go))return res.status(404).json({error:'Unknown placement.'});if(!['GET','HEAD'].includes(req.method))return res.status(405).end();let target;try{target=targetURL(q.to);}catch(e){return res.status(400).json({error:e.message});}if(req.method==='GET')waitUntil(countClick(req,q.go).catch(()=>{}));res.setHeader('Location',target);return res.status(302).end();}
 const cron=!!process.env.CRON_SECRET&&equal(String(req.headers.authorization||''),'Bearer '+process.env.CRON_SECRET);
 if(q.job==='1'){if(!cron&&!authorized(req)&&!await ownerAdmin(req))return res.status(401).json({error:'Owner or scheduler access required.'});if(req.method!=='GET')return res.status(405).end();return res.status(200).json(await sync());}
 if(req.method==='GET'){
 if(q.private==='1'&&!authorized(req)&&!await ownerAdmin(req))return res.status(401).json({error:'Sign in first.'});
 if(q.private!=='1')res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=300');return res.status(200).json(await report());}
 if(req.method!=='POST')return res.status(405).end();
 const admin=authorized(req)||await ownerAdmin(req);if(!admin)return res.status(401).json({error:'Owner sign-in required.'});
 if((!sameOrigin(req)&&!ownerOrigin(req)&&!String(req.headers.authorization||'').startsWith('Bearer '))||!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(403).json({error:'Use the owner form.'});
 if(!await limit(req,'impact-admin',30))return res.status(429).json({error:'Please retry in a minute.'});
 if(typeof req.body==='string'&&Buffer.byteLength(req.body)>22000)return res.status(413).json({error:'Please use a smaller batch.'});let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
 if(!b||Array.isArray(b)||JSON.stringify(b).length>22000)return res.status(400).json({error:'Invalid request.'});
 try{
 if(b.action==='save'){validate(b.post);const post=await save(b.post);await snapshot();return res.status(200).json({post});}
 if(b.action==='bulk'){const rows=bulkRows(b.text,b.made_with_compound!==false),saved=[];for(const row of rows)saved.push((await save(row)).id);await snapshot();return res.status(200).json({saved});}
 if(b.action==='seed'){await seed();await snapshot();return res.status(200).json({ok:true});}
 if(b.action==='sync')return res.status(200).json(await sync({force:true}));
 return res.status(400).json({error:'Unknown action.'});
 }catch(e){return res.status(400).json({error:e.message});}
 }catch{return res.status(503).json({error:'The metrics are temporarily unavailable. Try again shortly.'});}
}
