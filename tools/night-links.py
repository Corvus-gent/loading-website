#!/usr/bin/env python3
"""Read-only local crawl of page links, frames, styles, images and JS imports."""
import gzip,json,re,sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit,unquote
from urllib.request import urlopen,Request
from urllib.error import HTTPError
BASE='http://127.0.0.1:8793'
class Assets(HTMLParser):
 def __init__(self):super().__init__();self.refs=[];self.ids=set()
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if d.get('id'):self.ids.add(d['id'])
  if tag=='meta' and (d.get('property')=='og:image' or d.get('name')=='twitter:image') and d.get('content'):self.refs.append((d['content'],'asset'))
  for attr in ('href','src','poster'):
   if d.get(attr):self.refs.append((d[attr], 'link' if tag=='a' else 'asset'))
  if d.get('srcset'):
   for part in d['srcset'].split(','):self.refs.append((part.strip().split(' ')[0],'asset'))
  if d.get('style'):
   self.refs.extend((x,'asset') for x in re.findall(r'url\([\s\'"]*([^\)\'"\s]+)',d['style']))
inventory=Path('ROUTES.md').read_text()
routes=[]
for route in re.findall(r'^\| `(/[^`]*?)` \|',inventory,re.M):
 if not route.startswith('/api/') and not re.search(r'[:<>?]',route):routes.append(route)
queue=[(BASE+r,'inventory','link') for r in dict.fromkeys(routes)];seen={};errors=[];backend=[];external=[];fragments=[]
config=json.loads(Path('vercel.json').read_text())
def backend_path(p):
 if p.startswith('/api/') or p in ('/cv','/cv/download','/cv/gabriel.pdf'):return True
 return False
def canonical(raw,parent):
 u=urlsplit(urljoin(parent,raw))
 if u.scheme not in ('http','https'):return None
 if u.hostname in ('corvus.gent','www.corvus.gent'):
  if u.path.rstrip('/') in ('/hack/2','/hack/3','/join-the-army-now'):
   external.append(u.geturl());return None
  return BASE+u.path+('?' + u.query if u.query else '')+('#'+u.fragment if u.fragment else '')
 if u.hostname=='stats.corvus.gent':
  p='/stats/'+u.path.lstrip('/') if u.path=='/' or re.match(r'^/(pidgy|games|map|music|hunt|x|coffee|private|status|hack)/?$',u.path) else u.path
  return BASE+p+('?' + u.query if u.query else '')
 if u.netloc!=urlsplit(BASE).netloc:return None
 if urlsplit(parent).path.startswith('/stats/') and raw.startswith('/') and re.match(r'^/(pidgy|games|map|music|hunt|x|coffee|private|status)/?$',u.path):return BASE+'/stats'+u.path+('?' + u.query if u.query else '')
 return u.geturl()
while queue:
 raw,parent,kind=queue.pop(0);url=canonical(raw,parent)
 if not url:continue
 u=urlsplit(url);target=BASE+u.path+('?' + u.query if u.query else '')
 if u.fragment and kind=='link':fragments.append((target,unquote(u.fragment),parent))
 if target in seen:continue
 if backend_path(u.path):backend.append(target);seen[target]={'backend':True};continue
 try:
  with urlopen(Request(target,headers={'User-Agent':'Corvus-local-QA'}),timeout=10) as r:
   data=r.read();mime=r.headers.get('Content-Type','');status=r.status
   if r.headers.get('Content-Encoding')=='gzip':data=gzip.decompress(data)
  seen[target]={'status':status,'type':mime}
  if 'text/html' in mime:
   text=data.decode('utf8');p=Assets();p.feed(text);seen[target]['ids']=list(p.ids)
   for ref,k in p.refs:queue.append((ref,target,k))
   for ref in re.findall(r'url\([\s\'"]*([^\)\'"\s]+)',text):queue.append((ref,target,'asset'))
   for ref in re.findall(r'(?:from\s*|import\s*\(?)[\'"]([./][^\'"?]+\.(?:js|mjs))[\'"]',text):queue.append((ref,target,'asset'))
  elif 'css' in mime:
   for ref in re.findall(r'url\([\s\'"]*([^\)\'"\s]+)',data.decode('utf8')):queue.append((ref,target,'asset'))
  elif 'javascript' in mime:
   for ref in re.findall(r'(?:from\s*|import\s*\(?)[\'"]([./][^\'"?]+\.(?:js|mjs))[\'"]',data.decode('utf8')):queue.append((ref,target,'asset'))
 except Exception as e:
  seen[target]={'error':str(e)};errors.append({'url':target.replace(BASE,''),'from':parent.replace(BASE,''),'kind':kind,'error':str(e)})
# IDs created by JS are intentionally evaluated by browser flow tests, not this parser.
missing_fragments=[{'url':url.replace(BASE,'')+'#'+frag,'from':parent.replace(BASE,'')} for url,frag,parent in fragments if seen.get(url,{}).get('ids') is not None and frag not in seen[url]['ids'] and frag not in ('','0')]
report={'checked':len(seen),'broken':errors,'backendRoutes':sorted(set(backend)),'productionOwnedRoutes':sorted(set(external)),'fragmentReview':missing_fragments}
out=Path('qa')/(sys.argv[1] if len(sys.argv)>1 else 'links.json');out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'checked':len(seen),'broken':len(errors),'fragmentReview':len(missing_fragments),'backendRoutes':len(set(backend))}))
for x in errors:print(x)
sys.exit(bool(errors))
