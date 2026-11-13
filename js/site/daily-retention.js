import {readPreference,savePreference} from '../storage.js';
import {t} from '../i18n/language.js';
import {nextRealmReset} from '../realm-reset.js';
import {todayCompletion,newsSince} from './daily-state.js?v=20261113retention1';

const note=document.querySelector('.daily-note');
if(note){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/css/site/daily-retention.css?v=20261113retention1';document.head.append(css);
  const root=document.createElement('section');root.id='daily-return';root.className='daily-group daily-retention';root.hidden=true;
  const make=(tag,key)=>{const el=document.createElement(tag);if(key)el.dataset.i18n=key;return el;};
  const complete=make('div'),heading=make('h2','retention.title'),streak=make('p','retention.streak'),teaser=make('p','retention.teaser'),reminder=make('a','retention.reminder');
  reminder.href='#signup';teaser.className='site-fine';complete.append(heading,streak,teaser,reminder);
  const news=make('p'),prefix=make('span','retention.new'),latest=make('a');news.className='site-fine retention-news';news.append(prefix,document.createTextNode(' '),latest);
  root.append(complete,news);note.after(root);
  const lastVisit=readPreference('daily-last-visit');let changes=[],reset;
  function render(){
    const done=todayCompletion(readPreference('daily-games',{}));
    complete.hidden=!done;news.hidden=!changes.length;root.hidden=!done&&!changes.length;
    for(const el of [heading,teaser,reminder,prefix])el.textContent=t(el.dataset.i18n);
    if(done){streak.dataset.i18nCount=String(done.streak);streak.textContent=t('retention.streak').replace('{count}',String(done.streak));}
    if(changes.length){latest.dataset.i18n=changes[0].key;latest.textContent=t(changes[0].key);latest.href=changes[0].href;}
    clearTimeout(reset);reset=setTimeout(render,Math.max(1,nextRealmReset()-Date.now()+25));
  }
  window.addEventListener('corvus-language-change',render);
  window.addEventListener('storage',event=>{if(event.key==='daily-games'||event.key===null)render();});
  window.addEventListener('pageshow',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  reminder.addEventListener('click',()=>{for(let el=document.getElementById('signup');el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;});
  render();
  fetch('/data/daily-changelog.json',{cache:'no-cache'}).then(response=>{
    if(!response.ok)throw Error('changelog unavailable');return response.json();
  }).then(entries=>{
    if(!Array.isArray(entries))return;
    const now=Date.now();changes=newsSince(entries,lastVisit,now);
    savePreference('daily-last-visit',now);render();
  }).catch(()=>{}); // Offline visits keep the previous timestamp for the next successful visit.
}
