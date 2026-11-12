import {readFile} from 'node:fs/promises';
import {LANGUAGES} from '../../js/army/domain.js';
const cache=new Map();
function localeCopy(feature,lang='en'){
 if(!LANGUAGES.includes(lang))lang='en';
 const key=feature+':'+lang;
 if(!cache.has(key))cache.set(key,readFile(new URL('../../js/i18n/'+feature+'.'+lang+'.json',import.meta.url),'utf8').then(JSON.parse));
 return cache.get(key);
}
export const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));

export const mailCopy=lang=>localeCopy('mail',lang);
export const armyCopy=lang=>localeCopy('army',lang);
