// Classify locally; never transmit or persist a raw user agent/referrer URL.
const known=new Set(['direct','corvus','linkedin','instagram','tiktok','facebook','youtube','threads','discord','x','luma','whatsapp','email','qr','buymeacoffee','share','self','google','bing','duckduckgo','hostel','video','offline','compound','dm','other']);
export function inferredSource({search='',userAgent='',referrer=''}={}){
 const q=new URLSearchParams(search),utm=q.get('utm_source');
 if(utm)return{source:known.has(utm.toLowerCase())?utm.toLowerCase():'other',source_confidence:'utm'};
 for(const [pattern,source]of [[/Instagram/i,'instagram'],[/FBAN|FBAV/i,'facebook'],[/LinkedInApp/i,'linkedin'],[/TikTok|musical_ly|BytedanceWebview/i,'tiktok'],[/Twitter/i,'x']])if(pattern.test(userAgent))return{source,source_confidence:'user_agent'};
 let host='';try{host=new URL(referrer.includes('://')?referrer:'https://'+referrer).hostname.toLowerCase();}catch{}
 for(const [domain,source]of [['lnkd.in','linkedin'],['linkedin.com','linkedin'],['instagram.com','instagram'],['t.co','x'],['x.com','x'],['facebook.com','facebook'],['tiktok.com','tiktok']])if(host===domain||host.endsWith('.'+domain))return{source,source_confidence:'referrer'};
 return{source:'direct',source_confidence:'unknown'};
}
