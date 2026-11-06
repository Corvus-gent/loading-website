import {readFile} from 'node:fs/promises';
import {LANGUAGES} from '../../js/army/domain.js';
const cache=new Map();
export function mailCopy(lang='en'){
 if(!LANGUAGES.includes(lang))lang='en';
 if(!cache.has(lang))cache.set(lang,readFile(new URL('../../js/i18n/mail.'+lang+'.json',import.meta.url),'utf8').then(JSON.parse));
 return cache.get(lang);
}
export const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
