#!/usr/bin/env python3
"""Static series pages: publish only verified, explicitly enabled episodes."""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
import json,re
ROOT=Path(__file__).resolve().parents[1]

def text(value):return escape(str(value or ''),quote=True)
def url(value):
 if not value:return ''
 u=urlsplit(value)
 if u.scheme!='https' or not u.hostname or u.username or u.password:raise ValueError('Episode links must be full HTTPS URLs without credentials')
 return value

def validate(config):
 hours=config['hours']
 for key in ['hackathons','streams','videos']:
  n=hours.get(key)
  if n is not None and (type(n) not in (int,float) or not 0<=n<=100000):raise ValueError('Hours must be null or a nonnegative number: '+key)
 seen=set()
 for ep in config['episodes']:
  slug=ep.get('slug','')
  if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',slug) or slug in seen or slug=='episode-template':raise ValueError('Unique safe episode slug required')
  seen.add(slug)
  if ep.get('published') is not True:continue
  for key in ['title','shop','neighborhood','deal','language','videoURL','shopURL']:
   if not isinstance(ep.get(key),str) or not ep[key].strip():raise ValueError('Published episode needs '+key)
  url(ep['videoURL']);url(ep['shopURL'])
  if type(ep.get('foodScore')) not in (int,float) or not 0<=ep['foodScore']<=10:raise ValueError('Food score must be 0–10')
  if type(ep.get('dealAgreed')) is not bool:raise ValueError('Record the actual deal outcome')
 return config

def shell(title,description,body,template=False):
 return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{text(title)} | corvus.gent</title><meta name="description" content="{text(description)}"><link rel="icon" href="/logo.png"><link rel="stylesheet" href="/dontpay/dontpay.css">{'<meta name="robots" content="noindex,follow">' if template else ''}</head><body><a class="dp-skip" href="#main">Skip to content</a><main class="dp-main" id="main">{body}</main><script type="module" src="/dontpay/dontpay.js"></script></body></html>'''

def counters(config):
 h=config['hours'];values=[h[k] for k in ['hackathons','streams','videos']]
 total=f'{sum(v for v in values if v is not None):g} hours logged' if any(v is not None for v in values) else 'The clock starts with an honest baseline.'
 cards=''.join(f'<article><b>{"—" if h[k] is None else format(h[k],"g")}</b><span>{label} / hours</span></article>' for k,label in [('hackathons','Hackathons'),('streams','Streams'),('videos','Videos')])
 return f'<div class="dp-hours">{cards}</div><p><strong>{total}</strong></p><p class="dp-small">{text(h["note"])} {"Baseline not entered yet. A dash means unlogged, not zero." if any(v is None for v in values) else ""}</p>'

def overview(config):
 eps=[e for e in config['episodes'] if e.get('published') is True]
 cards='<div class="dp-grid">'+''.join(f'<a class="dp-episode-card" href="/dontpay/{text(e["slug"])}/"><span>EPISODE {i+1:02}</span><h3>{text(e["title"])}</h3><p>{text(e["shop"])} · {text(e["neighborhood"])}</p><p>{text(e["language"])}</p><span>Watch the deal →</span></a>' for i,e in enumerate(eps))+'</div>' if eps else '<div class="dp-empty"><p class="dp-kicker">CAMERA READY. FIRST DEAL PENDING.</p><h3>Episode 1 coming soon</h3><p>First stop: a Turkish bakery or lahmacun spot. No shop has agreed yet. No meal has been scored. That part has to happen in real life.</p><a href="#suggest">Know the right counter? Suggest it ↓</a></div>'
 return shell("I DON'T PAY",'A promo video in your language, in exchange for a meal. A Corvus series about asking, making and getting the reps in.',f'''
<nav class="dp-crumbs" aria-label="Breadcrumb"><a href="/">← Corvus</a><span>A SERIES BY GABE / SAN FRANCISCO</span></nav>
<section class="dp-hero"><div><p class="dp-kicker">SEVEN LANGUAGES. ONE HUNGRY BUILDER.</p><h1>I DON'T<br><em>PAY.</em></h1><p class="dp-lead">A promo video for your shop.<br>A meal for me.</p><p class="dp-subline">I walk in. I ask the owner. If we agree, I make a short video in their language and earn my lunch. No agreement? I pay normally or say thanks and leave.</p><div class="dp-actions"><a class="dp-button" href="#suggest">Suggest the next spot ↓</a><a class="dp-button secondary" href="#episodes">The episodes</a></div></div><aside class="dp-receipt" aria-label="The proposed exchange"><div class="receipt-top"><span>THE DEAL</span><span>NO. 001 / SOON</span></div><strong>1 PROMO<br>VIDEO</strong><span class="exchange" aria-hidden="true">↕</span><strong>1 GOOD<br>MEAL</strong><p>Made for the shop.<br>In their language.<br>Agreed before we start.</p><p class="receipt-total">TOTAL: A FAIR TRADE.<br>Food is not free. I bring something useful.</p></aside></section>
<section class="dp-section"><p class="dp-kicker">THE POINT IS THE PRACTICE</p><h2>Students optimize for grades.<br>I optimize for reps.</h2><p class="dp-lead">One more conversation. One more pitch. One more video made in the real world. Starting with börek and lahmacun, because ambition works better after lunch.</p><div class="dp-grid"><article class="dp-step"><span>01 / ASK</span><h3>Earn a yes.</h3><p>Speak to the owner first. Explain the exact video and the meal we would trade. A no is a complete answer.</p></article><article class="dp-step"><span>02 / MAKE</span><h3>Make it useful.</h3><p>Film the food, the craft and the shop. Make a short promo in their language. Seven languages, plenty of room to improve.</p></article><article class="dp-step"><span>03 / EAT</span><h3>Show the whole deal.</h3><p>Deliver the agreed clip. Take a bite. Give my honest score and say whether the trade happened. No fake yes, no imaginary free lunch.</p></article></div></section>
<section class="dp-section" id="episodes"><div class="dp-section-heading"><div><p class="dp-kicker">THE FIELD REPORTS</p><h2>One counter at a time.</h2></div><p>Real shops. Real conversations. Episodes appear after the visit and the agreed permissions.</p></div>{cards}<p class="dp-small"><a href="/dontpay/episode-template/">See the episode format →</a> · Clearly marked preview; not a filmed episode.</p></section>
<section class="dp-section" id="hours"><p class="dp-kicker">THE REPS, ON RECORD</p><h2>Hours in. Stories out.</h2>{counters(config)}</section>
<section class="dp-section dp-suggest-layout" id="suggest"><div><p class="dp-kicker">WHERE SHOULD I WALK IN?</p><h2>Suggest the<br>next spot.</h2><p class="dp-lead">A Turkish bakery. A lahmacun counter. Somewhere the food is good and the owner might be up for a creative trade.</p><p class="dp-small">Suggestions go privately to Gabe, not onto a public list. Please include only public shop details. They are kept for up to 90 days. If the connection fails, you can save the suggestion on this device and retry later.</p><p><a href="/privacy/">Privacy →</a></p></div><div><form class="dp-form" id="spot-form"><label>Shop name<input name="shop" maxlength="100" required autocomplete="organization" placeholder="The bakery you keep going back to"></label><label>Neighborhood / city<input name="neighborhood" maxlength="100" required placeholder="Mission District, San Francisco"></label><label>Public shop link <span class="dp-small">Optional · website or map</span><input name="link" type="url" maxlength="500" placeholder="https://…"></label><label>Language for the promo <span class="dp-small">Optional</span><input name="language" maxlength="60" placeholder="Turkish"></label><label>Why this spot? <span class="dp-small">Optional · no personal contact details</span><textarea name="note" maxlength="500" placeholder="Tell me what to order or what makes the place special."></textarea></label><label class="honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label class="check"><input type="checkbox" name="consent" required><span>I agree to send these public shop details privately to Gabe for this series.</span></label><button class="dp-button" type="submit">Send the suggestion →</button><p role="status" id="spot-status" aria-live="polite"></p><div id="save-choice" hidden><button class="dp-button secondary" type="button" id="save-local">Save on this device</button><p class="dp-small">Not sent to Gabe. Stored here for up to 90 days until you retry or clear it.</p></div></form><section class="dp-saved" id="saved-panel" hidden><h3>Still on this device</h3><p id="saved-count"></p><div class="dp-actions"><button class="dp-button" id="retry-saved" type="button">Retry saved suggestions</button><button class="dp-button secondary" id="clear-saved" type="button">Clear this device</button></div><p role="status" id="saved-status" aria-live="polite"></p></section><noscript><p>The suggestion form needs JavaScript. You can still <a href="/links/gabe">contact Gabe directly</a>.</p></noscript></div></section>
<nav class="dp-next" aria-label="Next steps"><a href="/hack/4/">Read the Muse hackathon story →</a><a href="/legion/">Build with the Legion →</a></nav>''')

def episode(ep,next_ep=None):
 preview=ep is None
 e=ep or dict(title='The first deal',shop='Shop to be confirmed',neighborhood='Neighborhood to be confirmed',deal='Agree the video and meal with the owner before filming.',language='Language to be confirmed',foodScore=None,dealAgreed=None)
 video='<div class="dp-video"><p class="dp-kicker">NO FOOTAGE YET</p><p>The episode video goes here after filming and permission. This is a format preview, not an actual visit.</p></div>'
 if not preview:
  source=url(e['videoURL']);u=urlsplit(source);embed=''
  if u.hostname in ('youtube.com','www.youtube.com','youtu.be'):
   from urllib.parse import parse_qs
   ident=u.path.strip('/') if u.hostname=='youtu.be' else parse_qs(u.query).get('v',[''])[0]
   if re.fullmatch(r'[A-Za-z0-9_-]{11}',ident):embed='https://www.youtube-nocookie.com/embed/'+ident
  elif u.hostname in ('vimeo.com','www.vimeo.com') and re.fullmatch(r'/\d+',u.path):embed='https://player.vimeo.com/video'+u.path
  video=f'<div class="dp-video"><button class="dp-button" data-video="{text(embed)}" type="button">Load episode video ▶</button><p>Loads the video provider only when you choose to play.</p></div>' if embed else '<div class="dp-video"><p>Watch this episode on its original video page.</p></div>'
  video+=f'<p><a href="{text(source)}" target="_blank" rel="noopener noreferrer">Watch the original video ↗</a></p>'
 score='Not scored yet' if preview else f'{e["foodScore"]:g}/10'
 deal='Not agreed yet' if preview else ('✓ Deal agreed' if e['dealAgreed'] else '✗ No trade this time')
 shop=text(e['shop']) if preview else f'<a href="{text(url(e["shopURL"]))}" target="_blank" rel="noopener noreferrer">{text(e["shop"])} ↗</a>'
 nextlink=f'<a href="/dontpay/{text(next_ep["slug"])}/">Next: {text(next_ep["title"])} →</a>' if next_ep else '<a href="/dontpay/#suggest">Choose the next spot →</a>'
 return shell(e['title']+' · I DON\'T PAY','One shop, one video, one proposed trade.',f'''<nav class="dp-crumbs"><a href="/dontpay/">← All episodes</a><span>I DON'T PAY / {'FORMAT PREVIEW' if preview else 'THE FIELD REPORT'}</span></nav><article class="dp-episode">{'<p class="dp-template">EPISODE TEMPLATE — not filmed, not published as an episode. No shop or deal is confirmed.</p>' if preview else ''}<p class="dp-kicker">STUDENTS OPTIMIZE FOR GRADES. I OPTIMIZE FOR REPS.</p><h1>{text(e['title'])}</h1>{video}<div class="dp-grid"><section class="dp-fact"><small>THE SHOP</small><h2>{shop}</h2><p>{text(e['neighborhood'])}</p></section><section class="dp-fact"><small>THE DEAL</small><p>{text(e['deal'])}</p><p>Promo language: <strong>{text(e['language'])}</strong></p></section></div><section class="dp-score" aria-label="The score"><div><strong>{score}</strong><span>Food · Gabe’s personal score</span></div><div><strong>{deal}</strong><span>The actual outcome</span></div></section><nav class="dp-next"><a href="/dontpay/">← Back to the series</a>{nextlink}</nav></article>''',preview)

def build():
 c=validate(json.loads((ROOT/'dontpay/config.json').read_text()))
 (ROOT/'dontpay/index.html').write_text(overview(c))
 (ROOT/'dontpay/episode-template').mkdir(exist_ok=True)
 (ROOT/'dontpay/episode-template/index.html').write_text(episode(None))
 eps=[e for e in c['episodes'] if e.get('published') is True]
 for i,e in enumerate(eps):
  target=ROOT/'dontpay'/e['slug'];target.mkdir(exist_ok=True);(target/'index.html').write_text(episode(e,eps[i+1] if i+1<len(eps) else None))
 print(f'I DON\'T PAY: {len(eps)} published episodes; honest template and hours built.')
if __name__=='__main__':build()
