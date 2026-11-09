import fs from 'node:fs/promises';
import path from 'node:path';
import {PLETHORA_COPY} from '../js/plethora-config.js';
const version='20261108live1',escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const link=(id,text=PLETHORA_COPY.cta,cls='plethora-cta')=>`<a class="${cls}" href="/go/plethora-${id}" data-plethora="${id}">${escape(text)}</a>`;
const card=(id,title=PLETHORA_COPY.hero)=>`<aside class="plethora-card" data-plethora-card="${id}"><p class="plethora-kicker">CORVUS × PLETHORA / NEXT GAME FOUND</p><h2>${escape(title)}</h2>${link(id)}<p>${escape(PLETHORA_COPY.sub)}</p></aside>`;
const footer=`<div class="plethora-footer" data-plethora-footer>${link('footer','Games discovered on Plethora 📲','')}</div>`;
const files=[];async function walk(dir='.') {for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||['node_modules','submission','public','tests','test-results','playwright-report','tools'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(entry.name==='index.html'||file==='404.html')files.push(file);}}
await walk();
files.push("submission/index.html");
const catalog=(await fs.readFile("games/hub/index.html","utf8")).match(/<section class="plethora-catalog"[\s\S]*?<\/section>/)?.[0];
if(!catalog)throw Error("Missing game catalog");
for(const file of files){
 // Broadcast overlays must keep alpha and contain no website chrome.
 if(file==='live/overlay/index.html')continue;
 let s=await fs.readFile(file,'utf8');
 // Rebuild only our own marked slots, preserving hand-written page content.
 s=s.replace(/<!-- PLETHORA_[A-Z]+ -->[\s\S]*?<!-- \/PLETHORA_[A-Z]+ -->/g,'');
 const insert=(label,html,anchor,before=false)=>{const wrapped=`<!-- PLETHORA_${label} -->${html}<!-- /PLETHORA_${label} -->`;if(!s.includes(anchor))throw Error('Missing Plethora slot: '+file+' '+anchor);s=s.replace(anchor,before?wrapped+anchor:anchor+wrapped);};
 insert('HEAD',`<link rel="stylesheet" href="/plethora/promo.css?v=${version}">`,'</head>',true);
 insert('SCRIPT',`<script type="module" src="/js/plethora.js?v=${version}"></script>`,'</body>',true);
 if(file==='hack/play/index.html'){
  // Footer lives in the existing menu; it cannot cover the mat or controls.
  insert('FOOTER',footer,'<div id="faceoff"></div>');
 }else insert('FOOTER',footer,'</body>',true);
 if(file==='index.html')insert('HOME',`<aside class="plethora-banner" data-plethora-banner><div>${link('home','🎮 My hackathon-winning game is on Plethora → check it','')}<small data-plethora-live>The army is finding its next game.</small></div><button type="button" aria-label="Dismiss Plethora banner">×</button></aside>`,'<body class="portal">');
 if(file==='games/index.html'){insert('DAILY',card('daily')+'<p><a href="#board">play today’s puzzle ↓</a> · <a href="/games/hub/">all games →</a></p>','<div class="wrap games">');insert('CATALOG','<h2>more from the arcade</h2><p>Eight puzzles in rotation. One daily challenge.</p>'+catalog,'</dialog>');}
 if(file==='games/hub/index.html')insert('HUB',card('hub'),'<!-- HUB_INTRO_END -->');
 if(['hack/index.html','hack/2/index.html'].includes(file))insert('HUB',card('hack')+'<p><a href="/games/hub/">daily puzzles + all games →</a></p>','</nav>');
 if(file==='compound/index.html')insert('COMPOUND',card('compound','The army edits videos. It plays good games too.'),'<section class="privacy-note">',true);
 if(file==='battle/index.html')insert('BATTLE',card('battle',"Want more games like OSSMAN? It’s on Plethora 👀"),'<section id="reveal"',true);
 if(file==='legion/index.html')insert('LEGION',card('legion','Recruit perk: the army plays on Plethora'),'<div class="legion-filters',true);
 if(file==='404.html')insert('LOST',card('404','Lost? Find a good game instead → Plethora'),'<h1>404</h1>');
 await fs.writeFile(file,s);
}
console.log(`Plethora placements and footers: ${files.length} published pages.`);
