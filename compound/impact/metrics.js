// Capabilities refer to comparable post metrics, not whether credentials happen to be connected.
export const WEIGHTS={views:1,likes:3,comments:8,shares:10,saves:5};
export const FIELDS=Object.keys(WEIGHTS);
export const SUPPORTED={tt:FIELDS,ig:FIELDS,x:FIELDS,li:FIELDS,yt:['views','likes','comments','shares'],tw:['views']};
export const LABELS={x:{views:'impressions',shares:'reposts + quotes',saves:'bookmarks'},li:{likes:'reactions',shares:'reposts'},tt:{views:'views / plays'},ig:{views:'views / plays'}};
export const applicable=p=>SUPPORTED[p.platform]||FIELDS;
export const label=(p,k)=>k==='views'&&p.view_metric==='impressions'?'impressions':LABELS[p.platform]?.[k]||k;
export function count(v){if(typeof v==='string'){if(!/^\d+$/.test(v.trim()))return null;v=Number(v);}return Number.isSafeInteger(v)&&v>=0?v:null;}
export function sumKnown(values){const ns=values.filter(v=>Number.isFinite(v));return ns.length?ns.reduce((a,b)=>a+b,0):null;}
export function coverage(p){const supported=applicable(p),known=supported.filter(k=>count(p[k])!==null);return{known,missing:supported.filter(k=>!known.includes(k)),unsupported:FIELDS.filter(k=>!supported.includes(k)),score:sumKnown(known.map(k=>count(p[k])*WEIGHTS[k])),partial:known.length<supported.length};}
export const score=p=>coverage(p).score;
export const engagements=p=>sumKnown(applicable(p).filter(k=>k!=='views').map(k=>count(p[k])));
export function sourceKind(s=''){if(/instagram-insights|tiktok-display|youtube-api|helix|^x-api$|^x_api$|x-public-metrics|^x-lookup$/.test(s))return 'official';if(/browser|scrap|public-reels|yt-dlp|embed|syndication/.test(s))return 'scraped';if(/manual|self-reported|owner|seed/.test(s))return 'manual';if(/oriane/i.test(s))return 'provider';return 'unknown';}
export function firstDaySample(p){const since=Date.parse(p.posted_at),at=Date.parse(p.metrics_at),hours=(at-since)/3600000,c=coverage(p);if(!(hours>0&&hours<=24)||c.score==null)return null;return{at:p.metrics_at,posted_at:p.posted_at,score:c.score,partial:c.partial,missing:c.missing,velocity:c.score/hours};}
export function bestSample(rows){return rows.map(firstDaySample).filter(Boolean).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.missing.length-b.missing.length)[0]||null;}
export const refreshMs=(row,now=Date.now())=>[row.posted_at,row.first_seen_at].some(v=>Number.isFinite(Date.parse(v))&&now-Date.parse(v)>=0&&now-Date.parse(v)<86400000)?3600000:86400000;
