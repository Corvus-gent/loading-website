#!/usr/bin/env python3
"""Consistent, unique public-page sharing metadata; keep private pages unlisted."""
from pathlib import Path
from html import escape,unescape
import re,json,os
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
SKIP=('nest/view/','admin/','legion/join/','clients/','music/admin/','stats/private/','stats/hunt/','sf/','airbnb/','airbnb-call-me-pls/','402/','go/','gabe/')
OVERRIDES={
 '/':('Corvus — build, play, show up','A community of builders, a few ravens, and work shared in public. Explore Gabe’s hackathons, games, experiments and the Legion.'),
 '/nest/v0/':('The original Nest — Muse Ember v0','The preserved Muse-built wish-and-raven demo. Local-only interaction, with no live AI calls.'),
 '/nest/':('The Nest Builds Itself','Make a wish for a tiny website. Explore the Muse Ember-built Nest, its honest hackathon origins, and the next experiments from Corvus.'),
 '/arena/':('Blind Nest — the Muse arena','Explore the Muse-built arena prototype and Raven Rush. One real contender, transparent model provenance, and local preview votes.'),
 '/arena/game.html':('Raven Rush — one tap, one more run','Tap to flap through a neon night, collect coins and dodge the towers. Raven Rush is a playable Meta Muse-built experiment on Corvus.'),
 '/arena/nest-b.html':('A Muse-built vision of Corvus','A clearly labelled AI-generated concept for a builder community. Explore Muse’s design and return to the honest arena preview.'),
 '/explore/':('Explore Corvus — choose your next stop','Find every public corner of Corvus: hackathon field notes, the Nest, I Don’t Pay, games, people, music and community stats.'),
 '/hack/the-feed/':('Try HackTheFeed — the original hackathon app','Launch the HackTheFeed early beta, explore the project, or read the honest field note from the San Francisco hackathon.'),
 '/dontpay/':("I DON’T PAY — a video for a meal",'Gabe trades a useful promo video, made in the shop’s language, for a meal agreed with the owner. Suggest the first spot and follow the real episodes.'),
 '/legion/':('The Legion — find your flock','Join the Corvus community of builders. Show up, share what you know, and leave somebody’s work better than you found it.'),
 '/links/corvus/':('Corvus — links from the flock','The official Corvus links: enter the realm, play today’s game, explore community stats and find the people building it.'),
 '/links/pidgy/':('Pidgy — find the right link','Try Pidgy, the AI inbox agent for Outlook and Gmail. Find its official product, maker and community links.'),
 '/wiki/corvus/':('Corvus — the story of the crow','The crow, the lantern, the Ghent studio and the revived community. Read the story behind Corvus on Corvuspedia.'),
 '/wiki/pidgy/':('Pidgy — the pigeon behind the inbox','Meet Pidgy: the AI inbox agent built by Alkmist in Ghent, and the pigeon that lives beside the Corvus crow.'),
 '/people/':('People of Corvus','Meet the people behind Corvus, discover what they build and find a useful way to connect.'),
 '/support/people/':('People Gabe recommends','Builders, friends and collaborators Gabe would vouch for. Personal recommendations from the Corvus flock.'),
 '/support/':('Support — people and ideas worth your time','Explore Gabe’s personal recommendations: builders, founders, companies, books, thinkers and athletes connected to Corvus.'),
 '/support/books/':('Books on Gabe’s shelf','A growing reading list from Gabe: books worth returning to, with honest notes on what is still a work in progress.'),
 '/support/companies/':('Companies Gabe recommends','A personal list of companies and tools Gabe knows through building, GTM and the Corvus community.'),
 '/support/founders/':('Founders Gabe recommends','Meet founders Gabe has learned from and worked around, from Ghent builders to the wider startup community.'),
 '/support/philosophists/':('Thinkers — a little room for Diogenes','Diogenes, his lantern and the questions behind Corvus. Gabe’s very personal corner for philosophy.'),
 '/support/sport-people/':('Athletes and people from the mats','Brazilian jiu-jitsu practitioners and athletes Gabe follows and learns from, collected in a personal Corvus list.'),
 '/games/':('Daily games — light the next lantern','A new daily puzzle on Corvus: languages, borders, flags, words, music and more. Play, learn, and share your result.'),
}
def read_meta(text,key):
 for tag in re.findall(r'<meta\b[^>]*>',text,re.I):
  if re.search(r'(?:name|property)=["\']'+re.escape(key)+r'["\']',tag,re.I):
   m=re.search(r'content=["\'](.*?)["\']\s*/?>',tag,re.I)
   if m:return unescape(m[1])
 return ''
def meta(text,key,value,attr='name'):
 tag=f'<meta {attr}="{key}" content="{escape(value,quote=True)}">'
 pattern=r'<meta\b(?=[^>]*(?:name|property)=["\']'+re.escape(key)+r'["\'])[^>]*>'
 text=re.sub(pattern,'',text,flags=re.I)
 return text.replace('</head>',tag+'\n</head>',1)
rows=[];pending={}
for base,dirs,names in os.walk('.'):
 dirs[:]=[d for d in dirs if d not in ['.git','node_modules','qa','tests','test-results','playwright-report','.vercel']]
 for name in sorted(names):
  if not name.endswith('.html'):continue
  p=Path(base)/name;file=p.as_posix()
  if file.startswith(SKIP) or file=='404.html':continue
  route='/'+file.removeprefix('public/');route=route[:-10] if route.endswith('index.html') else route
  s=p.read_text();m=re.search(r'<title>(.*?)</title>',s,re.S|re.I)
  title=unescape(m[1]).strip() if m else route
  title=re.sub(r'\s*\|\s*(?:corvus\.gent|corvus stats|Corvuspedia)$','',title,flags=re.I)
  description=read_meta(s,'description')
  if route in OVERRIDES:title,description=OVERRIDES[route]
  if not description:description=f'{title}: a field note, experiment or useful corner of Corvus, the community Gabe is building in public.'
  canonical='https://corvus.gent'+route
  if route.startswith('/stats/'):
   canonical='https://stats.corvus.gent/'+route.removeprefix('/stats/').rstrip('/')
  slug='home' if route=='/' else route.strip('/').replace('/','-').replace('.html','')
  image='/og/pages/'+slug+'.png'
  s=re.sub(r'<title>.*?</title>',lambda _:f'<title>{escape(title)} | corvus.gent</title>',s,count=1,flags=re.S|re.I)
  for key,value,attr in [('description',description,'name'),('og:title',title,'property'),('og:description',description,'property'),('og:type','website','property'),('og:url',canonical,'property'),('og:image','https://corvus.gent'+image,'property'),('og:image:width','1200','property'),('og:image:height','630','property'),('og:image:alt',title+' — Corvus, black and gold raven artwork','property'),('twitter:card','summary_large_image','name'),('twitter:title',title,'name'),('twitter:description',description,'name'),('twitter:image','https://corvus.gent'+image,'name'),('twitter:image:alt',title+' — Corvus','name')]:s=meta(s,key,value,attr)
  s=re.sub(r'<link\b(?=[^>]*rel=["\']canonical["\'])[^>]*>','',s,flags=re.I)
  s=s.replace('</head>',f'<link rel="canonical" href="{canonical}">\n</head>',1)
  s=re.sub(r'\n{3,}','\n\n',s);pending[p]=s
  rows.append({'route':route,'title':title,'description':description,'canonical':canonical,'image':image,'file':file})
rows.sort(key=lambda r:r['route'])
assert len({r['title'] for r in rows})==len(rows),str([(r['route'],r['title']) for r in rows if sum(x['title']==r['title'] for x in rows)>1])
assert len({r['description'] for r in rows})==len(rows),str([(r['route'],r['description']) for r in rows if sum(x['description']==r['description'] for x in rows)>1])
for p,s in pending.items():p.write_text(s)
Path('seo').mkdir(exist_ok=True);Path('seo/manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(f'Sharing metadata: {len(rows)} unique public titles, descriptions and OG images.')
