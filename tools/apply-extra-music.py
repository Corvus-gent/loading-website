from pathlib import Path
import json,re
root=Path(__file__).resolve().parent.parent
p=root/'music.json';data=json.loads(p.read_text());extra=json.loads((root/'tools/music-extra-candidates.json').read_text())
# These unspecified artists were resolved from context and provider listings.
artists={'Ce soir ne sors pas':'Lacrim','Cabo Verde Riba Nhos':'Dj Doraemon','A Fábrica':'Nazfitaz','Le palais de nos chimères':'Charles Aznavour','Posso Beijar Sua Boca':'Léo Santana & Anitta','Menina de Vermelho':'MC Menor JP, RAMONMIX & The Ironix','Paris Como Hakimi':'Morad','Chambre 04':'Dj Kawest & Attachingboy','Nois e Nois':'Veigh & Supernova Ent','The Man They Love to Hate':'The Stranglers'}
exclude={'Eternity and a Day','Bande Organisée'}
used={t.get('appleId') for t in data['tracks'] if t.get('appleId')};changed=[]
for t in data['tracks']:
 if t['title'] in exclude or (not t['artist'] and t['title'] not in artists):continue
 for c in extra.get(t['id'],[]):
  if re.search(r'\b(live|remix|cover|instrumental|karaoke)\b',c['heading'],re.I) and not re.search(r'remix',t['title'],re.I):continue
  url=c['url'];apple=re.search(r'music\.apple\.com/([a-z]{2})/song/(?:[^/]+/)?(\d+)',url)
  sp=re.search(r'open\.spotify\.com/(?:intl-[a-z]+/)?track/([A-Za-z0-9]{22})',url)
  if apple and not t.get('appleId') and apple[2] not in used:
   t.update(appleId=apple[2],appleUrl=url);used.add(apple[2]);changed.append(t['title'])
  if sp and not t.get('spotifyId'):t['spotifyId']=sp[1]
 if t.get('appleId') or t.get('spotifyId'):
  t.pop('needsReview',None)
  if t['title'] in artists:t['artist']=artists[t['title']]
  if t['title']=='The Man They Love to Hate':t['genre']='rock'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Added direct Apple links:',len(changed))
print('Still without verified playback:',sum(bool(t.get('needsReview')) for t in data['tracks']))
