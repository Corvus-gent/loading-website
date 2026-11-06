import {armyStore} from './_army/_store.js';
import {pidgyTrials,verifyPidgy} from './_army/_pidgy.js';
export function createPidgyHandler({store=armyStore(),secret=()=>process.env.PIDGY_WEBHOOK_SECRET}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  if(!secret())return res.status(503).json({error:'not_configured'});
  try{
   const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:'');
   if(raw.length>16*1024)return res.status(413).json({error:'size'});
   if(!verifyPidgy(raw,req.headers['x-signature-sha256'],secret()))return res.status(401).json({error:'signature'});
   let event;try{event=JSON.parse(raw.toString('utf8'));}catch{return res.status(400).json({error:'payload'});}
   const result=await pidgyTrials(store).accept(event);
   // Never reveal whether a handle exists or who referred whom.
   return res.status(200).json({ok:true,counted:!!result.counted});
  }catch(error){return res.status(error.message==='payload'?400:503).json({error:error.message==='payload'?'payload':'retry'});}
 };
}
export async function POST(request){
 const reader=request.body?.getReader(),chunks=[];let size=0;
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16*1024){await reader.cancel();return Response.json({error:'size'},{status:413});}chunks.push(Buffer.from(value));}
 const headers=new Headers();let status=200,result;
 const response={setHeader:(k,v)=>headers.set(k,v),status:n=>(status=n,response),json:data=>{result=Response.json(data,{status,headers});return result;}};
 await createPidgyHandler()({method:'POST',headers:Object.fromEntries(request.headers),body:Buffer.concat(chunks)},response);
 return result;
}
