import {t} from './copy.js?v=20261106-feathers1';
const next={tiro:'miles',miles:'centurio',centurio:'legatus',legatus:'senator',senator:'consul'};
export function nextBenefit(tier){
 if(tier==='consul'||tier==='imperator')return null;
 const target=next[tier||'tiro'];
 return target?{tier:target,perk:t(target==='consul'?'tierConsulPerk':'tierPerk'+target[0].toUpperCase()+target.slice(1))}:null;
}
export function renderNextBenefit(node,tier){const benefit=nextBenefit(tier);node.hidden=!benefit;node.textContent=benefit?t('nextRank',benefit):'';}
