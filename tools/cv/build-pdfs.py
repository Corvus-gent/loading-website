"""Build text-based, single-column application CVs from the shared profile data.
Requires reportlab and pypdf. Run after editing cv/profiles.json.
"""
import json,re,shutil,html,argparse,hashlib
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/'cv/profiles.json').read_text());metrics=json.loads((ROOT/'stats/linkedin/data.json').read_text())
out=ROOT/'output/pdf';out.mkdir(parents=True,exist_ok=True)
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='CVName',fontName='Helvetica-Bold',fontSize=22,leading=25,textColor=HexColor('#151713'),spaceAfter=7))
styles.add(ParagraphStyle(name='CVRole',fontName='Helvetica-Bold',fontSize=10,leading=13,textColor=HexColor('#5e5634'),spaceAfter=7))
styles.add(ParagraphStyle(name='CVBody',fontName='Helvetica',fontSize=10,leading=13.5,textColor=HexColor('#252822'),spaceAfter=6))
styles.add(ParagraphStyle(name='CVSmall',parent=styles['CVBody'],fontSize=8,leading=10.6,textColor=HexColor('#5b6056'),spaceAfter=6))
styles.add(ParagraphStyle(name='CVSection',fontName='Helvetica-Bold',fontSize=10.2,leading=13,spaceBefore=10,spaceAfter=6,textColor=HexColor('#20251b'),keepWithNext=True))
styles.add(ParagraphStyle(name='CVEntry',parent=styles['CVBody'],fontName='Helvetica-Bold',spaceAfter=3,keepWithNext=True))
def clean(s):
 for a,b in [('’',"'"),('‘',"'"),('“','"'),('”','"'),('–','-'),('—','-'),('·',' | '),('→',''),('↗',''),('×','x')]:s=s.replace(a,b)
 return s
def para(s,style='CVBody'):return Paragraph(html.escape(clean(s)),styles[style])
def href(url,label):return Paragraph('<link href="'+html.escape(url,quote=True)+'" color="#4a542c">'+html.escape(clean(label))+'</link>',styles['CVSmall'])
def add_section(story,title,paragraphs):
 story.append(para(title.upper(),'CVSection'));story.extend(paragraphs)
def entry(title,text,url=None):
 chunks=[para(title,'CVEntry'),para(text)]
 if url:chunks.append(href(url if url.startswith('https:') else 'https://corvus.gent'+url,'Read: '+url))
 return KeepTogether(chunks)
def footer(canvas,doc):
 canvas.saveState();w,h=doc.pagesize
 canvas.setStrokeColor(HexColor('#d6d8cf'));canvas.line(42,36,w-42,36)
 canvas.setFont('Helvetica',7);canvas.setFillColor(HexColor('#62675c'))
 canvas.drawString(42,24,clean(data['name'])+' | corvus.gent | Updated '+data['updated'])
 canvas.drawRightString(w-42,24,str(doc.page));canvas.restoreState()
parser=argparse.ArgumentParser();parser.add_argument('--only',help='Build one profile by slug');args=parser.parse_args()
if args.only and args.only not in {p['slug'] for p in data['profiles']}:parser.error('Unknown profile slug: '+args.only)
manifest_file=ROOT/'cv/pdf-manifest.json'
manifest=json.loads(manifest_file.read_text()) if manifest_file.exists() else {'version':1,'profiles':{}}
generator_hash=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
def pdf_input(profile):
 return {'version':1,'profile':{k:profile[k] for k in ['slug','path','kind','label','summary','pdf']},'name':data['name'],'email':data['email'],'location':data['location'],'updated':data['updated'],'education':data['education'],'experience':data['experience'],'research':data['research'],'projects':data['projects'],'summer2027Locations':data['summer2027Locations'] if profile['slug'] in ['tech','social-media'] else None,'metrics':{'totals':metrics['totals'],'source':metrics['source']} if profile['kind']=='social' else None}
def source_hash(profile):
 return hashlib.sha256(json.dumps(pdf_input(profile),ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
for profile in data['profiles']:
 if args.only and profile['slug']!=args.only:continue
 social=profile['kind']=='social';academic=profile['kind']=='academic';hybrid=profile['kind']=='hybrid'
 file=out/(profile['slug']+'-cv.pdf')
 story=[para(data['name'],'CVName'),para(profile['label'],'CVRole'),href('mailto:'+data['email'],data['email']+' | '+data['location']),*([para('Summer 2027 preference: '+data['summer2027Locations'],'CVSmall')] if profile['slug'] in ['tech','social-media'] else []),href('https://corvus.gent'+profile['path'],'Web profile: corvus.gent'+profile['path']),para(profile['summary'])]
 if academic:
  add_section(story,'Academic interests',[para(t) for t in profile['interests']])
 if social:
  t=metrics['totals'];add_section(story,'Selected evidence',[para(f"LinkedIn: {t['impressions']:,} impressions, {t['membersReached']:,} members reached and {t['engagements']:,} engagements. Aggregate export, {metrics['source']['start']} to {metrics['source']['end']}."),href('https://stats.corvus.gent/linkedin','Source: stats.corvus.gent/linkedin'),para('Content portfolio: hackathon diaries and filmed team interviews; AI-assisted, platform-specific edits; community participation through Corvus.'),href('https://corvus.gent/compound/impact/','Editing workflow: corvus.gent/compound/impact'),href('https://corvus.gent/sf/larp/','Field notes: corvus.gent/sf/larp')])
 if not social:
  add_section(story,'Course research',[entry(p['title'],p['text'],p['href']) for p in data['research']])
 if not social:
  add_section(story,'Selected projects',[entry(p['title'],p['text']) for p in data['projects'][:1 if academic else 2 if hybrid else 3]])
 if profile['kind']=='tech':
  add_section(story,'Experience',[entry(data['experience'][0]['title']+' | '+data['experience'][0]['date'],' '.join(data['experience'][0]['bullets'][:2])),para('Earlier: GTM intern at Pidgy / Alkmist (October 2026); founded a web studio and tutoring business (2025-2026).','CVSmall')])
 else:
  add_section(story,'Experience',[entry(p['title']+' | '+p['date'],' '.join((p['bullets'][1:] if social and p['title']=='Founder · Corvus' else p['bullets'][:2 if p['title'].startswith('Founder') else 1]))) for p in data['experience'][:1 if academic else 2 if hybrid else 3]])
 add_section(story,'Education',[para(p['title']+' | '+p['date']+'. '+(p['text'].split(' Coursework')[0] if hybrid else p['text'])) for p in data['education']])
 skills='Python, JavaScript/TypeScript, Rust, C/C++, Node.js, ROS 2, Postgres, Redis. AI-assisted development with Codex and Claude.'
 if social:skills='Interviews, short-form content, livestreams, community building, analytics and AI-assisted editing with Compound. Seven human languages; programming background.'
 add_section(story,'Skills',[para(skills)])
 doc=SimpleDocTemplate(str(file),pagesize=(612,792),rightMargin=42,leftMargin=42,topMargin=36,bottomMargin=48,title=data['name']+' - '+profile['label'],author=data['name'],invariant=1)
 doc.build(story,onFirstPage=footer,onLaterPages=footer)
 reader=PdfReader(file);text=' '.join(p.extract_text() for p in reader.pages)
 assert data['name'] in text and data['email'] in text
 assert len(reader.pages)==1,(profile['slug'],str(len(reader.pages))+' pages; edit the selected content to fit one page')
 deployed=ROOT/'cv'/profile['pdf'];deployed.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,deployed)
 manifest['profiles'][profile['slug']]={'inputHash':source_hash(profile),'generatorHash':generator_hash,'fileHash':hashlib.sha256(deployed.read_bytes()).hexdigest(),'pages':len(reader.pages)}
 print(profile['slug'],len(reader.pages),'page(s)',len(text),'text characters')
manifest['profiles']={k:v for k,v in manifest['profiles'].items() if k in {p['slug'] for p in data['profiles']}}
manifest_file.write_text(json.dumps(manifest,indent=2)+'\n')
