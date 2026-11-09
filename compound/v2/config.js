export const DEADLINE='2026-11-09T17:00:00Z';
export const PLATFORMS={tt:'TikTok',ig:'Instagram',x:'X',li:'LinkedIn',tw:'Twitch',yt:'YouTube Shorts'};
export const SOURCES={tt:'tiktok',ig:'instagram',x:'x',li:'linkedin',tw:'twitch',yt:'youtube'};
export const ACCOUNTS={gl:'gabriel.lvl',bjj:'gabinho8.0',gm:'gabe.maxing',collab:'IG collab'};
export const HOOKS={a:'A',b:'B',c:'C',d:'D',e:'Sidequest',f:'F',mom:'Mom',bjj:'BJJ',startup:'Startup',side:'Sidequest',comm:'Community',int:'Interview',live:'Live'};
export const LANGUAGES={
 nl:['Nederlands','Kijk mee. Zeg wat beter kan.'],en:['English','Watch it. Tell me what hits.'],fr:['Français','Regarde. Dis-moi ce qui fonctionne.'],pt:['Português','Vê o vídeo. Diz-me o que funciona.'],es:['Español','Míralo. Dime qué funciona.'],de:['Deutsch','Schau rein. Sag mir, was funktioniert.'],it:['Italiano','Guarda. Dimmi cosa funziona.'],ca:['Català','Mira’l. Digues què funciona.'],eu:['Euskara','Ikusi bideoa. Eman zure iritzia.'],tl:['Filipino','Panoorin mo. Sabihin kung ano ang mas maganda.'],zh:['中文','看看视频，告诉我怎样改得更好。'],tr:['Türkçe','İzle. Nasıl daha iyi olur, söyle.'],ar:['العربية','شاهد الفيديو وقل لي كيف أجعله أفضل.'],ru:['Русский','Посмотри. Скажи, что можно улучшить.'],ce:['Нохчийн','Кху видеона хьажала.'],pl:['Polski','Obejrzyj. Powiedz, co poprawić.'],fa:['فارسی','ویدیو را ببین و بگو چطور بهترش کنم.'],ln:['Lingála','Talá video. Pesá makanisi na yo.'],ay:['Aymar aru','Aka video uñtam, amuyuma arsum.'],qu:['Runasimi','Kay videota qhaway, yuyayniykita willay.']
};
export const MEDIUMS=['bio','story','post','comment','dm','live'];
export function parseSlug(value){
 const match=/^(tt|ig|x|li|tw|yt)-(gl|bjj|gm|collab)-([a-z]{2})-([a-z]+)([1-9]\d{0,3})$/.exec(String(value||''));
 if(!match||!Object.hasOwn(LANGUAGES,match[3])||!Object.hasOwn(HOOKS,match[4]))return null;
 return{slug:match[0],platform:match[1],account:match[2],lang:match[3],hook:match[4],n:Number(match[5])};
}
export const videoPath=v=>`/compound/v2/${v.lang}/${v.hook}/${v.n}`;
export const shortURL=v=>'https://corvus.gent/v/'+v.slug;
export function fullURL(v,medium='post'){
 const u=new URL(videoPath(v),'https://corvus.gent');u.searchParams.set('video',v.slug);
 for(const[k,val]of Object.entries({utm_source:SOURCES[v.platform],utm_medium:MEDIUMS.includes(medium)?medium:'post',utm_campaign:'compound-v2',utm_content:v.slug}))u.searchParams.set(k,val);
 return u.href;
}
export const SEED_VIDEOS=['tt-gl-nl-mom1','tt-gl-nl-a1','tt-bjj-pt-bjj1','tt-bjj-en-comm1','tt-bjj-es-a1','tt-gm-en-b1','tt-gm-en-startup1','tt-gm-ru-a1','ig-collab-en-mom1','ig-collab-nl-a1','ig-gl-fr-comm1','x-gm-en-b1','x-gm-en-f1','li-gl-en-startup1','li-gl-nl-c1'].map(slug=>({...parseSlug(slug),post_url:'',compound_url:'',posted_at:null,views:0,likes:0,comments:0,shares:0,updated_at:null,is_example:false,metric_source:'pending',awaiting_url:true}));
export function voteCode(v){return `${v.lang}-${v.hook}-${v.n}`.toUpperCase();}
// Printed export codes include the second dash. Older shared codes still work.
export function parseCode(value){const m=/^([a-z]{2})-?([a-z]+)-?([1-9]\d{0,3})$/i.exec(String(value||'').trim());if(!m||!Object.hasOwn(LANGUAGES,m[1].toLowerCase())||!Object.hasOwn(HOOKS,m[2].toLowerCase()))return null;const v={lang:m[1].toLowerCase(),hook:m[2].toLowerCase(),n:Number(m[3])};return{...v,code:voteCode(v)};}

export const codeURL=v=>'https://corvus.gent/c/'+voteCode(v);
export function pinnedComment(v){const ask={nl:'stem op de volgende cut',en:'vote on the next cut',fr:'vote pour le prochain montage',pt:'vota no próximo corte',es:'vota el próximo montaje',de:'stimme für den nächsten Schnitt',it:'vota il prossimo montaggio'};return `🗳️ ${ask[v.lang]||ask.en}: corvus.gent/c/${voteCode(v)}`;}
