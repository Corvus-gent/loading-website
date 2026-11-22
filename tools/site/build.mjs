import fs from 'node:fs/promises';import path from 'node:path';
import {SECTIONS,ROUTES as EXISTING_ROUTES} from '../../js/site/routes.js';
import {hasStandaloneChrome} from './chrome-policy.mjs';
import {generate} from './generate-directory.mjs';
let ROUTES=EXISTING_ROUTES;
export const VERSION='20261122less1';
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const local=p=>p.replace(/^https:\/\/corvus.gent/,'').replace(/\/$/,'')||'/';
export function sectionFor(file){return ROUTES.find(r=>r.file===file)?.section||(/^hack\/|^compound\/|^battle\/|^build\//.test(file)?'quests':/^games\/|^music\/|^plethora\//.test(file)?'daily':/^army\/|^legion\/|^soldier\//.test(file)?'legion':/^live\//.test(file)?'live':'gabe');}
export const ARENA=['index.html','legion/index.html','quests/index.html','daily/index.html','gabe/index.html','map/index.html'];
const ARENA_VERSION='20261122uptime1';
export function shell(file){const section=sectionFor(file),selected=SECTIONS.find(s=>s.id===section)||SECTIONS.find(s=>s.id==='gabe'),isHome=file==='index.html',isArena=ARENA.includes(file),isRoom=SECTIONS.some(s=>s.nav!==false&&s.path.replace(/^\//,'')+'index.html'===file)||file==='map/index.html';
 const rooms=SECTIONS.filter(s=>s.nav!==false);
 const back=isHome?'':isRoom?'<a href="/">← corvus</a>':`<a href="${selected.nav===false?'/daily/':selected.path}">← ${selected.nav===false?'daily':selected.label.toLowerCase()}</a>`;
 return {head:`${!isHome?'<script type="module" src="/js/live-banner.js?v=20261108live1"></script><link rel="stylesheet" href="/plethora/promo.css?v=20261108live1">':''}${file.startsWith('plethora/')?'<script type="module" src="/js/plethora.js?v=20261108live1"></script>':''}<link rel="stylesheet" href="/css/site/shell.css?v=${VERSION}">${isArena?`<link rel="preload" href="/public/fonts/bodoni-moda/bodoni-moda-700-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/css/site/arena.css?v=${ARENA_VERSION}"><script type="module" src="/js/site/arena.js?v=${ARENA_VERSION}"></script>`:''}<script type="module" src="/js/site/shell.js?v=${VERSION}"></script><script type="module" src="/js/site/circus.js?v=${ARENA_VERSION}"></script><script type="module" src="/js/site/magic.js?v=${ARENA_VERSION}"></script>`,
 nav:`<nav class="site-nav" aria-label="Corvus rooms" data-site-shell><a class="site-mark" href="/" aria-label="Corvus home"${isHome?' aria-current="page"':''}>corvus</a><span class="site-nav-rooms">${rooms.map(s=>`<a href="${s.path}"${!isHome&&s.id===section&&isRoom?' aria-current="page"':''}>${s.label}</a>`).join('')}</span><button class="site-search-button" data-site-search aria-label="Find a page">/ search</button></nav>${back?`<p class="site-back" data-site-shell>${back}</p>`:''}`,
 next:`<footer class="site-next site-quiet-footer" data-site-shell><a href="/" aria-label="Corvus home"><img src="/public/wing/wing-still.png" width="32" height="32" alt="Corvus" style="image-rendering:pixelated"></a><a href="/map/">map</a><a href="/feedback/">feedback</a><a href="#lang-switcher">language</a><a href="/privacy/">privacy</a></footer>`};}
export const card=r=>`<a class="site-card" href="${escape(r.path)}"><small>${escape(r.status)}</small><strong>${escape(r.title)}</strong><p>${escape(r.description)}</p><span class="arrow" aria-hidden="true">→</span></a>`;
function directory(section){return `<div class="site-directory" data-directory-section="${section}">${ROUTES.filter(r=>r.section===section).map(r=>`<a href="${escape(r.path)}"><span>${escape(r.title)}</span><small>${escape(r.status)}</small></a>`).join('')}</div>`;}
export const newsletter=()=>`<section id="signup" class="site-newsletter"><h2>Leave your email. The crow writes when you forget us.</h2><form class="site-form" data-newsletter><div class="inline"><input name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@somewhere.com" aria-label="Email address" required><button type="submit" class="site-button">Send a signal →</button></div><label class="check"><input name="consent" type="checkbox" required><span>Occasional Corvus transmissions. Confirm by email; leave whenever you want. <a href="/privacy/">Privacy</a>.</span></label><label class="site-honey" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label><p role="status" class="site-status"></p></form></section>`;
function homeStats(){return `<section class="arena-stats" aria-labelledby="arena-stats-title"><div><p class="arena-kicker">the realm / in numbers</p><h2 id="arena-stats-title">Small army.<br>Real signals.</h2><p data-home-stats-note>Explore the people, places and builds behind Corvus.</p></div><div class="arena-stats-numbers"><a href="https://stats.corvus.gent/"><strong data-home-visitors>—</strong><span>visitors · measured day</span></a><a href="https://stats.corvus.gent/army"><strong data-home-soldiers>—</strong><span>opted-in soldiers · all time</span></a></div><div class="arena-stats-links"><a href="https://stats.corvus.gent/">Explore all stats</a><a href="https://stats.corvus.gent/map">Visitor map</a><a href="https://stats.corvus.gent/uptime">Uptime</a></div></section><script type="module" src="/js/site/home-stats.js?v=20261122uptime1"></script>`;}
export function page(title,description,content,{scripts='',robots=false,bodyClass=''}={}){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="referrer" content="no-referrer"><title>${escape(title)} | corvus</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="https://corvus.gent${bodyClass==='arena-page'?'/og-realm.png':'/og.png'}"><meta name="twitter:card" content="summary_large_image">${robots?'<meta name="robots" content="noindex,nofollow">':''}<link rel="icon" href="/logo.png"><link rel="stylesheet" href="/styles.css?v=c5cabf3f1a64"><link rel="stylesheet" href="/privacy/privacy.css?v=158032e36fdb"></head><body${bodyClass?` class="${escape(bodyClass)}"`:``}><main class="site-page">${content}</main>${scripts}${robots?'':'<script defer src="/js/analytics.js?v=20261109ia1"></script><script type="module" src="/js/privacy.js?v=20261107live2"></script>'}</body></html>`;}
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
  {path:'/whoami',title:'whoami · the full story'},
  {path:'/tattoo/',title:'tattoo · my inspiration book'},
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
 return `<section class="daily-group" aria-labelledby="daily-catch-up"><h2 id="daily-catch-up">Listen &amp; catch up</h2>${links(['/music','/languages'])}</section>
<section class="daily-group"><h2>A new sketch each day</h2><p>Angels, fire and a philosopher with a lantern. Make a creative brief from Gabe’s inspiration book.</p><p><a href="/tattoo/#daily-brief">Open today’s art prompt</a></p></section>
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
const CONTACT=[['email','mailto:gabriel@corvus.gent'],['book a call','/call/'],['X','https://x.com/gabe_maxxing'],['LinkedIn','https://www.linkedin.com/in/francisco-gabriel-van-langenhove/'],['Instagram','https://www.instagram.com/gabe.maxxing/'],['GitHub','https://github.com/gabe-maxxing']];
const contactList=id=>`<ul class="arena-contact" id="${id}">${CONTACT.map(([label,href])=>`<li><a href="${href}"${href.startsWith('http')?' target="_blank" rel="noopener noreferrer"':''}>${label}${href.startsWith('http')?' ↗':''}</a></li>`).join('')}</ul>`;
function stage(){
 return `<div class="arena-stage"><span class="stage-ring" aria-hidden="true"></span><span class="stage-floor" aria-hidden="true"></span><button type="button" class="stage-wing" data-wing aria-label="Ask Wing something"><picture><source srcset="/public/wing/wing-still.png" media="(prefers-reduced-motion: reduce)"><img src="/public/wing/wing-flight.webp" alt="" width="432" height="432"></picture></button><p class="wing-bubble" data-wing-bubble aria-live="polite"></p></div>`;
}
// *word* glows plum, _word_ is underlined in gold.
const CRAWL=[
 'It is a time of noise. Feeds are full, rooms are empty, and builders everywhere ship _alone_ in the dark.',
 'From an old circus in Ghent, a lone builder named Gabe has raised a banner. Its name is *CORVUS*.',
 'Its laws are few. _Build in public._ _Help each other win._ Have no enemies, *only love*.',
 'Anyone may enter the *Legion*. Every rank above it must be _earned_, never bought.',
 'The army is small. The standard is high. The doors are open, *for now*.'
];
const crawlLine=t=>escape(t).replace(/\*([^*]+)\*/g,'<em class="hl">$1</em>').replace(/_([^_]+)_/g,'<u class="ul">$1</u>');
const CRAWL_ART=[
 ['anakin.webp','Anakin Skywalker costume'],['michael.webp','Archangel Michael'],['fallen.webp','The Fallen Angel'],
 ['diogenes.webp','Diogenes'],['ember-monkey.webp','The ember monkey'],['creation-of-adam-hands.jpg','The Creation of Adam']
];
function crawl(acts,rooms){
 return `<dialog class="crawl" id="crawl" aria-labelledby="crawl-title"><div class="crawl-sky" aria-hidden="true"><div class="crawl-stars"></div><div class="crawl-nebula"></div><div class="crawl-planet"></div></div><div class="crawl-art" aria-hidden="true">${CRAWL_ART.map(([f])=>`<img src="/public/inspiration/${f}" alt="" loading="lazy">`).join('')}</div><p class="crawl-intro">Not so long ago, in a city called Ghent…</p><p class="crawl-logo" aria-hidden="true">CORVUS</p><div class="crawl-view"><div class="crawl-text"><p class="crawl-episode">Episode I</p><h2 id="crawl-title">The Realm</h2>${CRAWL.map(t=>`<p>${crawlLine(t)}</p>`).join('')}<p class="crawl-last">Never stop <span data-crawl-word>wondering</span>…</p></div></div><img class="crawl-wing" src="/public/wing/wing-flight.webp" alt="" aria-hidden="true" width="432" height="432"><div class="crawl-end"><img class="end-wing" src="/public/wing/wing-flight.webp" alt="" width="432" height="432"><p class="end-kicker">the army is forming</p><h3 class="end-title">Your seat<br>is still empty.</h3><p class="end-sub">Quality seekers only.</p><div class="end-wait"><form class="end-wait-form site-form" id="crawl-wait" data-newsletter><label class="sr-only" for="crawl-wait-email">Your email</label><div class="end-wait-row"><input id="crawl-wait-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="your email" required><button type="submit" class="end-cta"><span class="end-cta-mark" aria-hidden="true">✦</span><span>join the waitlist</span></button></div><input class="sr-only" name="consent" type="checkbox" checked tabindex="-1" aria-hidden="true"><p class="end-wait-note">One letter, when the doors open. <a href="/privacy/">privacy</a></p><label class="site-honey" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label><p role="status" class="site-status"></p></form></div></div><details class="crawl-credits"><summary aria-label="Image credits">ⓘ</summary><p>Anakin costume photo: Doug Kline, CC BY 2.0. Reni, Cabanel, Gérôme and Michelangelo: public domain.</p></details><form method="dialog" class="crawl-close"><button type="submit">skip · esc</button></form></dialog>`;
}
function homeContent(){
 const roman=['I','II','III','IV'];
 const rooms=SECTIONS.filter(s=>s.nav!==false);
 const acts=rooms.map((s,i)=>`<li data-reveal="act"><a href="${s.path}"><span class="num">${roman[i]}</span><strong>${escape(s.label)}</strong><span class="line">${escape(s.line)}</span><span class="go">${escape(s.cta)} →</span></a></li>`).join('');
 const endActs=rooms.map((s,i)=>`<li><a href="${s.path}"><span>${roman[i]}</span> ${escape(s.label)}</a></li>`).join('');
 return `<div class="arena-home"><div class="hall" data-hall data-panels="10" aria-hidden="true"><div class="hall-dome"></div><div class="hall-tilt"><div class="hall-cylinder"></div></div></div><p class="sr-only" data-hall-today>The ring in the hall says: never stop wondering.</p><section class="arena-hero" aria-labelledby="arena-title"><span class="arena-pennant" aria-hidden="true"></span>${stage()}<div class="arena-copy"><p class="arena-kicker" translate="no" data-reveal="1">the realm · gent</p><p class="arena-wordmark" translate="no" data-reveal="2">CORVUS</p><h1 class="arena-title" id="arena-title" data-reveal="3">one man. an army of quality seekers.</h1><p class="arena-ask" data-reveal="4"><button type="button" class="crawl-open" data-crawl-open aria-haspopup="dialog">what is corvus?</button></p><p class="sr-only" data-ring-live aria-live="polite"></p><div class="ring-after" data-ring-after hidden><div class="end-wait"><form class="end-wait-form site-form" id="ring-wait" data-newsletter><label class="sr-only" for="ring-wait-email">Your email</label><div class="end-wait-row"><input id="ring-wait-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="your email" required><button type="submit" class="end-cta"><span class="end-cta-mark" aria-hidden="true">✦</span><span>join the waitlist</span></button></div><input class="sr-only" name="consent" type="checkbox" checked tabindex="-1" aria-hidden="true"><p class="end-wait-note">One letter, when the doors open. <a href="/privacy/">privacy</a></p><label class="site-honey" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label><p role="status" class="site-status"></p></form></div><ol class="crawl-acts">${endActs}</ol></div></div></section>${homeStats()}<section class="arena-programme" aria-labelledby="programme-title" data-reveal="scroll"><header><h2 id="programme-title">Tonight’s programme</h2><p>Four acts. Your guide is <a class="arena-link" href="/gabe/">Gabe</a>; Wing carries the lantern.</p></header><ol class="arena-acts">${acts}</ol><p class="arena-map">Every other door is on <a class="arena-link" href="/map/">the map</a>, or press <kbd>/</kbd> to search.</p></section><figure class="arena-poster" data-reveal="scroll"><div class="art" role="img" aria-label="Georges Seurat’s Le Cirque: a rider on a white horse, a clown and an audience in the stands."></div><div><blockquote>No enemies. Only love.</blockquote><figcaption>Why Corvus exists. On the wall: Georges Seurat, Le Cirque, 1891 · public domain.</figcaption></div></figure>${newsletter()}${crawl(endActs,rooms)}</div>`;
}
async function gabeContent(){
 const whoami=await fs.readFile('whoami/index.html','utf8');
 const m=whoami.match(/<main class="site-page profile-wrap">([\s\S]*?)<\/main>/);
 const story=(m?m[1]:'').replace('<p class="eyebrow">corvus / whoami</p>','<p class="site-eyebrow">corvus / gabe</p>');
 const group=(id,title,rows)=>`<section class="gabe-group" id="${id}"><h2>${title}</h2><ul class="gabe-links">${rows.map(([path,label,line])=>`<li><a href="${path}">${escape(label)}</a>${line?`<p>${escape(line)}</p>`:''}</li>`).join('')}</ul></section>`;
 return story+`<div class="gabe-around">`+group('meet','Meet Gabe',[['/call/','book a call','Five minutes free. Bring one good question.'],['/gabinho-rolls/','roll or surf','Mat time, salt water, new people.'],['/sf/','meet in San Francisco','Founders, fighters, artists.'],['/dinner/','dinner in SF','You pick the place. I bring the stories.']])
 +group('vouch','People &amp; companies I vouch for',[['/support/companies/','companies','Ranked: Pidgy, Compound, Cardneto, Plethora.'],['/support/people/','people','The humans who shaped me.'],['/support/founders/','founders','Builders I’d follow into anything.'],['/hackathons/','hack squads','Who I built with at hackathons.'],['/support/books/','books','Pages that changed how I think.'],['/support/philosophists/','philosophists','Old minds, still loud.']])
 +group('elsewhere','Everywhere else',[['/cv/','CV','Work, builds, education.'],['/links/gabe','all my links','Every place to find Gabe.'],['/tattoo/','tattoo · my inspiration book','Angels, fire, a philosopher with a lantern.'],['/sf/larp/','SF LARPing','Out in San Francisco.'],['/wiki/','the field notes','People, ideas and stories that shaped this place.'],['/realm/','the old realm','A little mystery is allowed.']])+`</div>`;
}
async function build(){
 const curiosityHero=await fs.readFile('public/worldcraft/hero.html','utf8');
 const photos=JSON.parse(await fs.readFile('sf/larp/photos.json','utf8'));
 await write('sf/larp/index.html',page('SF LARPing','Gabe out in San Francisco.',`<p class="site-eyebrow">gabe / san francisco</p><h1>SF LARPing</h1><div class="site-grid sf-photos">${photos.map(p=>`<figure><img${p.focus==='right'?' class="sf-focus-right"':''} src="/sf/larp/${escape(p.photo)}" alt="${escape(p.alt)}" loading="lazy"><figcaption><strong>${escape(p.place)}</strong><time datetime="${escape(p.date)}">${escape(p.date)}</time><p>${escape(p.line)}</p></figcaption></figure>`).join('')}</div>`));
 await write('legion/hacker-room/index.html',page('The hacker room','Inside the Corvus builds.',`<p class="site-eyebrow">legion / hacker</p><h1>the hacker room.</h1><p>Pick one shipped build. Find the smallest change you would make. Bring the before, the after and the thing that surprised you.</p><p><a href="/build/">Read the build log →</a> · <a href="/hack/3/">Open the robotics field notes →</a></p>`));
 await write('legion/call-room/index.html',page('Before our call','Your corner of the Legion before we talk.',`<p class="site-eyebrow">legion / call</p><h1>before we talk.</h1><p>Bring one thing you want to ship, one thing that hurts, and one link I can open. We’ll pick the next move together.</p><a href="/call/">Arrange a time with Gabe →</a>`));
 await write('index.html',page('corvus.gent','Corvus is a community for driven people in any field. We build in public and help each other win.',homeContent(),{bodyClass:'arena-page'}));
 ROUTES=(await generate()).routes;
 const picks={quests:['/hack/3','/hack/1','/hack/2','/compound/v2','/compound/impact','/compound','/battle','/build','/hackathons'],daily:['/games','/music','/hack/play','/games/hub','/now'],gabe:['/call','/gabinho-rolls','/sf','/dinner','/people','/links/gabe','/cv/','/support','/support/companies','/wiki']};
 const titles={quests:['quests.','A running record of things built, tried and learned.'],daily:['come back curious.','Play a puzzle. Pick a track. Find something you missed.'],gabe:['hi. i’m gabe.','Belgian builder in SF. BJJ, startups, sidequests.']};
 for(const id of ['quests','daily','gabe']){
  const [title,description]=titles[id];const choices=picks[id].map(p=>ROUTES.find(r=>local(r.path)===local(p))).filter(Boolean);
  if(id==='quests'){
   const content=`<p class="site-eyebrow">corvus / quests</p><h1>${title}</h1><p class="site-lead">${description}</p>`+curiosityHero+`<h2 id="run" data-wc="qRun">SF / THE HACKATHON RUN</h2><div class="site-grid quest-hack-run"><a class="site-card quest-newest" href="/hack/4" data-lang-link><strong data-wc="qNewest">004 / NEWEST: Curiosity Craft</strong><p data-wc="qSubShort">Kids level up by asking why. Fail freely.</p><span class="arrow">→</span></a><a class="site-card" href="/hack/3"><strong data-wc="qRobotics">003 / Robotics</strong><p data-wc="qRoboticsDesc">Robots, interviews and a 24-hour content streak.</p></a><a class="site-card" href="/hack/2"><small>002 / OSSMAN</small><strong data-wc="qOssman">THE CAGE HAS A NAME. OSSMAN.</strong><p data-wc="qArchived">Name reveal, votes, leaderboard and feedback · open the card</p></a><a class="site-card" href="/hack/1"><small>001 / HACKTHEFEED</small><strong>Oriane × Compound</strong><p>Built in 3h. Pitched anyway. →</p></a></div><p><a href="/hack/3/">Meet the robots →</a> · <a href="/hack/">The hackathon archive →</a></p><div class="site-grid">${choices.filter(r=>!['/hack/1','/hack/2','/hack/3'].includes(local(r.path))).map(card).join('')}</div>`;
   const html=page(title,description,content,{scripts:'<script type="module" src="/public/worldcraft/hero.js"></script>'}).replace('<body>','<body class="curiosity-priority">').replace('</head>','<link rel="stylesheet" href="/public/worldcraft/hero.css"><link rel="stylesheet" href="/public/worldcraft/scoreboard.css"></head>');
   await write('quests/index.html',html);continue;
  }
  if(id==='gabe'){
   const html=page(title,description,await gabeContent(),{bodyClass:'profile-page whoami-page'}).replace('<main class="site-page">','<main class="site-page profile-wrap gabe-page">').replace('</head>','<link rel="stylesheet" href="/css/profile.css?v=20261118photos"></head>');
   await write('gabe/index.html',html);
   continue;
  }
  if(id==='daily'){
   const live=`<section class="daily-group" id="live" aria-labelledby="daily-live"><h2 id="daily-live">Live &amp; now</h2><p>Gabe streams builds, hackathons and interviews. When nothing is live, the latest cuts and the weekly focus are here.</p><ul class="daily-links"><li><a href="/live/">the live room</a><p>Streams, the latest cuts and how to join the edit.</p></li><li><a href="/now/">right now</a><p>What Gabe is focused on this week.</p></li><li><a href="https://stats.corvus.gent">public stats</a><p>Traffic and service health, in the open.</p></li></ul></section>`;
   const content=`<p class="site-eyebrow">corvus / daily</p><h1>${title}</h1><p class="site-lead">${description}</p><a class="site-button" href="/games/">Play today →</a>${live}${dailySections(choices)}`;
   const html=page(title,description,content,{scripts:'<script type="module" src="/js/site/daily.js?v=20261112daily1"></script>'}).replace('<main class="site-page">','<main class="site-page daily-page">');
   await write('daily/index.html',html);
   continue;
  }
  const lead=id==='gabe'?'<a class="site-button" href="/call/">Book a call →</a>':id==='daily'?'<a class="site-button" href="/games/">Play today →</a>':'<a class="site-button" href="/hack/3/">Meet the robots →</a>';
  const aside=id==='daily'?'<figure class="site-daily-photo"><img src="/public/live/gabe-surf.jpg" alt="Gabe with his surfboard beside the ocean" width="360" height="480" loading="lazy"><figcaption>between builds, there is an ocean.</figcaption></figure><section><p class="site-eyebrow">one line from gabe</p><p>one-man army. many editors. leave something better than you found it.</p><p class="site-fine">Your daily-game streak lives with today’s puzzle.</p></section>'+newsletter():id==='gabe'?'<p class="site-fine"><a href="/whoami">the full story</a> · <a href="/links/gabe">all my links</a> · <a href="/cv">CV</a> · <a href="/realm/">wander the old realm</a> · <a href="/sf/larp/">SF LARPing</a></p>':'';
  await write(id+'/index.html',page(title,description,`<p class="site-eyebrow">corvus / ${id}</p><h1>${title}</h1><p class="site-lead">${description}</p>${lead}<div class="site-grid">${choices.map(card).join('')}</div>${aside}`));
 }
 await write('map/index.html',page('the whole map.','Every public corner of Corvus, grouped by where you want to go.',`<p class="site-eyebrow">no dead ends</p><h1>the whole map.</h1><p class="site-lead">Every door, in one place. Pick a section, find a name, or press /.</p><label class="directory-search">find your next rabbit hole<input type="search" data-directory-filter placeholder="a game, a cut, a person…" aria-label="Filter the public map"></label><p class="site-fine" data-directory-count>${ROUTES.length} public doors</p><div data-full-directory>${SECTIONS.map(s=>`<section id="${s.id}"><h2>${s.label}</h2>${directory(s.id)}</section>`).join('<hr class="site-divider">')}</div>`));
 const files=[];async function walk(dir='.'){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name.startsWith('.')||['node_modules','public','submission','tests','tools','test-results','playwright-report'].includes(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(e.name.endsWith('.html'))files.push(f);}}await walk();
 for(const file of files){if(hasStandaloneChrome(file))continue;
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
  s=s.replace(/<body([^>]*)>/,(_,attrs)=>{let a=attrs;if(/class=/.test(a))a=a.replace(/class="([^"]*)"/,(_,c)=>`class="${[...new Set((c+' site-shell'+(ARENA.includes(file)?' arena':'')+(file==='hack/play/index.html'?' site-shell-game':'')).split(/\s+/))].join(' ')}"`);else a+=' class="site-shell'+(ARENA.includes(file)?' arena':'')+(file==='hack/play/index.html'?' site-shell-game':'')+'"';return '<body'+a+'><!-- SITE_NAV -->'+chrome.nav+'<!-- /SITE_NAV -->';});
  const footer=`<!-- SITE_NEXT -->${chrome.next}<!-- /SITE_NEXT -->`;
  if(file==='hack/play/index.html')s=s.replace('<div id="faceoff"></div>', '<div id="faceoff"></div>'+footer);
  else s=s.replace('</body>',footer+'</body>');
  s=s.replace(/(\/js\/stats-(?:data|nav)\.js)\?v=[^"\s]+/g,'$1?v=20261122uptime1');
  await fs.writeFile(file,s);
 }
 console.log(`Site navigation: ${files.length} pages; ${ROUTES.length} directory entries.`);
}
if(process.argv[1]?.endsWith('/site/build.mjs')||process.argv[1]==='tools/site/build.mjs')await build();
