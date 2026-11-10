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
export const platformID=value=>{const key=String(value||'').trim().toLowerCase();return Object.keys(ACCOUNTS).find(k=>k===key||ACCOUNTS[k].query===key)||'';};
// The export tracker uses `gl` for Gabe's personal LinkedIn account.
export const accountHandle=(platform,value)=>platformID(platform)==='li'&&normalizedHandle(value)==='gl'?ACCOUNTS.li.handles[0]:normalizedHandle(value);
export const configuredAccounts=()=>Object.entries(ACCOUNTS).flatMap(([platform,config])=>config.handles.filter(Boolean).map(account=>({platform,account})));
export const isConfigured=(platform,account)=>ACCOUNTS[platform]?.handles.some(h=>h&&normalizedHandle(h)===normalizedHandle(account))||false;
export function filteredPosts(posts,platform='',account=''){return posts.filter(p=>p.made_with_compound&&(!platform||platformID(p.platform)===platformID(platform))&&(!account||accountHandle(p.platform,p.account)===accountHandle(p.platform,account)));}
