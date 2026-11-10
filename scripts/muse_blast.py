#!/usr/bin/env python3
"""Run from repository root. Credentials stay in environment; costs are recorded."""
import os,json,re,time,urllib.request,urllib.error,random
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
KEY=os.environ['OPENROUTER_API_KEY']
API='https://openrouter.ai/api/v1'
OUT=Path('public/arena');OUT.mkdir(parents=True,exist_ok=True)
MUSE=os.environ.get('MUSE','meta/muse-spark-open')
CAP=int(os.environ.get('CAP','8000'))
COSTS=[]
def req(path,body=None):
 r=urllib.request.Request(API+path,data=json.dumps(body).encode() if body else None,headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(r,timeout=150) as f:d=json.load(f)
 except urllib.error.HTTPError as e:
  try:msg=json.load(e).get('error',{}).get('message',str(e.code))
  except Exception:msg=str(e.code)
  raise RuntimeError(str(e.code)+': '+msg)
 if d.get('error'):raise RuntimeError(str(d['error']))
 if d.get('usage'):COSTS.append(d['usage'].get('cost'))
 return d

def call(model,cap,prompt):
 return req('/chat/completions',{'model':model,'max_tokens':cap,'messages':[{'role':'user','content':prompt}]})

def build(label,model,prompt,file):
 try:
  d=call(model,CAP,prompt+' Keep it compact, under 2500 visible output tokens. Output ONLY complete raw HTML starting <!doctype html>, with inline CSS/JS and no external assets. Finish all JavaScript and close body/html tags.')
  c=d['choices'][0];html=re.sub(r'^```[^\n]*\n|\n```\s*$','',c['message'].get('content') or '').strip()
  if c.get('finish_reason')=='length' or '</html>' not in html.lower() or '<script' in html.lower() and '</script>' not in html.lower():raise RuntimeError('Incomplete HTML rejected')
  (OUT/file).write_text(html)
  result={'name':label,'model':model,'file':file,'ok':True,'cost':d.get('usage',{}).get('cost')}
 except Exception as e:result={'name':label,'model':model,'file':file,'ok':False,'error':str(e)}
 print(json.dumps(result),flush=True);return result

def main():
 global MUSE,CAP
 selected=False
 for model in dict.fromkeys([MUSE,'meta/muse-ember']):
  for cap in [x for x in [16000,12000,8000] if x<=CAP]:
   try:
    call(model,cap,'Reply OK, no explanation.')
    MUSE,CAP=model,cap;selected=True;break
   except RuntimeError as e:
    print('Probe:',model,cap,str(e),flush=True)
    if '402' not in str(e):raise
  if selected:break
 if not selected:raise SystemExit('No affordable Muse request at caps 16000/12000/8000; no files published.')
 print('SELECTED',MUSE,CAP,flush=True)
 models=req('/models')['data']
 def newest(pred):
  eligible=[m for m in models if pred(m['id'])]
  return max(eligible,key=lambda m:m.get('created',0))['id'] if eligible else None
 contestants=[('Muse',MUSE),('Claude',newest(lambda i:i.startswith('anthropic/claude') and 'sonnet' in i)),('Codex',newest(lambda i:i.startswith('openai/') and 'codex' in i))]
 contestants=[c for c in contestants if c[1]];random.shuffle(contestants)
 nest='Create a striking dark black and gold raven-themed landing page for corvus.gent: a community of builders helping each other, run in public by Gabe in San Francisco. Include one playful interactive element, accessible controls, mobile layout. All text must stay readable. Do not identify the AI/model that made this page.'
 game='Build RAVEN RUSH, a polished responsive canvas game. A raven flies through a dark city, collects gold coins, avoids obstacles. Space or tap to flap. Start and restart buttons, score and localStorage high score (handle unavailable storage), game-over screen, share score on X via intent URL. Link back to /arena/index.html. Footer Built by Meta Muse. Scale canvas to phone and desktop. Keep game mechanics simple and complete.'
 jobs=[('Raven Rush',MUSE,game,'game.html')]+[(name,model,nest,'nest-'+chr(97+i)+'.html') for i,(name,model) in enumerate(contestants)]
 with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda j:build(*j),jobs))
 good=[r for r in results if r['ok'] and r['file'].startswith('nest-')]
 if not good or not any(r['ok'] and r['file']=='game.html' for r in results):raise SystemExit('Required Muse build missing; inspect results before deployment.')
 mapping={r['file']:r['name'] for r in good}
 arena=f'''Build a polished BLIND NEST arena landing page at /arena/index.html, black and gold raven theme, mobile responsive. Exactly these successfully generated contestants are available: {json.dumps(mapping)}. Render one card for each with sandbox="allow-scripts" iframe src="/arena/FILENAME", titled Nest A/B/C corresponding to filename, no broken links or absent contestants. Hide model identities until the visitor votes using a Best one button. Then reveal names from the mapping with a short raven-wing animation. Votes are local to this browser, not global: say so. If only one nest exists say Single contender preview and do not pretend it is a multi-model contest. Link prominently to Raven Rush at /arena/game.html. Include a Name this battle poll with Raven Royale, The Blind Nest, Model Mortal Kombat, custom text; persist locally with try/catch. Include X and LinkedIn share links using current page URL. Short Why Muse section describing Ember as fast and Spark Open for coding; link https://openrouter.ai/meta/muse-spark-open . No unverified prices or capability claims. No fake email signup. Footer: Arena built by Meta Muse. All iframe previews need useful height and mobile layout.'''
 results.append(build('Arena',MUSE,arena,'index.html'))
 manifest={'selected_model':MUSE,'cap':CAP,'results':results,'cost_usd':sum(c for c in COSTS if c is not None),'cost_complete':all(c is not None for c in COSTS)}
 (OUT/'_build.json').write_text(json.dumps(manifest,indent=2))
 print('TOTAL_COST_USD',manifest['cost_usd'],flush=True)
 if not results[-1]['ok']:raise SystemExit('Arena build failed')
if __name__=='__main__':main()
