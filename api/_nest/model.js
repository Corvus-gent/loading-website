import {settle,pause} from './budget.js';
export const MODEL='meta/muse-ember';
export async function complete(messages,{cap=6000,ticket,command,fetcher=fetch,apiKey=process.env.OPENROUTER_API_KEY}={}){
 if(!apiKey)throw Error('resting');
 const response=await fetcher('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(48000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','HTTP-Referer':'https://corvus.gent','X-OpenRouter-Title':'Corvus Nest'},body:JSON.stringify({model:MODEL,messages,max_tokens:Math.min(6000,cap),reasoning:{effort:'low'},provider:{allow_fallbacks:false,max_price:{prompt:.1,completion:.5,request:0}}})});
 if(!response.ok){if([400,401,402,403,404,429].includes(response.status))await settle(ticket,0,command);if([401,402,403].includes(response.status))await pause(3600,command);if(response.status===429)await pause(300,command);throw Object.assign(Error(response.status===402?'credits':'resting'),{providerStatus:response.status});}
 const d=await response.json();const usage=d.usage||{};const cost=Number.isFinite(usage.cost)?usage.cost:null;
 if(cost!==null)await settle(ticket,cost*1e6,command);
 const choice=d.choices?.[0];if(choice?.finish_reason==='length')throw Error('incomplete');
 const content=choice?.message?.content;if(typeof content!=='string'||!content.trim())throw Error('resting');
 return {content,cost_usd:cost,model:d.model||MODEL,tokens:usage.total_tokens??null};
}
