import {t} from './copy.js?v=20261106-consul';
const next={tiro:'miles',miles:'centurio',centurio:'legatus',legatus:'senator'};
export function nextBenefit(tier){
 if(tier==='senator'||tier==='imperator')return null;
 const target=next[tier||'tiro'];
 return target?{tier:target,perk:t('tierPerk'+target[0].toUpperCase()+target.slice(1))}:null;
}
export function renderNextBenefit(node,tier){const benefit=nextBenefit(tier);node.hidden=!benefit;node.textContent=benefit?t('nextRank',benefit):'';}
