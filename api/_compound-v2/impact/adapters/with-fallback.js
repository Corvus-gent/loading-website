import {oriane} from './oriane.js';
export function withFallback(platform,official){return async (rows,opts={})=>{
 let result;try{result=await official(rows,opts);}catch(e){if(e.status===429)throw e;result={mode:'error',updates:[],error:e.message};}
 if(result.mode!=='not_configured'&&result.mode!=='error')return result;
 if(!process.env.ORIANE_API_KEY)return{...result,note:(result.error||'')+' Oriane not configured; public fallback available.'};
 const fallback=await oriane(rows,platform,opts);return{...fallback,error:result.error,note:'Oriane fallback. '+result.error};
};}
