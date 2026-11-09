// Edit handles here. Empty handles are intentional coming-soon placeholders.
export const ACCOUNTS = {
 tt:{name:'TikTok',query:'tiktok',handles:['gabriellvl','gabinho_bjj','gabe.maxxing']},
 ig:{name:'Instagram',query:'instagram',handles:['gabe.maxxing','gabinho_bjj','','']},
 x:{name:'X',query:'x',handles:['gabe_maxxing','']},
 li:{name:'LinkedIn',query:'linkedin',handles:['francisco-gabriel-van-langenhove']},
 tw:{name:'Twitch',query:'twitch',handles:['gabe_maxxing']},
 yt:{name:'YouTube',query:'youtube',handles:['']},
};
export const normalizedHandle=value=>String(value||'').trim().replace(/^@/,'').toLowerCase();
export const platformID=value=>Object.keys(ACCOUNTS).find(k=>k===value||ACCOUNTS[k].query===value)||'';
export const configuredAccounts=()=>Object.entries(ACCOUNTS).flatMap(([platform,config])=>config.handles.filter(Boolean).map(account=>({platform,account})));
export const isConfigured=(platform,account)=>ACCOUNTS[platform]?.handles.some(h=>h&&normalizedHandle(h)===normalizedHandle(account))||false;
export function filteredPosts(posts,platform='',account=''){return posts.filter(p=>p.made_with_compound&&(!platform||p.platform===platform)&&(!account||normalizedHandle(p.account)===normalizedHandle(account)));}
