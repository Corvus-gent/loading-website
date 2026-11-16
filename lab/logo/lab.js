const editions = [
  ['prompt','The beak opens a command. The perch waits for your next move.','#102823','#b7f6cd','#31aa78'],
  ['legio','A crow raises the standard. Its banner carries the hooked end of a boarding bridge.','#382334','#f3d9aa','#ba8645'],
  ['flyer','The lantern has changed hands. A scruffy street crow takes Diogenes’ night shift.','#f6e8c8','#2c2922','#b74325'],
  ['sigil','Follow the outer arc to read a C. Follow its upper edge to find the bird.','#16293d','#f2f4e9','#95b9d9'],
  ['arcade','A second player arrives on sixteen squares. The sprite speaks seven languages.','#302751','#fed79f','#fe937b']
];
const $ = id => document.getElementById(id);
const base = '/public/logo-lab/';
const photo = (src,width,extra='') => '<img alt="" width="'+width+'" src="'+src+'" '+extra+'>';
let selected, timer;
const languages = ['corvus','kraai','corbeau','cuervo','Krähe','corvo','乌鸦'];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
function animateName(){
  clearInterval(timer);
  $('living').textContent = selected==='arcade' ? languages[0] : '';
  if(selected!=='arcade'||motion.matches)return;
  let i=0;
  timer=setInterval(()=>{$('living').textContent=languages[++i%languages.length]},1600);
}
motion.addEventListener('change',animateName);
for (const [slug] of [['current'],...editions]){
  const btn=document.createElement('button');
  btn.className='sample';btn.dataset.slug=slug;
  const current=slug==='current';btn.disabled=current;
  btn.innerHTML='<span class="pair">'+['black','white'].map(tone=>'<i>'+photo(current?'/logo.png':base+slug+'/mono-'+tone+'.svg',58)+'</i>').join('')+'</span><strong>'+slug.toUpperCase()+'</strong>';
  $('compare').append(btn);
  if(!current){$('edition').add(new Option(slug.toUpperCase(),slug));btn.onclick=()=>choose(slug)}
}
function choose(slug){
  const data=editions.find(row=>row[0]===slug)||editions[0];
  const [name,story,ground,ink,accent]=data;
  selected=name; const dir=base+name+'/';
  const img=(file,size,extra)=>photo(dir+file,size,extra);
  for (const [k,v] of Object.entries({ground,ink,accent}))document.body.style.setProperty('--'+k,v);
  document.querySelector('link[rel=icon]').href=dir+'favicon-32.png';
  $('head-mark').src=dir+'mark.svg';$('title').textContent=name.toUpperCase();
  $('edition-number').textContent='EDITION 0'+(editions.indexOf(data)+1)+' / 05';
  $('hero').src=dir+(['prompt','flyer','arcade'].includes(name)?'animated':'mark')+'.svg';
  $('hero').alt=name+' symbol';$('story').textContent=story;$('kit').href=dir+'kit.zip';
  $('edition').value=name;$('pick').textContent='Pick '+name.toUpperCase();
  $('vote').querySelector('output').textContent='';
  document.querySelectorAll('.sample:not(:disabled)').forEach(b=>b.setAttribute('aria-pressed',b.dataset.slug===name));
  const avatar=img('avatar-400.png',43,'class="avatar"');
  const profile=(label)=>'<div class="profile"><div class="banner">'+img('wordmark.svg',100)+'</div>'+avatar+'<b>'+label+'</b></div>';
  const mocks=[
   ['Browser tab','', '<div class="tab">'+img('favicon-16.png',16)+' corvus.gent　×</div>'],
   ['X profile','',profile('@corvus')],
   ['Instagram tile','instagram',img('lockup-stacked.svg',135)],
   ['TikTok avatar','tiktok','<div>'+img('avatar-400.png',76,'class="avatar"')+'<br>@corvus.gent</div>'],
   ['LinkedIn company page','',profile('Corvus · Gent')],
   ['Twitch overlay','stream','<div>'+img('mark.svg',24)+'　● LIVE</div>'],
   ['Laptop sticker','','<div class="device">'+img('mark.svg',60)+'</div>'],
   ['Hoodie chest print','','<div class="hood">'+img('lockup-stacked.svg',48)+'</div>'],
   ['Email signature','','<div class="email">See you on deck,<hr>'+img('favicon-32.png',25)+'<b>Gabe</b> · corvus.gent</div>'],
   ['Shared link','','<div class="linkcard">'+img('og-1200x630.png',220)+'<b>corvus.gent</b></div>']
  ];
  $('contexts').innerHTML=mocks.map(([label,style,content])=>'<figure><div class="scene '+style+'">'+content+'</div><figcaption>'+label+'</figcaption></figure>').join('');
  $('squint').innerHTML=[16,24,32,48,'blur','1-bit'].map(s=>'<div class="size '+(s==='blur'?'blur':s==='1-bit'?'bit':'')+'">'+img(s==='1-bit'?'one-bit.png':s===16||s===32?'favicon-'+s+'.png':'small.svg',typeof s==='number'?s:32)+'<span>'+s+(typeof s==='number'?' px':'')+'</span></div>').join('');
  const url=new URL(location.href);url.searchParams.set('logo',name);history.replaceState(null,'',url);
  $('home').src='home.html?logo='+name;
  animateName();
}
$('edition').onchange=e=>choose(e.target.value);
choose(new URLSearchParams(location.search).get('logo'));
$('vote').onsubmit=async e=>{
 e.preventDefault();const button=$('pick');button.disabled=true;const slug=selected;
 try{
  const response=await fetch('/api/logo-lab',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,part:$('part').value.trim()})});
  if(!response.ok)throw Error();
  if(selected===slug){$('vote').querySelector('output').textContent='Pick saved. Thank you.';$('part').value=''}
 }catch{if(selected===slug)$('vote').querySelector('output').textContent='Your pick could not be saved. Try again.'}
 finally{button.disabled=false}
};
