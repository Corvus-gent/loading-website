import {clearTrackingURL,sidequestsPage} from './arrival.js';
import {strings} from './privacy-strings.js';
import {consentChoice,chooseAnalytics,privacySignal,analyticsAllowed} from './analytics-consent.js';
import {readPreference} from './storage.js';
const lang=()=>{
  const query=new URLSearchParams(location.search).get('lang');
  return [query,readPreference('lang'),document.documentElement.lang,navigator.language?.slice(0,2)].find(x=>Object.hasOwn(strings,x)) || 'en';
};
let notice;
function openNotice(open) {
 const root=document.documentElement,wasOpen=root.classList.contains('privacy-notice-open');
 if(wasOpen===open)return;
 const y=wasOpen?document.body.scrollTop:window.scrollY;
 root.classList.toggle('privacy-notice-open',open);
 if(open)document.body.scrollTop=y;else window.scrollTo(0,y);
}
function labels() {
  const copy=strings[lang()];
  document.querySelectorAll('[data-privacy-link]').forEach(a=>{a.textContent=copy.label;a.href='/privacy/'+(lang()==='en'?'':'?lang='+lang());});
  document.querySelectorAll('[data-spotify-notice]').forEach(p=>{p.textContent=copy.spotify;});
  if(notice){notice.setAttribute('aria-label',copy.label);notice.querySelector('.privacy-copy').textContent=copy.notice;notice.querySelector('a').textContent=copy.label+' →';notice.querySelector('a').href='/privacy/'+(lang()==='en'?'':'?lang='+lang());notice.querySelector('[data-allow]').textContent=copy.allow;notice.querySelector('[data-deny]').textContent=copy.deny;}
}
const privatePage=/^\/(?:stats\/)?private(?:\/|$)/.test(location.pathname)||/^\/music\/admin(?:\/|$)/.test(location.pathname);
// Disabled analytics and pages without an analytics script still get clean URLs.
if(privatePage||(!sidequestsPage && !analyticsAllowed())||!document.querySelector('script[src^="/js/analytics.js"]'))clearTrackingURL();
const dismissed=consentChoice()||privacySignal();
if(!dismissed&&!privatePage&&!/^\/402(?:\/|$)/.test(location.pathname)){
  notice=document.createElement('aside');notice.id='privacy-notice';notice.className='privacy-notice';notice.hidden=true;
  notice.innerHTML='<span class="privacy-dot" aria-hidden="true"></span><span class="privacy-copy"></span> <span class="privacy-actions"><a href="/privacy/"></a><span aria-hidden="true"> · </span><button type="button" data-deny></button><span aria-hidden="true"> · </span><button type="button" data-allow></button></span>';
  document.body.append(notice);
  const measure=()=>document.documentElement.style.setProperty('--privacy-notice-space',`${notice.hidden?0:notice.getBoundingClientRect().height+20}px`);
  const sync=()=>{const playing=document.body.dataset.gamePlaying==='true';notice.hidden=playing;measure();openNotice(!playing);};
  const observer=new MutationObserver(sync);
  const resize=new ResizeObserver(measure);resize.observe(notice);
  const timer=setTimeout(()=>{sync();requestAnimationFrame(()=>notice.classList.add('is-visible'));observer.observe(document.body,{attributes:true,attributeFilter:['data-game-playing']});},1500);
  const close=()=>{
    if(!notice)return;
    clearTimeout(timer);observer.disconnect();resize.disconnect();notice.remove();notice=null;
    openNotice(false);document.documentElement.style.removeProperty('--privacy-notice-space');
  };
  notice.querySelector('[data-allow]').onclick=()=>chooseAnalytics('allow');
  notice.querySelector('[data-deny]').onclick=()=>chooseAnalytics('deny');
  window.addEventListener('analytics-consent-change',()=>{if(consentChoice()||privacySignal())close();});
}
labels();new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
