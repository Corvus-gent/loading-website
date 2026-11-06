// Attribution stays in memory only; analytics never writes device storage.
import {analyticsAllowed} from './analytics-consent.js';
import {sidequestTags} from './analytics-policy.js';
import {arrivalSearch,sidequestsPage} from './arrival.js';
let original;
export function questTags(){
 if(!analyticsAllowed()){original=undefined;return {};}
 return original??=(sidequestsPage?sidequestTags(Object.fromEntries(new URLSearchParams(arrivalSearch))):{});
}
export const deferHomeClick=()=>false;
export const takeHomeClick=()=>false;
