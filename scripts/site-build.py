#!/usr/bin/env python3
"""Build shared static navigation, route directory, photos; audit local links.
No bundler: deploy the repository's existing static/Vercel layout unchanged.
"""
from pathlib import Path
from html.parser import HTMLParser
from html import escape, unescape
from urllib.parse import urlsplit, urljoin, unquote
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
import os
os.chdir(ROOT)
EXCLUDED_PREFIXES=('clients/','music/admin/','stats/private/','stats/hunt/','sf/','airbnb/','airbnb-call-me-pls/','402/')
SPECIAL=('go/index.html','gabe/index.html','404.html')
NO_HEADER=('public/arena/game.html','public/arena/nest-b.html','hack/the-feed/index.html')
NAV=[('/','Home'),('/hack/','Hack'),('/legion/','Legion'),('/nest/','Nest'),('/games/','Games'),('/explore/','Explore')]

def all_files():
 result=[]
 for base,dirs,names in os.walk(ROOT):
  dirs[:]=[d for d in dirs if d not in ('.git','node_modules','.venv','test-results','playwright-report','.vercel','__pycache__')]
  result.extend(str((Path(base)/n).relative_to(ROOT)) for n in names)
 return sorted(result)
def route(file):
 r='/'+file.removeprefix('public/')
 return r[:-10] if r.endswith('index.html') else r

def public(file):
 return not file.startswith(EXCLUDED_PREFIXES) and file not in SPECIAL

def title(file):
 m=re.search(r'<title>(.*?)</title>',Path(file).read_text(),re.S|re.I)
 return unescape(re.sub(r'\s+',' ',m.group(1)).split('|')[0].strip()) if m else route(file)

def group(file):
 if file.startswith(('hack/','nest/','public/arena/')):return 'Hackathons & experiments'
 if file.startswith(('people/','legion/','links/','languages/','support/','wiki/')):return 'People & community'
 if file.startswith('stats/'):return 'Public stats'
 return 'Around Corvus'

def nav_markup(current):
 links=''.join(f'<a href="{r}"'+(' aria-current="page"' if current==r else '')+f'>{t}</a>' for r,t in NAV)
 return '<!-- site-nav:start --><nav class="site-nav" aria-label="Main navigation"><a class="site-brand" href="/">corvus ↟</a><div class="site-desktop">'+links+'</div><details class="site-mobile"><summary aria-label="Open navigation menu">☰ Menu</summary><div class="site-menu">'+links+'</div></details></nav><!-- site-nav:end -->'

# Build an explicit directory rather than exposing intentionally hidden pages.
files=[f for f in all_files() if f.endswith('.html') and Path(f).exists() and not f.startswith(('tests/','tools/','node_modules/'))]
if 'explore/index.html' not in files:files.append('explore/index.html')
listed=[f for f in files if public(f) and f!='explore/index.html']
sections=[]
for g in ['Hackathons & experiments','People & community','Around Corvus','Public stats']:
 entries=''.join(f'<li><a href="{route(f)}">{escape(title(f))} <span aria-hidden="true">→</span></a></li>' for f in listed if group(f)==g)
 sections.append(f'<section class="recap-section"><h2>{g}</h2><ul class="archive-list">{entries}</ul></section>')
Path('explore').mkdir(exist_ok=True)
Path('explore/index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Explore Corvus</title><meta name="description" content="Find the hackathons, games, people and public stats on Corvus."><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/hack/hack.css"><link rel="stylesheet" href="/hack/archive.css"></head><body class="hack-page"><main class="hack-main"><section class="recap-section recap-copy"><p class="eyebrow">a map of the public realm</p><h1>Where next?</h1><p>Hackathon experiments, daily games, people and the numbers behind the build. Private tools and invite-only pages stay off this map.</p></section>'''+''.join(sections)+'''</main></body></html>''')

for f in files:
 p=Path(f);s=p.read_text()
 if not public(f) and f!='404.html':continue
 if f not in NO_HEADER:
  s=re.sub(r'<!-- site-nav:start -->.*?<!-- site-nav:end -->\n*','',s,flags=re.S)
  s=re.sub(r'(<body\b[^>]*>)',lambda m:m.group(1)+'\n'+nav_markup(route(f)),s,count=1,flags=re.I)
 if '/js/site-nav.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="/js/site-nav.css">\n</head>')
 # Preserve the game/app's existing back links and full-viewport behavior.
 if f not in NO_HEADER:
  s=re.sub(r'<!-- site-next:start -->.*?<!-- site-next:end -->\n*','',s,flags=re.S)
  footer='<!-- site-next:start --><nav class="site-next" aria-label="Keep exploring"><a href="/legion/">Join the Legion →</a><a href="/hack/">Read a field note →</a><a href="/games/">Play a game →</a><a href="/explore/">All public pages →</a></nav><!-- site-next:end -->'
  s=s.replace('</body>',footer+'\n</body>')
 if f.startswith('stats/'):
  s=re.sub(r'<!-- site-(?:nav|next):start -->.*?<!-- site-(?:nav|next):end -->',lambda m: m.group(0).replace('href="/', 'href="https://corvus.gent/'),s,flags=re.S)
 p.write_text(re.sub(r"[ \t]+\n", "\n", s))

# Photos are optional inputs, never broken image requests or invented photographs.
p=Path('hack/2/index.html');s=p.read_text()
for stem,alt in [('floor','Gabe asleep on the floor after the Meta Muse hackathon'),('slide','The last-minute Muse Ember playground demo'),('setup','The terminal and OpenRouter setup at the hackathon')]:
 image=Path('public/hack/2')/(stem+'.jpg')
 if image.exists():
  body=f'<img src="/{image.as_posix()}" alt="{alt}" loading="lazy" width="960" height="720">'
 else:
  labels={'floor':('The floor photo','Me, finally finding a platform that would support me.'),'slide':('The last-minute slide','The tiny Ember that made it through the deadline.'),'setup':('The terminal setup','More terminal windows than completed features.')}
  label,caption=labels[stem]
  body=f'<div class="photo-placeholder"><strong>{label}</strong><p>Photo still to come.</p></div>'
 s=re.sub(rf'(?s)(<!-- photo:{stem}:start -->).*?(<!-- photo:{stem}:end -->)',lambda m:m[1]+body+m[2],s)
p.write_text(s)

class Links(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.links=[];self.ids=set()
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if d.get('id'):self.ids.add(d['id'])
  if tag=='a' and d.get('href'):self.links.append(d['href'])

def parser(file):
 p=Links();p.feed(Path(file).read_text());return p
parsed={f:parser(f) for f in files}
config=json.loads(Path('vercel.json').read_text())
# Explicit non-file routes served by middleware or existing production flow.
DYNAMIC=('/enter','/the-crow','/revived','/sidequest','/important-call-gabe-maxxer','/coffee-with-gabe')
PRODUCTION_ONLY={'/join-the-army-now','/join-the-army-now/'}
def resolve(path,depth=0):
 path=unquote(path) or '/'
 if depth>4:return None
 relative=path.lstrip('/')
 for candidate in [relative,relative.rstrip('/')+'/index.html',relative+'.html']:
  if Path(candidate).is_file():return candidate
 if path=='/':return 'index.html'
 if path.startswith('/links/') or path.startswith('/go/'):
  return 'links/index.html' if path.startswith('/links/') else 'go/index.html'
 if path in DYNAMIC:return '@middleware'
 for r in config.get('redirects',[])+config.get('rewrites',[]):
  pattern=re.sub(r':\w+[+*]?',r'(.*)',r['source'])
  m=re.fullmatch(pattern,path.rstrip('/'))
  if m:
   dest=r['destination']
   if dest.startswith('https://') or dest.startswith('/api/'):return '@dynamic'
   for value in m.groups():dest=re.sub(r':\w+[+*]?',value,dest,count=1)
   return resolve(dest,depth+1)
 if path.startswith('/api/') and Path('api',path.split('/')[2]+'.js').exists():return '@api'
 return None
errors=[];edges={f:set() for f in files}
for f,p in parsed.items():
 for href in p.links:
  if href.startswith(('mailto:','tel:','javascript:','data:')):continue
  u=urlsplit(urljoin('https://corvus.gent'+route(f),href))
  if u.netloc not in ('corvus.gent','www.corvus.gent'):continue
  if u.path in PRODUCTION_ONLY:continue
  dest=resolve('/stats/'+u.path.lstrip('/') if f.startswith('stats/') and u.path.strip('/') in ('coffee','hunt','map','pidgy','status','x','private') else u.path)
  if not dest:errors.append(f'{f}: {href}')
  elif dest in edges:edges[f].add(dest)
seen=set();todo=['index.html']
while todo:
 f=todo.pop()
 if f in seen:continue
 seen.add(f);todo+=list(edges.get(f,set())-seen)
orphans=[route(f) for f in files if public(f) and f not in seen]
if orphans:errors+=['Orphan public page: '+r for r in orphans]
# Inventory includes intentionally unlisted pages and backend endpoints.
rows=['# Route inventory','', 'Generated by `npm run build`. Public HTML routes are reachable from Home → Explore, plus the direct flows noted below. Private/unlisted pages are deliberately excluded from shared navigation and search.','', '| Route | Purpose | Visitor flow / visibility |','| --- | --- | --- |']
for f in sorted(files,key=route):
 visibility='Home → Explore → '+group(f) if public(f) else 'Unlisted/private or utility; existing direct/authorized flow only'
 if f=='index.html':visibility='Entry point; main navigation'
 elif f.startswith('hack/'):visibility='Home → Hack → numbered field note / existing app'
 elif f=='nest/index.html':visibility='Home → Nest; Hack 002 → last-minute demo'
 elif f=='legion/index.html':visibility='Home → Legion → people / production recruitment gate'
 rows.append(f'| `{route(f)}` | {title(f).replace("|","/")} | {visibility} |')
for r in config.get('redirects',[])+config.get('rewrites',[]):rows.append(f'| `{r["source"]}` | Routes to `{r["destination"]}` | Alias/API routing; not a separate public page |')
for f in all_files():
 if f.startswith('api/') and f.endswith('.js') and not Path(f).name.startswith('_'):rows.append(f'| `/{f[:-3]}` | Server endpoint | Called by its feature; not public navigation |')
rows+=['','## Host and dynamic routes','', '- `stats.corvus.gent/` maps to `/stats/`; its named sections map to the corresponding stats pages. Main-host `/stats/*` redirects to that subdomain.','- `/people/?id=<member>` selects a member; `/links/<persona>` and `/go/<persona>/<platform>/<context>` resolve dynamic profile/outbound links.','- `/join-the-army-now` remains a production-only recruitment flow owned by open PR #18; this preview links explicitly to the production host. No duplicate account system was created.','- `/sf/`, `/stats/private/`, `/stats/hunt/`, `/music/admin/`, client concepts, and noindex Airbnb contact pages remain unlisted. Existing access checks are unchanged.','- Photo sources: `public/hack/2/floor.jpg`, `slide.jpg`, `setup.jpg`; absent photos render placeholders.','',f'## Audit\n\n{len(files)} HTML files; {sum(len(p.links) for p in parsed.values())} anchors checked; {len(orphans)} orphan public pages.']
Path('ROUTES.md').write_text('\n'.join(rows)+'\n')
if errors:
 print('Link audit failed:\n'+'\n'.join(sorted(set(errors))));sys.exit(1)
print(f'Built navigation + route inventory; checked {len(files)} HTML files, all public pages reachable, no broken local href targets.')
