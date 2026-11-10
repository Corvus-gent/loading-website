import importlib.util,unittest,copy
from pathlib import Path
spec=importlib.util.spec_from_file_location('builder',Path(__file__).resolve().parents[1]/'scripts/build-dontpay.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class SeriesBuild(unittest.TestCase):
 def setUp(self):
  self.config={'hours':{'hackathons':None,'streams':None,'videos':None,'note':'Manual log'},'episodes':[]}
  self.ep={'slug':'a-real-visit','published':True,'title':'<script>alert(1)</script>','shop':'A & B','neighborhood':'SF','deal':'Agreed meal','language':'Turkish','shopURL':'https://example.com/','videoURL':'https://www.youtube.com/watch?v=abcdefghijk','foodScore':7.5,'dealAgreed':True}
 def test_honest_empty_state(self):
  s=b.overview(b.validate(self.config));self.assertIn('Episode 1 coming soon',s);self.assertIn('not zero',s);self.assertNotIn('0 hours logged',s)
 def test_invalid_publication(self):
  for patch in [{'slug':'../../escape'},{'foodScore':11},{'dealAgreed':'yes'},{'shopURL':'javascript:alert(1)'},{'videoURL':'https://name:secret@example.com/'},{'language':''}]:
   c=copy.deepcopy(self.config);c['episodes']=[self.ep|patch]
   with self.assertRaises(ValueError):b.validate(c)
 def test_safe_content_and_lazy_video(self):
  c=copy.deepcopy(self.config);c['episodes']=[self.ep];b.validate(c);s=b.episode(self.ep,self.ep|{'slug':'next-visit'})
  self.assertIn('&lt;script&gt;',s);self.assertNotIn('<script>alert(1)',s);self.assertIn('youtube-nocookie.com/embed/abcdefghijk',s);self.assertNotIn('<iframe',s);self.assertIn('/dontpay/next-visit/',s)
 def test_hours(self):
  for value in [-1,True,float('nan')]:
   c=copy.deepcopy(self.config);c['hours']['streams']=value
   with self.assertRaises(ValueError):b.validate(c)
  self.config['hours'].update(hackathons=4,streams=2,videos=1.5);self.assertIn('7.5 hours logged',b.counters(self.config))
 def test_draft_not_published(self):
  self.config['episodes']=[self.ep|{'published':False}];self.assertNotIn('/dontpay/a-real-visit/',b.overview(self.config));self.assertIn('noindex,follow',b.episode(None))
if __name__=='__main__':unittest.main()
