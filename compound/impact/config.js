export const IMPACT_CONFIG = {
 weights:{views:1,likes:3,comments:8,shares:10,saves:5},
 platforms:{tt:'TikTok',ig:'Instagram',x:'X',li:'LinkedIn',yt:'YouTube'},
 refreshSeconds:60,syncSeconds:1800,
 referralParam:'ref',
};
export const METRICS=['views','likes','comments','shares','saves'];
export const score=p=>METRICS.reduce((sum,k)=>sum+(Number(p[k])||0)*IMPACT_CONFIG.weights[k],0);
export const engagements=p=>['likes','comments','shares','saves'].reduce((sum,k)=>sum+(Number(p[k])||0),0);
export const SEEDS=[['2116903246925005017',5052,54],['2116942344897315184',2148,2],['2117385600521195590',1645,6],['2116942074486632558',1192,2],['2116939413934768393',920,6]].map(([id,views,likes])=>({post_url:'https://x.com/gabe_maxxing/status/'+id,views,likes,made_with_compound:true,account:'gabe_maxxing',metric_source:'manual',measured_date:'2026-11-09',label:'Gabe · made with Compound'}));
