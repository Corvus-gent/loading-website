// Canonical placement IDs. Aliases share one counter and one report row.
export const PLETHORA_PLACEMENTS = {
 daily:'Daily puzzle · top card',hub:'Games hub · top + every third tile',
 start:'OSSMAN · start',gameover:'OSSMAN · game over',promo:'OSSMAN · promotion',pause:'OSSMAN · pause',celtix:'Do-Bronx edition · game over',
 babel:'Babel · result',borders:'Borders · result',wordle:'Wordle · result',flags:'Flags · result',combo:'Combo · result',bangle:'Bangle · result',pingle:'Pingle · result',lantern:'Lantern · result',
 battle:'Battle · below videos',legion:'Legion · recruit perk',home:'Home · dismissible banner','404':'404 · lost visitor',share:'Game share text',footer:'Site footer',compound:'Compound · feedback page',hack:'Hack · name vote',
 x:'X post',li:'LinkedIn post',ig:'Instagram',tt:'TikTok',wa:'WhatsApp',game:'Game · legacy badge',qr:'QR scan',twitch:'Twitch',story:'Social story','bio-x':'X bio','bio-ig':'Instagram bio','bio-tt':'TikTok bio'
};
export const PLETHORA_ALIASES={bio:'bio-x'};
export const canonicalPlacement=value=>{const id=String(value||'').replace(/^plethora-/,'');return Object.hasOwn(PLETHORA_ALIASES,id)?PLETHORA_ALIASES[id]:Object.hasOwn(PLETHORA_PLACEMENTS,id)?id:null;};
export const PLETHORA_CATEGORIES={Games:['daily','hub','babel','borders','wordle','flags','combo','bangle','pingle','lantern'],OSSMAN:['start','gameover','promo','pause','celtix','game'],Site:['battle','legion','home','404','footer','compound','hack'],Campaigns:['share','x','li','ig','tt','wa','qr','twitch','story','bio-x','bio-ig','bio-tt']};
export const PLETHORA_COPY={hero:"Do you like mobile games??? Then you'll love this one 👀 My game that won me a hackathon is even on there. Check it!!",cta:'GET PLETHORA 📲',sub:'Find games worth keeping. No more download → delete → repeat.'};
export const PLETHORA_SHARE=' · more games: corvus.gent/go/plethora-share';
