#!/usr/bin/env python3
"""Version local HTML script/style entrypoints. Re-run after asset edits."""
from pathlib import Path
import re,hashlib
for p in Path('.').rglob('*.html'):
 if any(x in p.parts for x in ['node_modules','test-results','playwright-report','.git','qa']):continue
 def version(m):
  path=m[2];f=Path(path.lstrip('/'))
  if not f.is_file():return m[0]
  return m[1]+path+'?v='+hashlib.sha256(f.read_bytes()).hexdigest()[:12]+m[3]
 s=p.read_text();s=re.sub(r'((?:src|href)=")(/[^"?]+\.(?:js|css))(?:\?v=[a-f0-9]+)?(")',version,s);p.write_text(s)
