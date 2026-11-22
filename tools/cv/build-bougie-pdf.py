"""Build the one-page Bar Bougie application PDF from the same copy as the web page."""
import json,html,shutil,hashlib
from io import BytesIO
from PIL import Image
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2];d=json.loads((ROOT/'cv/bar-bougie/content.json').read_text())
pdfmetrics.registerFont(TTFont('Bougie','/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('BougieBold','/System/Library/Fonts/Supplemental/Arial Bold.ttf'))
pdfmetrics.registerFont(TTFont('BougieDisplay','/System/Library/Fonts/Supplemental/Impact.ttf'))
ink=HexColor('#19191a');red=HexColor('#e73c3e');cream=HexColor('#f5eddc');orange=HexColor('#f9ad33')
out=ROOT/'output/pdf';out.mkdir(parents=True,exist_ok=True);file=out/'gabriel-bar-bougie-cv.pdf'
c=canvas.Canvas(str(file),pagesize=(595.28,841.89),invariant=1);c.setTitle(d['name']+' | Bar Bougie');c.setAuthor(d['name'])
c.setFillColor(cream);c.rect(0,0,595.28,841.89,fill=1,stroke=0)
c.setFillColor(red);c.rect(0,793,595.28,49,fill=1,stroke=0);c.setFillColor(cream);c.setFont('BougieBold',9);c.drawString(32,814,'VOOR BAR BOUGIE / WINTERCIRCUS');c.drawRightString(563,814,'CORVUS.GENT / CV')
c.setFillColor(ink);c.setFont('BougieDisplay',30);c.drawString(32,754,'EEN EXTRA PAAR HANDEN.')
c.setFillColor(red);c.setFont('BougieDisplay',23);c.drawString(32,726,'EN EEN GOED GESPREK.')
c.setFillColor(ink);c.setFont('BougieBold',18);c.drawString(32,692,d['name'])
c.setFont('Bougie',9);c.drawString(32,674,'Gent  |  '+d['email']);c.linkURL('mailto:'+d['email'],(32,670,340,685),relative=0)
c.setStrokeColor(ink);c.line(32,658,563,658)
body=ParagraphStyle('body',fontName='Bougie',fontSize=9,leading=12,textColor=ink,spaceAfter=0)
small=ParagraphStyle('small',parent=body,fontSize=8,leading=11)
bold=ParagraphStyle('bold',parent=body,fontName='BougieBold',fontSize=9.5,leading=12)
head=ParagraphStyle('head',parent=body,fontName='BougieDisplay',fontSize=16,leading=19,textColor=red)
def para(text,x,y,width,style=body):
 p=Paragraph(html.escape(text),style);_,height=p.wrap(width,800);p.drawOn(c,x,y-height);return y-height
# Reading column.
x=32;w=337;y=642
for title,text in [('WAAROM IK WIL MEEDRAAIEN',d['why']+' '+d['partnerships'])]:
 y=para(title,x,y,w,head)-8;y=para(text,x,y,w)-14
for item in d['experience']:
 y=para(item['title'],x,y,w,bold)-3;y=para(item['date'],x,y,w,small)-5;y=para(item['text'],x,y,w)-12
y=para('OPLEIDING',x,y,w,head)-7;y=para(d['education'],x,y,w)-12
y=para('UREN & AFSPRAKEN',x,y,w,head)-7;y=para(d['availability'],x,y,w,small)
assert y>73,('Main column overflows',y)
# Colour-block sidebar: personality, with the Corgi Cafe evidence photo.
c.setFillColor(orange);c.roundRect(390,90,173,552,10,fill=1,stroke=0)
photo=BytesIO()
with Image.open(ROOT/'cv/bar-bougie/assets/trudy.webp') as original:original.convert('RGB').save(photo,format='JPEG',quality=88,optimize=True)
photo.seek(0)
c.drawImage(ImageReader(photo),402,442,width=149,height=186.25)
sy=430;sw=149
sy=para('MET TRUDY IN SAN FRANCISCO',402,sy,sw,ParagraphStyle('caption',parent=small,fontName='BougieBold',fontSize=7,leading=9))-10
sy=para('COLLECTIVE SINDS 20/11',402,sy,sw,bold)-6
sy=para('Sinds 20 november 2026 lid van de Collective bij Wintercircus.',402,sy,sw,small)-13
for title,text in [('KOKEN & CONTENT','Ik kook graag en maak TikTok-video’s, vooral over steak.'),('THEE & KOFFIE','Een goeie kop en een goed gesprek: daar blijf ik graag voor zitten.'),('TALEN & DISCIPLINE','Zeven mensentalen. Braziliaans jiujitsu, zes tot tien trainingen per week.'),('WARME CONTACTEN','Warme contacten bij Corgi Cafe in San Francisco, waar ik graag founders ontmoette.')]:
 sy=para(title,402,sy,sw,ParagraphStyle('sidehead'+title,parent=bold,fontSize=8,leading=10))-4;sy=para(text,402,sy,sw,small)-12
assert sy>100,('Sidebar overflows',sy)
c.setFillColor(red);c.rect(0,0,595.28,61,fill=1,stroke=0);c.setFillColor(cream);c.setFont('BougieBold',10);c.drawString(32,38,'Graag tot aan de bar.')
c.setFont('Bougie',8);c.drawString(32,21,'Webversie, TikTok en meer: corvus.gent/cv/bar-bougie');c.linkURL('https://corvus.gent/cv/bar-bougie',(32,15,360,31),relative=0);c.drawRightString(563,21,d['updated'])
c.save();reader=PdfReader(file);assert len(reader.pages)==1
text=reader.pages[0].extract_text();assert d['name'] in text and '2025 & 2026' in text and 'drie maanden' in text
shutil.copyfile(file,ROOT/'cv/bar-bougie/cv.pdf')
manifest={'sourceHash':hashlib.sha256((ROOT/'cv/bar-bougie/content.json').read_bytes()).hexdigest(),'generatorHash':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'fileHash':hashlib.sha256(file.read_bytes()).hexdigest(),'pages':1}
(ROOT/'cv/bar-bougie/pdf-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Bar Bougie PDF:',len(reader.pages),'page;',len(text),'searchable text characters')
