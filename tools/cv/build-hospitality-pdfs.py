"""One-page, brand-themed hospitality CVs from the shared application sources."""
import json,html,hashlib,shutil
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2]
base=json.loads((ROOT/'cv/bar-bougie/content.json').read_text())
config=json.loads((ROOT/'cv/horeca/venues.json').read_text())
pdfmetrics.registerFont(TTFont('Hospitality','/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('HospitalityBold','/System/Library/Fonts/Supplemental/Arial Bold.ttf'))
pdfmetrics.registerFont(TTFont('HospitalitySerif','/System/Library/Fonts/Supplemental/Georgia.ttf'))
out=ROOT/'output/pdf';out.mkdir(parents=True,exist_ok=True)
manifest={'sources':{},'pdfs':{}}
for file in ['cv/bar-bougie/content.json','cv/horeca/venues.json','tools/cv/build-hospitality-pdfs.py']:
 manifest['sources'][file]=hashlib.sha256((ROOT/file).read_bytes()).hexdigest()
for v in config['venues']:
 file=out/f"gabriel-{v['slug']}-cv.pdf"
 c=canvas.Canvas(str(file),pagesize=(595.28,841.89),invariant=1);c.setTitle(base['name']+' | '+v['name']);c.setAuthor(base['name'])
 paper=HexColor(v['bg']);ink=HexColor(v['ink']);accent=HexColor(v['accent'])
 c.setFillColor(paper);c.rect(0,0,596,842,fill=1,stroke=0)
 c.setFillColor(accent);c.rect(0,807,596,35,fill=1,stroke=0);c.setFillColor(paper);c.setFont('HospitalityBold',9);c.drawString(34,820,'PERSOONLIJKE SOLLICITATIE / WINTERCIRCUS')
 style=ParagraphStyle('body',fontName='Hospitality',fontSize=10,leading=14,textColor=ink)
 bold=ParagraphStyle('bold',parent=style,fontName='HospitalityBold',fontSize=10.5,leading=14)
 small=ParagraphStyle('small',parent=style,fontSize=9,leading=12)
 heading=ParagraphStyle('head',parent=style,fontName='HospitalityBold',fontSize=12,leading=15,textColor=accent)
 def para(text,x,y,width,s=style):
  p=Paragraph(html.escape(text),s);_,h=p.wrap(width,900);p.drawOn(c,x,y-h);return y-h
 c.setFillColor(ink);c.setFont('HospitalitySerif',33);c.drawString(34,766,v['name'])
 c.setFont('HospitalityBold',21);c.drawString(34,729,base['name'])
 c.setFont('Hospitality',10);c.drawString(34,709,'Gent | '+base['email']);c.linkURL('mailto:'+base['email'],(34,705,340,719))
 c.drawImage(ImageReader(str(ROOT/'cv/bar-bougie/assets/gabriel.jpg')),465,701,width=96,height=96,mask='auto')
 c.setStrokeColor(ink);c.line(34,692,561,692)
 y=675;y=para(v['role']+' · enkele uren per week',34,y,520,heading)-12
 y=para(v['why'],34,y,520)-17
 y=para('ERVARING MET MENSEN',34,y,520,heading)-10
 for item in base['experience'][:2]:
  y=para(item['title'],34,y,520,bold)-3;y=para(item['date'],34,y,520,small)-4;y=para(item['text'],34,y,520)-13
 y=para('WAT IK MEEBRENG',34,y,520,heading)-9
 for title,text in v['skills']:
  y=para(title,34,y,520,bold)-3;y=para(text,34,y,520,small)-9
 y=para('WAAROM EN WANNEER',34,y,520,heading)-8
 y=para('Sinds 20 november 2026 lid van de Collective. Naast mijn eigen projecten zoek ik enkele uren werk om mijn appartement in Gent mee te bekostigen. Uren bespreken we samen; flexi als dat binnen mijn statuut past.',34,y,520,small)-8
 y=para(base['partnerships'],34,y,520,small)
 assert y>67,(v['slug'],'PDF overflow',y)
 c.setFillColor(accent);c.rect(0,0,596,49,fill=1,stroke=0);c.setFillColor(paper);c.setFont('HospitalityBold',9);c.drawString(34,28,'Graag eens kennismaken.');c.setFont('Hospitality',8);c.drawString(34,14,'corvus.gent/cv/'+v['slug']);c.linkURL('https://corvus.gent/cv/'+v['slug'],(34,8,400,24));c.drawRightString(561,14,config['updated'])
 c.save();reader=PdfReader(file);assert len(reader.pages)==1;assert base['name'] in reader.pages[0].extract_text()
 target=ROOT/'cv'/v['slug']/'cv.pdf';target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target)
 manifest['pdfs'][v['slug']]=hashlib.sha256(file.read_bytes()).hexdigest()
 print(v['slug'],len(reader.pages),'page; content ends at',round(y))
(ROOT/'cv/horeca/pdf-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
