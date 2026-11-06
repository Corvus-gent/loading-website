import {init,t,getLang} from './copy.js?v=20261106c';
import {$,api,errorText} from './client.js?v=20261106c';
let members=[];
function flag(code){return code?.match(/^[A-Z]{2}$/)?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'';}
function render(){
 const query=$('legion-search').value.trim().toLowerCase(),tier=$('legion-tier').value,country=$('legion-country').value;
 const rows=members.filter(s=>(!query||s.username.includes(query))&&(!tier||s.tier===tier)&&(!country||s.country===country));
 $('legion-list').replaceChildren(...rows.map(s=>{const card=document.createElement('article');card.className='legion-card tier-'+(s.tier||'none');
 const name=document.createElement('a');name.className='legion-name';name.href='/soldier/'+encodeURIComponent(s.username);name.textContent=s.username;
 const badge=document.createElement('p');badge.className='legion-badge';badge.textContent=t('tier')+': '+(s.tier||t('unpaid'))+' · '+t('rank')+': '+s.rank;
 const date=document.createElement('p');date.className='army-fine';date.textContent=flag(s.country)+' '+t('since')+' '+s.created;card.append(name,badge,date);
 if(s.link){const link=document.createElement('a');link.href=s.link;link.rel='noopener noreferrer';link.target='_blank';link.className='legion-external';link.textContent=new URL(s.link).hostname+' ↗';card.append(link);}return card;
 }));$('legion-status').textContent=rows.length?'':t(members.length?'noResults':'empty');
}
function countries(){const selected=$('legion-country').value,names=new Intl.DisplayNames([getLang()],{type:'region'});$('legion-country').replaceChildren(new Option(t('all'),''),...[...new Set(members.map(s=>s.country).filter(Boolean))].sort().map(code=>new Option(names.of(code),code)));$('legion-country').value=selected;}
init(()=>{countries();render();});for(const id of ['legion-search','legion-tier','legion-country'])$(id).addEventListener('input',render);
api(null,'?view=legion').then(data=>{members=data.members;countries();render();}).catch(error=>$('legion-status').textContent=errorText(error));
