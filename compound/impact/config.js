import {ACCOUNTS} from './accounts.js';
import {WEIGHTS,FIELDS} from './metrics.js';
export {score,engagements} from './metrics.js';
export const IMPACT_CONFIG = {
 xAccounts:ACCOUNTS.x.handles.filter(Boolean),
 weights:WEIGHTS,
 platforms:Object.fromEntries(Object.entries(ACCOUNTS).map(([id,v])=>[id,v.name])),
 refreshSeconds:60,syncSeconds:3600,
 referralParam:'ref',
};
export const METRICS=FIELDS;
export const SEEDS=[]; // Legacy reply seeds were removed; never restore them.
