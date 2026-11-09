import {ACCOUNTS} from './accounts.js';
export const IMPACT_CONFIG = {
 xAccounts:ACCOUNTS.x.handles.filter(Boolean),
 weights:{views:1,likes:3,comments:8,shares:10,saves:5},
 platforms:Object.fromEntries(Object.entries(ACCOUNTS).map(([id,v])=>[id,v.name])),
 refreshSeconds:60,syncSeconds:1800,
 referralParam:'ref',
};
export const METRICS=['views','likes','comments','shares','saves'];
export const score=p=>METRICS.reduce((sum,k)=>sum+(Number(p[k])||0)*IMPACT_CONFIG.weights[k],0);
export const engagements=p=>['likes','comments','shares','saves'].reduce((sum,k)=>sum+(Number(p[k])||0),0);
export const SEEDS=[]; // Legacy reply seeds were removed; never restore them.
