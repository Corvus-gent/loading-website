import fs from 'node:fs/promises';import path from 'node:path';
import {SECTIONS,ROUTES as EXISTING_ROUTES} from '../../js/site/routes.js';
import {generate} from './generate-directory.mjs';
let ROUTES=EXISTING_ROUTES;
export const VERSION='20261111layers1';
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const local=p=>p.replace(/^https:\/\/corvus.gent/,'').replace(/\/$/,'')||'/';
export function sectionFor(file){return ROUTES.find(r=>r.file===file)?.section||(/^hack\/|^compound\/|^battle\/|^build\//.test(file)?'quests':/^games\/|^music\/|^plethora\//.test(file)?'daily':/^army\/|^legion\/|^soldier\//.test(file)?'legion':/^live\//.test(file)?'live':'gabe');}
export function shell(file){const section=sectionFor(file),selected=SECTIONS.find(s=>s.id===section),isHome=file==='index.html';return {head:`${!isHome?'<script type="module" src="/js/live-banner.js?v=20261108live1"></script><link rel="stylesheet" href="/plethora/promo.css?v=20261108live1">':''}${file.startsWith('plethora/')?'<script type="module" src="/js/plethora.js?v=20261108live1"></script>':''}<link rel="stylesheet" href="/css/site/shell.css?v=${VERSION}"><script type="module" src="/js/site/shell.js?v=${VERSION}"></script>`,nav:isHome?'':`<nav class="site-nav" aria-label="Corvus sections" data-site-shell><a class="site-mark" href="/" aria-label="Corvus home">corvus ↟</a>${SECTIONS.map(s=>`<a href="${s.path}"${!isHome&&s.id===section?' aria-current="page"':''}>${s.label}</a>`).join('')}<button class="site-search-button" data-site-search aria-label="Find a page">/ search</button></nav><div class="site-section" data-site-shell><a href="${isHome?'/map/':selected.path}">${isHome?'one man · many doors':'corvus / '+selected.label.toLowerCase()}</a><button class="site-search-button" data-site-search aria-label="Find a page">/ find a page</button></div>`,next:`<footer class="site-next site-quiet-footer" data-site-shell><a href="/" aria-label="Corvus home"><img src="/logo.png" width="28" height="28" alt="Corvus"></a><a href="/map/">map</a><a href="#lang-switcher">language</a><a href="/privacy/">privacy</a></footer>`};}
export const card=r=>`<a class="site-card" href="${escape(r.path)}"><small>${escape(r.status)}</small><strong>${escape(r.title)}</strong><p>${escape(r.description)}</p><span class="arrow" aria-hidden="true">→</span></a>`;
function directory(section){return `<div class="site-directory" data-directory-section="${section}">${ROUTES.filter(r=>r.section===section).map(r=>`<a href="${escape(r.path)}"><span>${escape(r.title)}</span><small>${escape(r.status)}</small></a>`).join('')}</div>`;}
export const newsletter=()=>`<section id="signup" class="site-newsletter"><h2>Leave your email. The crow writes when you forget us.</h2><form class="site-form" data-newsletter><div class="inline"><input name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@somewhere.com" aria-label="Email address" required><button type="submit" class="site-button">Send a signal →</button></div><label class="check"><input name="consent" type="checkbox" required><span>Occasional Corvus transmissions. Confirm by email; leave whenever you want. <a href="/privacy/">Privacy</a>.</span></label><label class="site-honey" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label><p role="status" class="site-status"></p></form></section>`;
export function page(title,description,content,{scripts='',robots=false}={}){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="referrer" content="no-referrer"><title>${escape(title)} | corvus</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="https://corvus.gent/og.png"><meta name="twitter:card" content="summary_large_image">${robots?'<meta name="robots" content="noindex,nofollow">':''}<link rel="icon" href="/logo.png"><link rel="stylesheet" href="/styles.css?v=c5cabf3f1a64"><link rel="stylesheet" href="/privacy/privacy.css?v=158032e36fdb"></head><body><main class="site-page">${content}</main>${scripts}${robots?'':'<script defer src="/js/analytics.js?v=20261109ia1"></script><script type="module" src="/js/privacy.js?v=20261107live2"></script>'}</body></html>`;}
export async function write(file,html){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,html);}
function gabeSections(choices){
 const groups=[
  ['Meet in person',false,['/gabinho-rolls','/sf','/dinner']],
  ['Work & people',true,['/people','/cv','/wiki']],
  ['Connect & support',true,['/call','/links/gabe','/support','/support/companies']]
 ];
 const links=rows=>`<ul class="gabe-links">${rows.map(r=>`<li><a href="${escape(r.path)}">${escape(r.title)}</a>${r.description?`<p>${escape(r.description)}</p>`:''}</li>`).join('')}</ul>`;
 const sections=groups.map(([title,folded,paths])=>{
  const rows=paths.map(p=>choices.find(r=>local(r.path)===p)).filter(Boolean);
  return folded?`<details class="gabe-group"><summary>${escape(title)}</summary>${links(rows)}</details>`:`<section class="gabe-group" aria-labelledby="gabe-meet"><h2 id="gabe-meet">${escape(title)}</h2>${links(rows)}</section>`;
 }).join('');
 const references=[
  {path:'/people/?id=gabe',title:'the full story'},
  {path:'/links/gabe',title:'all my links'},
  {path:'/cv',title:'CV'},
  {path:'/realm/',title:'wander the old realm'},
  {path:'/sf/larp/',title:'SF LARPing'}
 ];
 return sections+`<details class="gabe-group"><summary>Quick references</summary>${links(references)}</details>`;
}
function dailySections(choices){
 const links=paths=>`<ul class="daily-links">${paths.map(p=>choices.find(r=>local(r.path)===p)).filter(Boolean).map(r=>`<li><a href="${escape(r.path)}">${escape(r.title)}</a><p>${escape(r.description)}</p></li>`).join('')}</ul>`;
 const letters=newsletter().replace('class="site-button"','class="site-button secondary"');
 return `<section class="daily-group" aria-labelledby="daily-catch-up"><h2 id="daily-catch-up">Listen &amp; catch up</h2>${links(['/music','/now'])}</section>
<details class="daily-group"><summary>More to play</summary>${links(['/games','/hack/play','/games/hub'])}</details>
<section class="daily-group daily-note" aria-label="Between builds"><figure class="site-daily-photo"><img src="/public/live/gabe-surf.jpg" alt="Gabe with his surfboard beside the ocean" width="360" height="480" loading="lazy"><figcaption>between builds, there is an ocean.</figcaption></figure><p class="site-eyebrow">one line from gabe</p><p>one-man army. many editors. leave something better than you found it.</p><p class="site-fine">Your daily-game streak lives with today’s puzzle.</p></section>
<details class="daily-group"><summary>Letters from the crow</summary>${letters}</details>`;
}
function legionContent(html){
 if(html.includes('class="site-page legion-page"'))return html;
 html=html.replace('<main class="site-page">','<main class="site-page legion-page">');
 if(!html.includes('<strong>praetor</strong>'))html=html.replace(/(<div><strong>legatus<\/strong>[\s\S]*?<\/div>)/,'$1<div><strong>praetor</strong><p>meet Gabe in person, anywhere in the world. Gabe confirms the rank.</p><a href="mailto:gabriel@corvus.gent?subject=Meet%20in%20person">Arrange a meetup →</a></div>');
 for(const [id,title] of [['apply','Apply or claim a conversation'],['wall','Meet the Legion']]){
  html=html.replace(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`),`<details id="${id}" class="legion-group"><summary>${title}</summary>$1</details>`);
 }
 html=html.replace(/(<section class="site-newsletter">[\s\S]*?<\/section>)/,'<details class="legion-group"><summary>Letters from the crow</summary>$1</details>');
 const buildLink='<p><a href="/build/">see the army at work →</a></p>';
 if(html.includes('<h2>Inside the Legion</h2>')){
  html=html.replace(buildLink,'');
  html=html.replace(/<section><h2>Inside the Legion<\/h2>([\s\S]*?)<\/section>/,`<details class="legion-group"><summary>Inside the Legion</summary>$1${buildLink}</details>`);
 }
 html=html.replace(/(<button\b[^>]*\bclass=")site-button(")/g,'$1site-button secondary$2');
 return html.replace(/src="\/js\/site\/legion\.js\?v=[^"]+"/,'src="/js/site/legion.js?v=20261112legion1"');
}
async function build(){
 const photos=JSON.parse(await fs.readFile('sf/larp/photos.json','utf8'));
 await write('sf/larp/index.html',page('SF LARPing','Gabe out in San Francisco.',`<p class="site-eyebrow">gabe / san francisco</p><h1>SF LARPing</h1><div class="site-grid sf-photos">${photos.map(p=>`<figure><img${p.focus==='right'?' class="sf-focus-right"':''} src="/sf/larp/${escape(p.photo)}" alt="${escape(p.alt)}" loading="lazy"><figcaption><strong>${escape(p.place)}</strong><time datetime="${escape(p.date)}">${escape(p.date)}</time><p>${escape(p.line)}</p></figcaption></figure>`).join('')}</div>`));
 await write('legion/hacker-room/index.html',page('The hacker room','Inside the Corvus builds.',`<p class="site-eyebrow">legion / hacker</p><h1>the hacker room.</h1><p>Pick one shipped build. Find the smallest change you would make. Bring the before, the after and the thing that surprised you.</p><p><a href="/build/">Read the build log →</a> · <a href="/hack/3/">Open the robotics field notes →</a></p>`));
 await write('legion/call-room/index.html',page('Before our call','Your corner of the Legion before we talk.',`<p class="site-eyebrow">legion / call</p><h1>before we talk.</h1><p>Bring one thing you want to ship, one thing that hurts, and one link I can open. We’ll pick the next move together.</p><a href="/call/">Arrange a time with Gabe →</a>`));
 await write('index.html',page('corvus.gent','Corvus is a community for driven people, in any field. We build in public and help each other win.',`<h1>one man. an army of builders.</h1><p class="site-lead">corvus is a community for driven people, in any field. we build in public and help each other win.</p><div class="site-grid portal-sections" aria-label="Five doors">${SECTIONS.map(s=>card({path:s.path,status:s.id==='legion'?'join us':'explore',title:s.label,description:s.line})).join('')}</div>${newsletter()}`,{scripts:'<script type="module" src="/js/portal.js?v=20261111ritual"></script>'}));
 ROUTES=(await generate()).routes;
 const picks={quests:['/hack/3','/hack/1','/hack/2','/compound/v2','/compound/impact','/compound','/battle','/build','/hackathons'],daily:['/games','/music','/hack/play','/games/hub','/now'],gabe:['/call','/gabinho-rolls','/sf','/dinner','/people','/links/gabe','/cv/','/support','/support/companies','/wiki']};
 const titles={quests:['quests.','A running record of things built, tried and learned.'],daily:['come back curious.','Play a puzzle. Pick a track. Find something you missed.'],gabe:['hi. i’m gabe.','Belgian builder in SF. BJJ, startups, sidequests.']};
 for(const id of ['quests','daily','gabe']){
  const [title,description]=titles[id];const choices=picks[id].map(p=>ROUTES.find(r=>local(r.path)===local(p))).filter(Boolean);
  if(id==='gabe'){
   const content=`<p class="site-eyebrow">corvus / gabe</p><h1>${title}</h1><p class="site-lead">${description}</p><a class="site-button" href="/call/">Book a call →</a>${gabeSections(choices)}`;
   const html=page(title,description,content).replace('<main class="site-page">','<main class="site-page gabe-page">');
   await write('gabe/index.html',html);
   continue;
  }
  if(id==='daily'){
   const content=`<p class="site-eyebrow">corvus / daily</p><h1>${title}</h1><p class="site-lead">${description}</p><a class="site-button" href="/games/">Play today →</a>${dailySections(choices)}`;
   const html=page(title,description,content,{scripts:'<script type="module" src="/js/site/daily.js?v=20261112daily1"></script>'}).replace('<main class="site-page">','<main class="site-page daily-page">');
   await write('daily/index.html',html);
   continue;
  }
  const lead=id==='gabe'?'<a class="site-button" href="/call/">Book a call →</a>':id==='daily'?'<a class="site-button" href="/games/">Play today →</a>':'<a class="site-button" href="/hack/3/">Meet the robots →</a>';
  const aside=id==='daily'?'<figure class="site-daily-photo"><img src="/public/live/gabe-surf.jpg" alt="Gabe with his surfboard beside the ocean" width="360" height="480" loading="lazy"><figcaption>between builds, there is an ocean.</figcaption></figure><section><p class="site-eyebrow">one line from gabe</p><p>one-man army. many editors. leave something better than you found it.</p><p class="site-fine">Your daily-game streak lives with today’s puzzle.</p></section>'+newsletter():id==='gabe'?'<p class="site-fine"><a href="/people/?id=gabe">the full story</a> · <a href="/links/gabe">all my links</a> · <a href="/cv">CV</a> · <a href="/realm/">wander the old realm</a> · <a href="/sf/larp/">SF LARPing</a></p>':'';
  await write(id+'/index.html',page(title,description,`<p class="site-eyebrow">corvus / ${id}</p><h1>${title}</h1><p class="site-lead">${description}</p>${lead}<div class="site-grid">${choices.map(card).join('')}</div>${aside}`));
 }
 await write('map/index.html',page('the whole map.','Every public corner of Corvus, grouped by where you want to go.',`<p class="site-eyebrow">no dead ends</p><h1>the whole map.</h1><p class="site-lead">Every door, in one place. Pick a section, find a name, or press /.</p><label class="directory-search">find your next rabbit hole<input type="search" data-directory-filter placeholder="a game, a cut, a person…" aria-label="Filter the public map"></label><p class="site-fine" data-directory-count>${ROUTES.length} public doors</p><div data-full-directory>${SECTIONS.map(s=>`<section id="${s.id}"><h2>${s.label}</h2>${directory(s.id)}</section>`).join('<hr class="site-divider">')}</div>`));
 const files=[];async function walk(dir='.'){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name.startsWith('.')||['node_modules','public','submission','tests','tools','test-results','playwright-report'].includes(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(e.name.endsWith('.html'))files.push(f);}}await walk();
 for(const file of files){if(file==='worldcraft/qr/index.html'||file==='curiosity/index.html'||file==='live/overlay/index.html'||file.startsWith('clients/'))continue;
  let s=await fs.readFile(file,'utf8');if(/http-equiv=["']refresh/i.test(s))continue;
  s=s.replace(/<!-- SITE_(HEAD|NAV|NEXT|GEMS|DIRECTORY|CRUMB) -->[\s\S]*?<!-- \/SITE_\1 -->/g,'');
  if(file==='legion/index.html')s=legionContent(s);
  if(file==='admin/index.html'&&!s.includes('<option value="praetor">'))s=s.replace('<option value="legatus">legatus</option>','<option value="legatus">legatus</option><option value="praetor">praetor</option>');
  const partner=file.startsWith('compound/')?2:file.startsWith('friends/cardneto/')?3:file.startsWith('plethora/')?4:(file.startsWith('links/pidgy/')||file.startsWith('wiki/pidgy/'))?1:0;
  if(partner)s=s.replace(/<body([^>]*)>/,(_,attrs)=>`<body${attrs}><!-- SITE_CRUMB --><p class="site-company-crumb"><a href="/support/companies/">supported company #${partner}</a></p><!-- /SITE_CRUMB -->`);
  const sectionHub=SECTIONS.find(x=>x.path.replace(/^\//,'')+'index.html'===file);
  if(sectionHub?.id==='gabe')s=s.replace('</main>',`<!-- SITE_DIRECTORY --><details class="gabe-group gabe-catalogue"><summary>All Gabe pages</summary><p class="site-fine">Every public page in this corner. <a href="/map/">See the whole map →</a></p>${directory('gabe')}</details><!-- /SITE_DIRECTORY --></main>`);
  else if(sectionHub?.id==='legion')s=s.replace('</main>',`<!-- SITE_DIRECTORY --><details class="legion-group"><summary>All Legion pages</summary><p class="site-fine">Every public page in this corner. <a href="/map/">See the whole map →</a></p>${directory('legion')}</details><!-- /SITE_DIRECTORY --></main>`);
  else if(sectionHub?.id==='daily')s=s.replace('</main>',`<!-- SITE_DIRECTORY --><details class="daily-group"><summary>All Daily pages</summary><p class="site-fine">Every public page in this corner. <a href="/map/">See the whole map →</a></p>${directory('daily')}</details><!-- /SITE_DIRECTORY --></main>`);
  else if(sectionHub)s=s.replace('</main>',`<!-- SITE_DIRECTORY --><section class="site-hub-directory"><h2>more ${sectionHub.label.toLowerCase()}, fewer dead ends.</h2><p class="site-fine">Every public page in this corner. <a href="/map/">See the whole map →</a></p><details><summary>browse all ${ROUTES.filter(r=>r.section===sectionHub.id).length} doors →</summary>${directory(sectionHub.id)}</details></section><!-- /SITE_DIRECTORY --></main>`);
  const chrome=shell(file);
  if(file==='legion/index.html')chrome.head+='<link rel="stylesheet" href="/css/site/legion.css?v=20261112legion1">';
  if(file==='daily/index.html')chrome.head+='<link rel="stylesheet" href="/css/site/daily.css?v=20261112daily1">';
  s=s.replace('</head>',`<!-- SITE_HEAD -->${chrome.head}<!-- /SITE_HEAD --></head>`);
  if(file==='gabe/index.html')s=s.replace('</head>','<link rel="stylesheet" href="/css/site/gabe.css?v=20261112gabe1"></head>');
  s=s.replace(/<body([^>]*)>/,(_,attrs)=>{let a=attrs;if(/class=/.test(a))a=a.replace(/class="([^"]*)"/,(_,c)=>`class="${[...new Set((c+' site-shell'+(file==='hack/play/index.html'?' site-shell-game':'')).split(/\s+/))].join(' ')}"`);else a+=' class="site-shell'+(file==='hack/play/index.html'?' site-shell-game':'')+'"';return '<body'+a+'><!-- SITE_NAV -->'+chrome.nav+'<!-- /SITE_NAV -->';});
  const footer=`<!-- SITE_NEXT -->${chrome.next}<!-- /SITE_NEXT -->`;
  if(file==='hack/play/index.html')s=s.replace('<div id="faceoff"></div>', '<div id="faceoff"></div>'+footer);
  else s=s.replace('</body>',footer+'</body>');
  await fs.writeFile(file,s);
 }
 console.log(`Site navigation: ${files.length} pages; ${ROUTES.length} directory entries.`);
}
if(process.argv[1]?.endsWith('/site/build.mjs')||process.argv[1]==='tools/site/build.mjs')await build();
