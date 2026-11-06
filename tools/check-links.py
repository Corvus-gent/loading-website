"""Check local page/assets paths, without visiting third parties or API writers."""
import json,re,sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
ROOT=Path.cwd()
config=json.loads(Path('vercel.json').read_text())
patterns=[row['source'] for group in ['redirects','rewrites'] for row in config.get(group,[])]
def route_exists(path):
 if path.startswith(('/api/','/go/','/r/','/soldier/')):return True
 if path.rstrip('/') in ['/enter','/the-crow','/revived','/important-call-gabe-maxxer','/coffee-with-gabe','/cv','/gabe','/gabriel','/self','/sidequest']:return True
 for source in patterns:
  regex=re.sub(r':[A-Za-z_]+\*?',lambda m:'.*' if m[0].endswith('*') else '[^/]+',source)
  if re.fullmatch(regex+'/?',path):return True
 return False
class Links(HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  for key,value in attrs:
   if key in ('href','src') and value:self.refs.append(value)
errors=[];checked=0
for file in ROOT.rglob('*.html'):
 if any(p in file.parts for p in ['node_modules','.git','test-results','playwright-report','tools','tests']):continue
 parser=Links();parser.feed(file.read_text())
 for value in parser.refs:
  if value.startswith(('#','data:','mailto:','tel:','javascript:','%%')):continue
  u=urlsplit(value)
  if u.scheme or u.netloc:continue
  pathname=unquote(u.path)
  if not pathname or route_exists(pathname):continue
  p=(ROOT/pathname.lstrip('/')) if pathname.startswith('/') else file.parent/pathname
  if file.relative_to(ROOT).parts[0]=='stats' and pathname.startswith('/') and not p.exists():
   alternate=ROOT/'stats'/pathname.lstrip('/')
   if alternate.exists():p=alternate
  checked+=1
  if not (p.is_file() or (p/'index.html').is_file()):errors.append(str(file.relative_to(ROOT))+': '+value)
if errors:
 print('\n'.join(errors[:40]));raise SystemExit(str(len(errors))+' unresolved local links')
print(str(checked)+' local links/assets checked; dynamic routes accounted for.')
