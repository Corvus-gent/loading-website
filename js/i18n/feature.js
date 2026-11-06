// Copy lives in JSON owned by the content author; this loader owns no wording.
export const FEATURE_LANGS=['en','nl','es','fr','pt','de','zh'];
export const FEATURES=['army','mail','wiki'];
const cache=new Map(),pending=new Map();
export function formatCopy(text,values={}){return String(text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));}
export async function loadFeature(feature,lang='en'){
 if(!FEATURES.includes(feature)||!FEATURE_LANGS.includes(lang))throw Error('unknown locale');
 const key=feature+':'+lang;if(cache.has(key))return cache.get(key);if(pending.has(key))return pending.get(key);
 const request=fetch(new URL('./'+feature+'.'+lang+'.json?v=20261106-knock1',import.meta.url),{signal:AbortSignal.timeout(5000)}).then(async response=>{
  if(!response.ok)throw Error('locale unavailable');const data=await response.json();
  if(!data||Array.isArray(data)||Object.values(data).some(v=>typeof v!=='string'))throw Error('invalid locale');
  cache.set(key,Object.freeze(data));return data;
 }).catch(async error=>{if(lang!=='en')return loadFeature(feature,'en');throw error;}).finally(()=>pending.delete(key));
 pending.set(key,request);return request;
}
export function featureText(feature,key,values={},lang='en'){
 return formatCopy(cache.get(feature+':'+lang)?.[key]??cache.get(feature+':en')?.[key]??key,values);
}
