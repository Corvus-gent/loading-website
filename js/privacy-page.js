import {initI18n, getLang} from './i18n.js';
import {PRIVACY_VERSION,strings} from './privacy-strings.js';
import {analyticsAllowed,chooseAnalytics,privacySignal,consentChoice} from './analytics-consent.js';
import {ARMY_PRIVACY} from './army/privacy-copy.js?v=20261106-earned1';
function choiceLabels(){
 const copy=strings[getLang()];
 document.getElementById('analytics-choice-title').textContent=copy.change;
 document.getElementById('analytics-status').textContent=privacySignal()?copy.signal:analyticsAllowed()?copy.on:copy.off;
 const allow=document.getElementById('analytics-allow');allow.textContent=copy.allow;allow.disabled=consentChoice()?.choice==='allow';
 document.getElementById('analytics-deny').textContent=analyticsAllowed()?copy.withdraw:copy.deny;
}
document.getElementById('analytics-allow').onclick=()=>chooseAnalytics('allow');
document.getElementById('analytics-deny').onclick=()=>chooseAnalytics('deny');
window.addEventListener('analytics-consent-change',choiceLabels);
const providers = [
 ['Vercel','https://vercel.com/legal/privacy-notice'],['PostHog EU','https://posthog.com/privacy'],
 ['Resend','https://resend.com/legal/privacy-policy'],['Upstash','https://upstash.com/trust/privacy.pdf'],
 ['Redis Cloud','https://redis.io/legal/privacy-policy/'],['CARTO','https://carto.com/privacy'],
 ['Spotify','https://www.spotify.com/legal/privacy-policy/'],['Apple','https://www.apple.com/legal/privacy/'],
 ['Buy Me a Coffee','https://buymeacoffee.com/privacy-policy'],['Pidgy','https://app.pidgy-ai.com/privacy-policy'],['Notion','https://www.notion.com/privacy'],
];
let generation=0;
async function render(){
 const n=++generation,copy=(await import(`./privacy-locales/${getLang()}.js`)).default;
 if(n!==generation)return;
 choiceLabels();
 document.getElementById('analytics-choice-info').textContent=copy.consentInfo;
 document.title=`${copy.title} | corvus.gent`;
 document.getElementById('privacy-title').textContent=copy.title;
 document.getElementById('privacy-meta').textContent=`${copy.updated} · ${PRIVACY_VERSION}`;
 const intro=document.getElementById('privacy-intro');intro.replaceChildren();
 copy.intro.forEach(text=>{const p=document.createElement('p');p.textContent=text;intro.append(p);});
 const sections=document.getElementById('privacy-sections');sections.replaceChildren();
 for(const [id,title,...paragraphs] of copy.sections){
  const section=document.createElement('section');section.id=id;
  const h=document.createElement('h2');h.textContent=title;section.append(h);
  for(const html of paragraphs){const p=document.createElement('p');p.innerHTML=html;section.append(p);}
  sections.append(section);
 }
 const army=document.createElement('section');army.id='legion-privacy';const [armyTitle,...armyText]=ARMY_PRIVACY[getLang()]||ARMY_PRIVACY.en;const armyHeading=document.createElement('h2');armyHeading.textContent=armyTitle;army.append(armyHeading);for(const text of armyText){const p=document.createElement('p');p.textContent=text;army.append(p);}const account=document.createElement('a');account.href='/army/access/';account.textContent='corvus.gent/army/access →';army.append(account);sections.append(army);
 document.getElementById('privacy-providers-title').textContent=copy.providersTitle;
 document.getElementById('privacy-providers-note').textContent=copy.providersNote;
 const list=document.getElementById('privacy-providers');list.replaceChildren();
 providers.forEach(([name,url],i)=>{const li=document.createElement('li'),a=document.createElement('a');a.href=url;a.rel='noreferrer';a.textContent=`${name} · ${copy.roles[i]}`;li.append(a);list.append(li);});
}
initI18n(render);render();
