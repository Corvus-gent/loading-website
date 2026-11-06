import {init,t} from './copy.js?v=20261106-knock1';
import {$,api,tag,recruitURL,copy,share,saveArt,errorText,rankBadges} from './client.js?v=20261106-knock1';
const username=location.pathname.split('/').filter(Boolean)[1];let soldier,code;
async function render(){
 if(!soldier)return;$('soldier-name').textContent=soldier.username;rankBadges($('soldier-ranks'),soldier);
 $('soldier-metrics').replaceChildren(...['streak','feathers','recruits','since'].map(key=>{const box=document.createElement('div'),strong=document.createElement('strong'),label=document.createElement('span');strong.textContent=key==='since'?soldier.created:soldier[key];label.textContent=t(key);box.append(strong,label);return box;}));
 $('soldier-recruit-url').textContent=recruitURL(code);
 if(soldier.link){$('soldier-link').href=soldier.link;$('soldier-link').textContent=new URL(soldier.link).hostname+' ↗';$('soldier-link').hidden=false;}
 await tag($('soldier-tag'),soldier,code);
}
init(render);
api(null,'?profile='+encodeURIComponent(username)).then(data=>{soldier=data.soldier;code=data.code;return render();}).catch(error=>$('soldier-status').textContent=errorText(error));
$('soldier-copy').onclick=()=>code&&copy(code,$('soldier-status'));$('soldier-share').onclick=()=>code&&share(code,$('soldier-status'));$('soldier-save').onclick=()=>code&&saveArt(soldier,code,false,$('soldier-status'));$('soldier-poster').onclick=()=>code&&saveArt(soldier,code,true,$('soldier-status'));
