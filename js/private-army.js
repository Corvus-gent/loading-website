export async function mountArmy(root){
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const heading=el('h2','legion / gate'),status=el('p'),controls=el('div'),list=el('div'),payments=el('div');
 const filter=el('select');for(const name of ['all','member','subscriber','unconfirmed','waiting','approved','later','rejected'])filter.append(new Option(name,name==='all'?'':name));
 filter.setAttribute('aria-label','application status');const search=el('input');search.placeholder='username or email';search.setAttribute('aria-label','find application');search.type='search';const refresh=el('button','refresh');controls.append(filter,search,refresh);root.replaceChildren(heading,status,controls,list,payments);
 let offset=0,sequence=0,searchTimer;
 const pagination=el('div'),previous=el('button','← Previous'),pageLabel=el('span'),next=el('button','Next →');
 for(const button of [previous,next]){button.type='button';button.style.minHeight='44px';}
 pagination.style.cssText='display:flex;gap:12px;align-items:center;flex-wrap:wrap';pagination.append(previous,pageLabel,next);list.after(pagination);
 previous.onclick=()=>{offset=Math.max(0,offset-40);load();};next.onclick=()=>{offset+=40;load();};
 async function request(data){const r=await fetch('/api/army?admin=1'+(!data?'&status='+encodeURIComponent(filter.value)+'&search='+encodeURIComponent(search.value)+'&offset='+offset:''),{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok)throw Error(body.error||'unavailable');return body;}
 async function action(data,button){button.disabled=true;try{await request(data);await load();}catch(e){status.textContent=e.message;button.disabled=false;}}
 const helpForm=el('form'),helpTitle=el('h3','confirm help or an intro'),helpName=el('input'),kind=el('select'),reference=el('input'),helpButton=el('button','approve contribution (+25)'),helpStatus=el('p');
 helpName.placeholder='corvus username';helpName.setAttribute('aria-label','contributor username');helpName.required=true;helpName.maxLength=24;
 for(const name of ['help','intro'])kind.append(new Option(name,name));kind.setAttribute('aria-label','contribution type');
 reference.placeholder='report or intro reference (one per contribution)';reference.setAttribute('aria-label','contribution reference');reference.required=true;reference.minLength=8;reference.maxLength=180;
 helpButton.type='submit';helpButton.style.minHeight='44px';helpStatus.setAttribute('role','status');helpForm.append(helpTitle,el('p','only confirm help you have checked. the same reference counts once; payment never counts.'),helpName,kind,reference,helpButton,helpStatus);controls.after(helpForm);
 helpForm.onsubmit=async event=>{event.preventDefault();if(!helpForm.reportValidity())return;helpButton.disabled=true;try{const result=await request({action:'approve-help',username:helpName.value,kind:kind.value,reference:reference.value});helpStatus.textContent=result.credited?'confirmed. +25 earned points.':'already counted. no extra points.';await load();}catch(e){helpStatus.textContent=e.message;}finally{helpButton.disabled=false;}};
 async function load(){const ticket=++sequence;previous.disabled=true;next.disabled=true;try{
  const data=await request();if(ticket!==sequence)return;
  if(!data.rows.length&&offset>0){offset=Math.max(0,offset-40);return load();}
  pageLabel.textContent=data.total?`${offset+1}–${offset+data.rows.length} of ${data.total}`:'0 members';
  previous.disabled=offset===0;next.disabled=offset+data.rows.length>=data.total;
  status.textContent=(data.discordReady?'discord connected.':'discord not connected. approved invitations are queued.')+(data.discordAudit?.state==='unsafe'?' WARNING: Discord invite permissions changed. ':'')+' mail queue: '+(data.mail?.waiting||0)+' · '+(data.mail?.state||'idle');
  list.replaceChildren();for(const row of data.rows){const article=el('article');article.style.cssText='border-top:1px solid #333;padding:20px 0;overflow-wrap:anywhere';article.append(el('h3',(row.username||'subscriber')+' · '+row.status),el('p',row.email+' · '+(row.verified?'email verified':'email unconfirmed')),el('p',row.why||'No gate application — joined as an account.'),el('p','rank: '+(row.rank||'tiro')+' · country: '+(row.country||'—')+' · recruits: '+(row.recruits||0)+' · joined: '+(row.created||row.applied||'—')));if(row.link){const a=el('a',row.link);a.href=row.link;a.target='_blank';a.rel='noopener noreferrer';article.append(a);}const actions=el('p');for(const name of (row.applied?['approve','reject','later']:[])){const b=el('button',name);b.disabled=name==='approve'&&!row.verified;b.style.minHeight='44px';b.onclick=()=>action({action:name,id:row.id,notify:name==='reject'?confirm('send a polite rejection email?'):false},b);actions.append(b);}article.append(actions);list.append(article);}
  payments.replaceChildren(el('h3','unmatched payments'));for(const p of data.unmatched||[]){const row=el('div'),label=el('span',p.date+' · '+(p.level||p.type)+' · '+p.amount+' '+p.currency+' · '+(p.username||'no handle'));const input=el('input');input.placeholder='corvus username';input.setAttribute('aria-label','match payment to username');const b=el('button','link to username');b.onclick=()=>action({action:'link-toll',payment:p.event,username:input.value.trim()},b);row.append(label,input,b);payments.append(row);}
  if(!data.rows.length)list.append(el('p','the gate is quiet.'));if(!(data.unmatched||[]).length)payments.append(el('p','nothing waiting to be linked.'));
 }catch(e){if(ticket===sequence){status.textContent='legion unavailable: '+e.message;previous.disabled=offset===0;}}}
 const reset=()=>{offset=0;load();};refresh.onclick=load;filter.onchange=reset;search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(reset,300);};await load();
}
