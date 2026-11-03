from pathlib import Path
import json, hashlib
if Path('music.json').exists():
 raise SystemExit('Refusing to overwrite an existing catalog. Edit music.json or use /music/admin/.')
rows=[]
for line in Path('tools/music-source.txt').read_text().splitlines():
 title,artist,genre=line.split('|')
 row=dict(id='track_'+hashlib.sha256((title+'|'+artist).lower().encode()).hexdigest()[:20],title=title,artist=artist,genre=genre,added='2026-11-03')
 if not artist: row['needsReview']=True
 if artist=='Stromae': row['note']="I ate Korean next to him in Brussels. Shy guy irl, crazy good writer, Belgian GOAT by far. Gave us 00s kids a f*cking good childhood with these bangers."
 rows.append(row)
# Place requested favourites inside their bands, keeping the rest in supplied order.
bands=[(0,['Dance With the Devil','Repose en paix','Mosaïque solitaire']), (10,['Adam and Eve','Cabeza','Babi',"À l'ammoniaque"]),(20,['Les Duele','92i Veyron','92i','Akatsuki','Monaco','Yo No Sé','Ma Chérie','Djomb']),(30,['Ce soir ne sors pas'])]
favourites={title for _,titles in bands for title in titles}
rest=[r for r in rows if r['title'] not in favourites]
for start,titles in bands:
 for offset,title in enumerate(titles): rest.insert(start+offset,next(r for r in rows if r['title']==title))
# Preserve the previously live track, after the supplied ranking.
rest.append(dict(id='0wwPcA6wtMf6HUMpIRdeP7',spotifyId='0wwPcA6wtMf6HUMpIRdeP7',title='Hotline Bling',artist='Drake',genre='us hip-hop',added='2026-11-03'))
Path('music.json').write_text(json.dumps({'tracks':rest},ensure_ascii=False,indent=2)+'\n')
print(len(rest),'tracks')
