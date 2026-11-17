import importlib.util,json,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('linkedin',Path(__file__).resolve().parents[1]/'tools/import-linkedin.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp)/'daily.csv';p.write_text('Date,Impressions,Engagements\n11/15/2026,2,1\n11/16/2026,3,0\n')
 d=m.build(p,'2026-11-16');assert d['totals']['impressions']==5;assert d['totals']['newFollowers'] is None;assert d['source']['partialDate']=='2026-11-16'
 p.write_text('Date,Impressions,Engagements,New followers\n2026-11-15,2,1,0\n2026-11-16,3,0,1\n');d=m.build(p,'2026-11-17');assert d['source']['partialDate'] is None;assert d['totals']['newFollowers']==1
 for content in ['11/15/2026,2,1\n11/15/2026,3,0','11/15/2026,2,1\n11/17/2026,3,0','11/15/2026,-1,1']:
  p.write_text('Date,Impressions,Engagements\n'+content+'\n')
  try:m.build(p,'2026-11-17');raise AssertionError('Invalid import accepted')
  except ValueError:pass
print('PASS: CSV import, missing versus zero followers, partial date, duplicate/missing date and negative-count rejection')
