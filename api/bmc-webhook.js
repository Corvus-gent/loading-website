import {waitUntil} from '@vercel/functions';
import {armyStore} from './_army/_store.js';
import {bmcPayments,verifyBMC} from './_army/_tolls.js';
export function createBMCHandler({store=armyStore(),secret=()=>process.env.BMC_WEBHOOK_SECRET,background=waitUntil}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  if(!secret())return res.status(503).json({error:'not_configured'});
  try{
   let raw;
   if(Buffer.isBuffer(req.body))raw=req.body;
   else if(typeof req.body==='string')raw=Buffer.from(req.body);
   else{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>128*1024)return res.status(413).json({error:'size'});chunks.push(chunk);}raw=Buffer.concat(chunks);}
   if(raw.length>128*1024)return res.status(413).json({error:'size'});
   if(!verifyBMC(raw,req.headers['x-signature-sha256'],secret()))return res.status(401).json({error:'signature'});
   let event;try{event=JSON.parse(raw.toString('utf8'));}catch{return res.status(400).json({error:'payload'});}
   const payments=bmcPayments(store),result=await payments.accept(event);
   if(result.accepted)background(payments.process(result.event).catch(()=>{})); // Durable pending queue retries via cron/admin.
   return res.status(200).json({ok:true,...(result.test?{test:true}:{})});
  }catch(error){return res.status(error.message==='payload'?400:503).json({error:error.message==='payload'?'payload':'retry'});}
 };
}
// Web-standard entry point deliberately bypasses Node request-body helpers.
// Re-serialising a parsed object would invalidate the provider's HMAC.
export async function POST(request){
 if(new URL(request.url).searchParams.get('buildDeployment')==='1'||(new URL(request.url).pathname==='/api/build'&&new URL(request.url).searchParams.get('deployment')==='1'))return (await import('./_build-stats.js')).deploymentWebhook(request);
 const reader=request.body?.getReader(),chunks=[];let size=0;
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128*1024){await reader.cancel();return Response.json({error:'size'},{status:413});}chunks.push(Buffer.from(value));}
 const headers=new Headers();let status=200,result;
 const response={setHeader:(k,v)=>headers.set(k,v),status:n=>(status=n,response),json:data=>{result=Response.json(data,{status,headers});return result;}};
 await createBMCHandler()({method:'POST',headers:Object.fromEntries(request.headers),body:Buffer.concat(chunks)},response);
 return result;
}
