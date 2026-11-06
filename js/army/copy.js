// Wording lives in js/i18n/army.<lang>.json, owned by the content branch.
import {getLang,initI18n} from '../i18n.js';
import {loadFeature,featureText} from '../i18n/feature.js?v=20261106-integration25';
await Promise.all([loadFeature('army','en'),loadFeature('army',getLang())]);
export const t=(key,values={})=>featureText('army',key,values,getLang());
export function translate(root=document){root.querySelectorAll('[data-army]').forEach(el=>el.textContent=t(el.dataset.army));root.querySelectorAll('[data-army-label]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.armyLabel)));}
export function init(onChange=()=>{}){const update=async()=>{await loadFeature('army',getLang());translate();onChange();};initI18n(()=>{update().catch(()=>{});});translate();}
export {getLang};
