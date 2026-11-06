import {init,t} from './copy.js?v=20261106-consul';import {$,api,errorText} from './client.js?v=20261106-consul';
let data;function render(){if(!data)return;
 const metric=(label,value)=>{const div=document.createElement('div'),n=document.createElement('strong'),l=document.createElement('span');n.textContent=String(value??0);l.textContent=label;div.append(n,l);return div;};
 $('war-counts').replaceChildren(metric('soldiers',data.soldiers),metric('at the gate',data.atGate),metric(t('recruits'),data.recruits),metric('approved',data.approved));
 for(const [id,key]of [['war-leaderboard','leaderboard'],['war-recruiters','recruiters']]){const root=$(id);root.replaceChildren(...data[key].map(s=>{const row=document.createElement('li'),a=document.createElement('a'),score=document.createElement('span');a.href='/soldier/'+encodeURIComponent(s.username);a.textContent=s.username;score.textContent=s.rank+' · '+(key==='recruiters'?s.recruits:s.points);row.append(a,score);return row;}));if(!data[key].length)root.textContent=t('empty');}
 $('war-ranks').replaceChildren(...Object.entries(data.ranks).map(([name,count])=>metric(name,count)));
 $('war-tiers').replaceChildren(...Object.entries(data.tiers||{}).map(([name,count])=>metric(name,count)));
}
init(render);async function load(){if(document.hidden)return;try{data=await api(null,'?view=public');render();$('war-status').textContent='';}catch(error){$('war-status').textContent=errorText(error);}}load();const timer=setInterval(load,30000);window.addEventListener('pagehide',()=>clearInterval(timer));
