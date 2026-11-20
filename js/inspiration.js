import {INSPIRATIONS} from './inspiration-data.js';
if(!document.querySelector('[data-inspiration-off]')&&!document.querySelector('meta[name="robots"][content*="noindex"]')&&!/^\/(admin|private|api|forms)(\/|$)/.test(location.pathname)) {
 const css=document.createElement('link');css.rel='stylesheet';css.href='/css/inspiration.css?v=20261120';document.head.append(css);
 const host=location.hostname==='stats.corvus.gent'?'https://corvus.gent':'';
 const route=location.pathname.split('').reduce((n,c)=>n+c.charCodeAt(0),0);
 const marginArt=INSPIRATIONS.filter(a=>['fallen','ember','diogenes'].includes(a.id));
 const pair=[INSPIRATIONS[0],marginArt[route%marginArt.length]];
 const rails=pair.map((art,i)=>{const a=document.createElement('a');a.className='inspiration-rail '+(i?'right':'left');a.href=host+'/tattoo/#'+art.id;a.setAttribute('aria-label','Explore inspiration: '+art.name);const img=new Image();img.src=art.image.replace('.webp','-margin.webp');img.alt='';img.loading='lazy';img.decoding='async';const label=document.createElement('span');label.textContent=art.name;a.append(img,label);a.hidden=true;document.body.append(a);return a;});
 const main=document.querySelector('main');
 if(main&&!location.pathname.startsWith('/tattoo')){const a=document.createElement('a');a.className='inspiration-mobile';a.href=host+'/tattoo/';const img=new Image();img.src=pair[1].image.replace('.webp','-margin.webp');img.alt='';img.loading='lazy';const text=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small');title.textContent='the things that stay with me.';sub.textContent=pair[1].name+' · open my inspiration book';text.append(title,sub);a.append(img,text);const section=main.querySelector(':scope > section');if(section)section.after(a);else main.append(a);}
 let frame;const place=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const content=document.querySelector('[data-art-boundary],main.site-page,main,.site-page');const rect=content?.getBoundingClientRect();rails.forEach((a,i)=>{const space=rect?(i?innerWidth-rect.right:rect.left):0;a.hidden=innerWidth<1280||space<145;if(!a.hidden)a.style.setProperty('--art-width',Math.min(250,space-42)+'px');});});};
 place();addEventListener('resize',place,{passive:true});if(main&&window.ResizeObserver)new ResizeObserver(place).observe(main);
}
