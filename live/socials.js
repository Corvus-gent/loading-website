// The one account list for /live. Empty URLs are intentional TODOs, never links.
// Flip isLive for a stream; Twitch can also be detected with the existing server credentials.
export const SOCIALS = [
  {platform:'twitch',handle:'gabe_maxxing',url:'https://www.twitch.tv/gabe_maxxing',label:'Twitch',line:'the whole build. the beautiful chaos.',icon:'▣',primary:true,isLive:false},
  {platform:'youtube',handle:'',url:'',label:'YouTube',line:'TODO: Gabe’s YouTube channel.',icon:'▶',primary:true,isLive:false},
  {platform:'tiktok',handle:'gabe.maxxing',url:'https://www.tiktok.com/@gabe.maxxing',label:'TikTok',line:'startup sidequests. short attention spans.',icon:'♪',primary:true,isLive:false},
  {platform:'instagram',handle:'gabe.maxxing',url:'https://www.instagram.com/gabe.maxxing/',label:'Instagram',line:'robots, builders, behind the scenes.',icon:'◎',primary:true,isLive:false},
  {platform:'x',handle:'gabe_maxxing',url:'https://x.com/gabe_maxxing',label:'X',line:'the running commentary.',icon:'𝕏',primary:true,isLive:false},
  {platform:'linkedin',handle:'Francisco Gabriel Van Langenhove',url:'https://www.linkedin.com/in/francisco-gabriel-van-langenhove/',label:'LinkedIn',line:'building in public, with receipts.',icon:'in',primary:true,isLive:false},
  {platform:'instagram',handle:'gabinho_bjj',url:'https://www.instagram.com/gabinho_bjj/',label:'Instagram · jiu-jitsu',isLive:false},
  {platform:'instagram',handle:'',url:'',label:'Instagram · account 3',todo:'TODO: handle',isLive:false},
  {platform:'instagram',handle:'',url:'',label:'Instagram · account 4',todo:'TODO: handle',isLive:false},
  {platform:'tiktok',handle:'gabriellvl',url:'https://www.tiktok.com/@gabriellvl',label:'TikTok · personal',isLive:false},
  {platform:'tiktok',handle:'gabinho_bjj',url:'https://www.tiktok.com/@gabinho_bjj',label:'TikTok · jiu-jitsu',isLive:false},
  {platform:'x',handle:'',url:'',label:'X · account 2',todo:'TODO: handle',isLive:false}
];
export function liveURL(account) {
  if(!account.url)return null;
  const url=new URL(account.url);
  for(const [key,value] of Object.entries({utm_source:'corvus',utm_medium:'live_page',utm_campaign:'hack3',utm_content:account.platform}))url.searchParams.set(key,value);
  return url.href;
}
export const IG_DM=liveURL({platform:'instagram',url:'https://ig.me/m/gabe.maxxing'});
