#!/usr/bin/env python3
"""Import LinkedIn's aggregate XLSX or daily content CSV without publishing the original file.
Usage: python3 tools/import-linkedin.py export.xlsx --imported-on YYYY-MM-DD
CSV requires Date, Impressions, Engagements (optional New followers). Existing
profile-view snapshots are preserved separately because they are not in this export.
"""
import argparse, csv, datetime as dt, hashlib, json, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def workbook(path):
    with zipfile.ZipFile(path) as z:
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            strings=[''.join(t.text or '' for t in si.findall('.//m:t',NS)) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rels={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets={}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',NS):
            target=rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
            rows=[]
            for row in ET.fromstring(z.read(target)).findall('m:sheetData/m:row',NS):
                values={}
                for cell in row.findall('m:c',NS):
                    v=cell.find('m:v',NS);text=v.text if v is not None else ''.join(t.text or '' for t in cell.findall('.//m:t',NS))
                    if cell.get('t')=='s':text=strings[int(text)]
                    values[re.sub(r'\d','',cell.get('r'))]=text
                rows.append(values)
            sheets[sheet.get('name')]=rows
        return sheets

def date(raw):
    for fmt in ('%m/%d/%Y','%Y-%m-%d'):
        try:return dt.datetime.strptime(raw,fmt).date().isoformat()
        except ValueError:pass
    raise ValueError('Unsupported date: '+raw)

def count(raw):
    n=int(str(raw).replace(',',''))
    if n<0:raise ValueError('Negative count')
    return n

def build(path, imported):
    if path.suffix.lower()=='.xlsx':
        sheets=workbook(path)
        daily=[{'date':date(r['A']),'impressions':count(r['B']),'engagements':count(r['C']),'newFollowers':None} for r in sheets['ENGAGEMENT'][1:]]
        followers={date(r['A']):count(r['B']) for r in sheets.get('FOLLOWERS',[])[3:] if r.get('A')}
        for r in daily:r['newFollowers']=followers.get(r['date'])
        discovery={r.get('A'):r.get('B') for r in sheets.get('DISCOVERY',[])}
        total_impressions=count(discovery['Impressions']) if 'Impressions' in discovery else None
        reached=count(discovery['Members reached']) if 'Members reached' in discovery else None
        total_followers=count(sheets['FOLLOWERS'][0]['B']) if sheets.get('FOLLOWERS') else None
    elif path.suffix.lower()=='.csv':
        with path.open(encoding='utf-8-sig',newline='') as f:
            daily=[{'date':date(r['Date']),'impressions':count(r['Impressions']),'engagements':count(r['Engagements']),'newFollowers':count(r['New followers']) if r.get('New followers') else None} for r in csv.DictReader(f)]
        total_impressions=reached=total_followers=None
    else:raise ValueError('Use .xlsx or .csv')
    daily.sort(key=lambda r:r['date'])
    if not daily:raise ValueError('Empty export')
    if len(set(r['date'] for r in daily))!=len(daily):raise ValueError('Duplicate dates')
    if any((dt.date.fromisoformat(b['date'])-dt.date.fromisoformat(a['date'])).days!=1 for a,b in zip(daily,daily[1:])):raise ValueError('Missing dates: supply a continuous daily export')
    impressions=sum(r['impressions'] for r in daily)
    if total_impressions is not None and impressions!=total_impressions:raise ValueError('Daily impressions do not reconcile to DISCOVERY total')
    return {'schemaVersion':1,'source':{'platform':'LinkedIn','type':'aggregate export','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'importedOn':imported,'start':daily[0]['date'],'end':daily[-1]['date'],'timezone':'UTC','partialDate':daily[-1]['date'] if daily[-1]['date']>=imported else None},'totals':{'impressions':impressions,'engagements':sum(r['engagements'] for r in daily),'membersReached':reached,'followers':total_followers,'newFollowers':sum(r['newFollowers'] for r in daily) if all(r['newFollowers'] is not None for r in daily) else None},'daily':daily}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input',type=Path);parser.add_argument('--imported-on',required=True);parser.add_argument('--output',type=Path,default=Path('stats/linkedin/data.json'));args=parser.parse_args()
    dt.date.fromisoformat(args.imported_on)
    result=build(args.input,args.imported_on);args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'days':len(result['daily']),'totals':result['totals'],'period':[result['source']['start'],result['source']['end']]}))
