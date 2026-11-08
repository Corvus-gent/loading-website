import {init,t} from './copy.js?v=20261108-entry1';import {$,api,errorText,rankBadges} from './client.js?v=20261108-entry1';
let data;function render(){if(!data)return;
 const metric=(label,value)=>{const div=document.createElement('div'),n=document.createElement('strong'),l=document.createElement('span');n.textContent=String(value??0);l.textContent=label;div.append(n,l);return div;};
 $('war-counts').replaceChildren(metric(t('soldiers'),data.soldiers),metric(t('atGate'),data.atGate),metric(t('recruits'),data.recruits),metric(t('warApproved'),data.approved));
 for(const [id,key]of [['war-leaderboard','leaderboard'],['war-recruiters','recruiters']]){const root=$(id);root.replaceChildren(...data[key].map(s=>{const row=document.createElement('li'),a=document.createElement('a'),score=document.createElement('span');a.href='/soldier/'+encodeURIComponent(s.username);a.textContent=s.username;score.textContent=key==='recruiters'?s.recruits+' '+t('recruits'):t('rankPoints',{n:s.points});const badges=document.createElement('div');rankBadges(badges,s,{compact:true});row.append(a,score,badges);return row;}));if(!data[key].length)root.textContent=t('empty');}
 $('war-ranks').replaceChildren(...Object.entries(data.ranks).map(([name,count])=>metric(t('rankLabel')+' '+name,count)));
 $('war-tiers').replaceChildren(...Object.entries(data.tiers||{}).filter(([name])=>name!=='imperator').map(([name,count])=>metric(t('tierLabel')+' '+name,count)));
}
init(render);async function load(){if(document.hidden)return;try{data=await api(null,'?view=public');render();$('war-status').textContent='';}catch(error){$('war-status').textContent=errorText(error);}}load();const timer=setInterval(load,30000);window.addEventListener('pagehide',()=>clearInterval(timer));
