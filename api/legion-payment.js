// Raw-body endpoint: Stripe signatures must be checked before JSON parsing.
import Stripe from 'stripe';
import {mode,processPayment} from './_legion/payments.js';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required.'});
 const secret=process.env['LEGION_STRIPE_WEBHOOK_SECRET_'+mode()];
 if(!secret)return res.status(503).json({error:'Payments are not connected.'});
 let chunks=[],size=0;
 try{for await(const chunk of req){size+=chunk.length;if(size>128000)return res.status(413).json({error:'Payload too large.'});chunks.push(chunk);}}catch{return res.status(400).json({error:'Incomplete payload.'});}
 let event;try{event=Stripe.webhooks.constructEvent(Buffer.concat(chunks),req.headers['stripe-signature'],secret);}catch{return res.status(400).json({error:'Invalid payment signature.'});}
 try{return res.status(200).json(await processPayment(event));}catch{return res.status(503).json({error:'Please retry the payment notification.'});}
}
