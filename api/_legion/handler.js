// Existing Legion/Army records and atomic invitations, scoped to the builder flow.
import {authorized,login,logout,sameOrigin,limited} from './security.js';
import * as store from './store.js';
import * as applications from './applications.js';
import {checkout,paymentReady,mode} from './payments.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
 try{
  const q=req.query||{};
  if(req.method==='GET'){
   if(q.action==='invite')return res.status(200).json(await store.invite(q.token));
   if(q.action==='admin'){
    if(!await authorized(req))throw Error('unauthorized');
    return res.status(200).json({members:await store.members(),invites:await store.invitations(),applications:await applications.applications()});
   }
   if(q.action==='paid')return res.status(200).json(await store.get('paid-session:'+(await import('./security.js')).sha(q.session||''))||{pending:true});
   return res.status(200).json({ready:true,payment_ready:paymentReady(),payment_mode:mode().toLowerCase(),members:(await store.members()).filter(u=>!u.hidden).map(({name,handle,rank})=>({name,handle,rank}))});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Use GET or POST.'});
  if(!sameOrigin(req)||!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('forbidden');
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{}if(!b||Array.isArray(b)||JSON.stringify(b).length>6000||b.website)throw Error('fields');
  if(!await limited(req,'all',60))throw Error('rate');
  if(b.action==='login')return res.status(200).json(await login(req,res,b.password));
  if(b.action==='logout')return res.status(200).json(await logout(req,res));
  if(['create_invite','revoke_invite','rank','decide'].includes(b.action)){
   if(!await authorized(req))throw Error('unauthorized');
   if(b.action==='create_invite'){if(b.type==='honorary')throw Error('fields');return res.status(200).json(await store.createInvite(b,req.headers.origin));}
   if(b.action==='revoke_invite')return res.status(200).json({ok:!!await store.revoke(b.id)});
   if(b.action==='rank')return res.status(200).json(await store.setRank(b.id,b.rank));
   return res.status(200).json(await applications.decide(b.id,b.decision));
  }
  if(!await limited(req,b.action,5,600))throw Error('rate');
  if(b.action==='claim')return res.status(200).json(await store.claim(req,res,b));
  if(b.action==='checkout')return res.status(200).json(await checkout(b));
  if(b.action==='apply')return res.status(200).json(await applications.apply(b));
  throw Error('fields');
 }catch(e){const messages={unauthorized:'Sign in with the admin key first.',forbidden:'Please use the form on this site.',rate:'A little too fast. Try again in ten minutes.',fields:'Check the fields and try again.',email:'Enter a valid email.',handle:'Use 3–24 letters, numbers or underscores, starting with a letter.',invite:'This invitation has expired, was used, or was revoked.',account_login:'This email already has an account. Sign in at the recruitment gate first.',payment_unavailable:'The checkout is not connected yet. Join by email instead.',rank:'Choose an existing rank.',missing:'That entry was not found.',answer:'Complete the raven challenge first.'};return res.status(e.message==='unauthorized'?401:e.message==='forbidden'?403:e.message==='rate'?429:e.message==='invite'?410:messages[e.message]?400:503).json({error:messages[e.message]||'The ravens are resting. Please try again soon.'});}
}
