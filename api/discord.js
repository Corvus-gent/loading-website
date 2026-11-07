import {waitUntil} from '@vercel/functions';
import {armyStore} from './_army/_store.js';
import {armyDiscord,verifyInteraction} from './_army/_discord.js';
export function interactionHandler({store=armyStore(),publicKey=()=>process.env.DISCORD_PUBLIC_KEY,application=()=>process.env.DISCORD_APPLICATION_ID,background=waitUntil,discord}={}){
 return async request=>{
  const chunks=[];let size=0;const reader=request.body?.getReader();
  if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();return new Response(null,{status:413});}chunks.push(Buffer.from(value));}
  const raw=Buffer.concat(chunks);
  if(!verifyInteraction(raw,request.headers.get('x-signature-ed25519'),request.headers.get('x-signature-timestamp'),publicKey()))return new Response(null,{status:401});
  let event;try{event=JSON.parse(raw);}catch{return new Response(null,{status:400});}
  if(event.application_id!==application())return new Response(null,{status:403});
  const json=data=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
  if(event.type===1)return json({type:1});
  if(event.type!==2||event.data?.name!=='claim')return json({type:4,data:{content:'unknown command.',flags:64}});
  background((discord||armyDiscord(store)).complete(event).catch(()=>{}));
  return json({type:5,data:{flags:64}});
 };
}
const discordPost=interactionHandler();
export async function POST(request){if(new URL(request.url).searchParams.get('compoundStripe')==='1')return (await import('./_compound/payments.js')).stripeWebhook(request);return discordPost(request);}
