"""Refresh dated public GitHub evidence from full local clones. No third-party dependencies.
Usage: python3 tools/cv/github-activity.py --repos-dir /path/to/clones --loading-repo /path/to/loading-website
Clone directory names: owner--repository. Only repositories already listed in the evidence snapshot are read.
Fetch the clones' default branches before refreshing; private repositories must never be added.
"""
import argparse, collections, datetime, json, pathlib, re, subprocess
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repos-dir',type=pathlib.Path,required=True)
parser.add_argument('--loading-repo',type=pathlib.Path,default=pathlib.Path.cwd())
parser.add_argument('--pinned',action='store_true',help='Reproduce the committed snapshot using its exact refs and cutoff')
args=parser.parse_args()
output=pathlib.Path('cv/github-activity.json');previous=json.loads(output.read_text())
cutoff=previous['asOf'] if args.pinned else datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
month=cutoff[:7]
emails={'vanlangenhovefga@gmail.com','gabriel@corvus.gent','91496499+gabriellvl@users.noreply.github.com'}
extensions={'.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.java','.c','.cpp','.h','.hpp','.rs','.go','.vue','.svelte','.css','.scss','.sql','.sh','.bash','.r','.R','.swift'}
exclude=re.compile(r'(^|/)(node_modules|vendor|dist|build|output|public/i18n|test-results|\.next)(/|$)|\.min\.|\.generated\.|(^|/)generated\.[mc]?js$|(^|/)package-lock|(^|/)yarn.lock')
repositories=[];totals=collections.defaultdict(collections.Counter)
for item in previous['repositories']:
 repo=item['repo'];directory=args.repos_dir/repo.replace('/','--');ref='HEAD'
 if repo=='Corvus-gent/loading-website':directory=args.loading_repo;ref='origin/main'
 if args.pinned:ref=item['ref']
 def git(*parts):return subprocess.check_output(['git','-C',str(directory),*parts],text=True)
 revision=git('rev-parse',ref).strip()
 raw=git('log',ref,'--no-merges','--since=2021-01-01','--until='+cutoff,'--format=COMMIT%x09%H%x09%cI%x09%ae','--author=vanlangenhovefga@gmail.com\\|gabriel@corvus.gent\\|91496499+Gabriellvl@users.noreply.github.com','--numstat','--no-renames','--',*sorted(':(glob)**/*'+ext for ext in extensions))
 periods={};active=None
 for line in raw.splitlines():
  if line.startswith('COMMIT\t'):
   _,sha,date,email=line.split('\t');active=None
   if email.lower() not in emails:continue
   period=date[:7] if date.startswith(month) else date[:4]
   active=periods.setdefault(period,dict(commits=0,added=0,deleted=0,sourceAdded=0,sourceDeleted=0));active['commits']+=1
  elif active and re.match(r'^\d+\t\d+\t',line):
   added,deleted,file=line.split('\t',2);added,deleted=int(added),int(deleted)
   active['added']+=added;active['deleted']+=deleted
   if not exclude.search(file):active['sourceAdded']+=added;active['sourceDeleted']+=deleted
 for period,counts in periods.items():totals[period].update(counts)
 repositories.append(dict(repo=repo,ref=revision,periods=periods))
result={**previous,'asOf':cutoff,'periods':dict(totals),'repositories':repositories}
if args.pinned:
 if result!=previous:raise SystemExit('Snapshot does not reproduce. Investigate before publishing.')
 print('GitHub evidence reproduces from all pinned public refs.')
else:
 output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('Refreshed GitHub evidence as of '+cutoff)
