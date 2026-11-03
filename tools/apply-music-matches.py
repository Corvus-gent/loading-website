"""Apply conservatively verified links without changing stable IDs or ranking."""
from pathlib import Path
import json,re,unicodedata
root=Path(__file__).resolve().parent.parent
p=root/'music.json';data=json.loads(p.read_text())
apple=json.loads((root/'tools/music-matches.json').read_text())
spotify=json.loads((root/'tools/music-spotify-matches.json').read_text())
# Human review of search headings rejected covers, a remix, an album-theme excerpt,
# non-original collaborators and false artist-name matches in tribute titles.
reject={'Lady Brown','Eternity and a Day','Strangers in the Night','Beware','4:44',"Don't Stop the Music",'The Way I Are','Obsessed','Alors on danse','Fils de joie','Stairway to Heaven','Yo No Sé'}
manual={'Dance With the Devil':'4LCzEYKPFcd2FCOmZdVDnM','Mosaïque solitaire':'7wFK2ReVQpq80IAGs6eI1l','Vomitspit':'07nA7gafu75RjIkAUxtjjr'}
notes=['# Music matching review', '', 'Every requested song is in music.json. An unverified platform uses a clearly labelled search link, never an invented ID.', '', 'Selected extra MF DOOM track: **Vomitspit**. Chief Keef additions: **Love Sosa**, **I Don’t Like**, **Faneto**.', '', 'The user’s ranking bands are honoured; uncertain artist/version choices can be corrected in /music/admin/ by editing a song or pasting its direct link.', '', 'Search candidates below are alternatives to inspect, not approved matches. Catalog availability can differ by region.', '']
seen=set()
for track in data['tracks']:
 results=apple.get(track['id'],{}).get('results',[])
 best=results[0] if results else None
 if not track.get('appleId') and track['artist'] and best and best['score']>=.93 and best['artistScore']>=.9 and best['titleScore']>=.9:
  # Never map two requested versions to a single catalog recording.
  if best['appleId'] not in seen:
   track.update(appleId=best['appleId'],appleUrl=best['appleUrl'])
 if track.get('appleId'):seen.add(track['appleId'])
 if track['id'] in spotify and track['title'] not in reject:
  track['spotifyId']=spotify[track['id']]['spotifyId']
 if track['title'] in manual:track['spotifyId']=manual[track['title']]
 if not track.get('appleId') and not track.get('spotifyId'):
  track['needsReview']=True
 else:track.pop('needsReview',None)
 if track.get('needsReview') or not track.get('spotifyId') or not track.get('appleId'):
  notes.extend([f"## {track['title']} — {track['artist'] or 'artist unspecified'}",f"- Internal ID: `{track['id']}`",f"- Missing verified links: {', '.join(n for n,k in [('Spotify','spotifyId'),('Apple Music','appleId')] if not track.get(k))}"])
  for r in results[:2]:notes.append(f"- Candidate: [{r['title']} — {r['artist']}]({r['appleUrl']}) (match score {r['score']})")
  if not results:notes.append('- No Apple catalog candidate returned.')
  if track['title']=='El cuento de Pedro y el lobo':notes.append('- Requested version is approximately 25 minutes; verify narrator and duration before attaching.')
  if track['title']=='Scarface':notes.append('- User wrote “scarface capital”; do not silently substitute Capital Bra.')
  if track['title']=='Contesto':notes.append('- User wrote “conteto morad”; exact title still needs confirmation.')
  notes.append('')
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(root/'tools/music-review.md').write_text('\n'.join(notes)+'\n')
print({'tracks':len(data['tracks']),'spotify':sum(bool(t.get('spotifyId')) for t in data['tracks']),'apple':sum(bool(t.get('appleId')) for t in data['tracks']),'unverified':sum(bool(t.get('needsReview')) for t in data['tracks'])})
