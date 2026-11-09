import {redis} from '../_redis.js';
import {LEGION_RANKS,PARTNERS} from '../../js/site/legion-config.js';
import {authorized,login,logout,sameOrigin,limited,key,sha,csvCell,clean} from './security.js';
import * as store from './store.js';
import * as newsletter from './newsletter.js';
import * as applications from './applications.js';
import * as partners from './partners.js';
import {checkout} from './payments.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');
 const q=req.query||{};
 try{
  if(q.partner&&['GET','HEAD'].includes(req.method)){const target=PARTNERS[q.partner];if(!target)return res.status(404).json({error:'Unknown card.'});try{await partners.count(req,q.partner);}catch{}res.setHeader('Location',target.url);return res.status(302).end();}
  if(req.method==='GET'){
   if(q.action==='session')return res.status(200).json({authorized:!!await authorized(req)});
   if(q.action==='invite'){if(!await limited(req,'open-invite',60))throw Error('rate');return res.status(200).json(await store.invite(q.token,{open:!(/bot|preview|crawler/i.test(req.headers['user-agent']||''))}));}
   if(q.action==='partners'){res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');return res.status(200).json(await partners.report());}
   if(q.action==='paid'){if(!await limited(req,'paid-status',60))throw Error('rate');return res.status(200).json(await store.get('paid-session:'+sha(q.session||''))||{pending:true});}
   if(q.action==='admin'||q.action==='csv'){
    if(!await authorized(req))throw Error('unauthorized');
    const [members,invites,apps,emails,links]=await Promise.all([store.members(),store.invitations(),applications.applications(),newsletter.subscribers(),partners.allPartners()]);
    if(q.action==='csv'){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="corvus-legion.csv"');const fields=['name','handle','email','rank','source','joined_at'];return res.status(200).send([fields.join(','),...members.map(m=>fields.map(k=>csvCell(m[k])).join(','))].join('\r\n'));}
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
    return res.status(200).json({members,invites,applications:apps,partners:links,summary:{total:members.length,by_rank:Object.fromEntries(LEGION_RANKS.map(r=>[r,members.filter(m=>m.rank===r).length])),new_today:members.filter(m=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date(m.joined_at))===today).length,emails_collected:emails.length,emails_confirmed:emails.filter(e=>e.status==='confirmed').length,invites_created:invites.length,invites_opened:invites.filter(i=>i.opened_at).length,invites_claimed:invites.reduce((n,i)=>n+i.uses,0)}});
   }
   res.setHeader('Cache-Control','public, s-maxage=15, stale-while-revalidate=60');return res.status(200).json({members:(await store.members()).filter(u=>!u.hidden).map(({name,handle,rank,joined_at})=>({name,handle,rank,joined_at})),payment_ready:!!process.env['LEGION_PAYMENT_LINK_'+(process.env.LEGION_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'LIVE':'TEST'))]});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Use the page.'});
  if(!sameOrigin(req)||!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('forbidden');
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{}if(!b||Array.isArray(b)||JSON.stringify(b).length>6000)throw Error('fields');if(b.website)throw Error('fields');
  if(!await limited(req,'all',90))throw Error('rate');
  if(b.action==='short_click')return res.status(200).json(await partners.countShort(req,b.path));
  if(b.action==='login')return res.status(200).json(await login(req,res,b.password));
  if(b.action==='logout')return res.status(200).json(await logout(req,res));
  if(['create_invite','revoke_invite','rank','decide'].includes(b.action)){
   if(!await authorized(req))throw Error('unauthorized');
   if(b.action==='create_invite')return res.status(200).json(await store.createInvite(b));
   if(b.action==='revoke_invite')return res.status(200).json({ok:!!await store.revoke(b.id)});
   if(b.action==='rank')return res.status(200).json(await store.setRank(b.id,b.rank));
   return res.status(200).json(await applications.decide(b.id,b.decision));
  }
  if(b.action==='claim'){if(!await limited(req,'claim',10,600))throw Error('rate');return res.status(200).json(await store.claim(req,res,b));}
  if(b.action==='checkout'){if(!await limited(req,'checkout',8,600))throw Error('rate');return res.status(200).json(await checkout(b));}
  if(b.action==='apply'){if(!await limited(req,'apply',3,600))throw Error('rate');return res.status(200).json(await applications.apply(b));}
  if(b.action==='puzzle'){if(!await limited(req,'puzzle',10,600))throw Error('rate');return res.status(200).json(await applications.puzzle(b.answer));}
  if(b.action==='subscribe'){if(b.consent!==true)throw Error('consent');if(!await limited(req,'subscribe',3,600))throw Error('rate');return res.status(200).json(await newsletter.subscribe(b.email));}
  if(b.action==='confirm')return res.status(200).json(await newsletter.confirm(b.token));
  if(b.action==='unsubscribe')return res.status(200).json(await newsletter.unsubscribe(b.token));
  throw Error('fields');
 }catch(e){const messages={unauthorized:'Sign in first.',forbidden:'Please use this page.',rate:'A little too fast. Try again in a few minutes.',invite:'This invitation has expired, was used, or is no longer available.',account_login:'That email already has an account. Sign in to your dog tag, then open this invitation again.',handle:'Use 3–24 letters, numbers or underscores for your handle, starting with a letter.',email:'Please enter a valid email.',fields:'Check the fields and try again.',rank:'Choose an existing rank.',missing:'That entry was not found.',answer:'Not quite. Follow the lantern and try again.',consent:'Please agree to receive the confirmation email.',expired:'This confirmation has expired or was already used.',mail:'The confirmation email could not be sent. Please retry shortly.',payment_unavailable:'The checkout is reconnecting. Please retry shortly.'};const status=e.message==='unauthorized'?401:e.message==='forbidden'?403:e.message==='rate'?429:e.message==='invite'?410:e.message==='account_login'?409:messages[e.message]?400:503;if(status===429)res.setHeader('Retry-After','600');return res.status(status).json({error:messages[e.message]||'The crow lost its connection. Please retry.'});}
}
