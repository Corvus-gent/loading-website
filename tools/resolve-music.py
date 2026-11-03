"""Conservative public Apple catalog lookup, resumable; never invent track IDs.
Run from repository root. Uncertain results stay searchable, with review alternatives.
"""
from pathlib import Path
import json,time,urllib.request,urllib.parse,unicodedata,re,difflib
root=Path(__file__).resolve().parent.parent
cachefile=root/'tools/music-matches.json'
cache=json.loads(cachefile.read_text()) if cachefile.exists() else {}
def norm(s):
 return re.sub(r'[^a-z0-9 ]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
def score(t,r):
 a,b=norm(t['title']),norm(r['trackName'])
 title=difflib.SequenceMatcher(None,a,b).ratio()
 # Ignore feature credits; don't silently choose a remix for an original.
 if b.startswith(a+' feat') or b.startswith(a+' featuring'): title=.99
 if any(x in b and x not in a for x in ['karaoke','tribute','sped up','slowed','remix','live']): title-=.35
 artist=norm(t['artist']); found=norm(r['artistName'])
 artistScore=1 if artist and (artist in found or found in artist) else difflib.SequenceMatcher(None,artist,found).ratio()
 if artist and '&' in t['artist']:
  artistScore=max(artistScore, max((1 if norm(p.strip()) in found else 0) for p in t['artist'].split('&')))
 return round(.65*title+.35*artistScore,3),title,artistScore
tracks=json.loads((root/'music.json').read_text())['tracks']
for index,t in enumerate(tracks):
 if t['id'] in cache: continue
 query=t['title']+' '+t['artist']
 url='https://itunes.apple.com/search?'+urllib.parse.urlencode(dict(term=query,entity='song',limit=25,country='US'))
 try:
  with urllib.request.urlopen(url,timeout=15) as r: data=json.load(r)
  results=[]
  for r in data.get('results',[]):
   if r.get('kind')!='song': continue
   sc,ts,ar=score(t,r)
   results.append(dict(score=sc,titleScore=ts,artistScore=ar,title=r['trackName'],artist=r['artistName'],appleId=str(r['trackId']),appleUrl=r['trackViewUrl'],duration=r.get('trackTimeMillis',0)))
  results.sort(key=lambda r:r['score'],reverse=True)
  cache[t['id']]={'query':query,'results':results[:3]}
 except Exception as e:
  print('lookup deferred',index,type(e).__name__,flush=True)
  time.sleep(6); continue
 cachefile.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n')
 print(index+1,len(tracks),query,'=>',results[0]['score'] if results else 'none',flush=True)
 time.sleep(3.2)
# A separate apply step prevents overwriting manual music.json edits during lookups.
