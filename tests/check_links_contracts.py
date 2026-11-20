"""The link audit must honor actual constrained Vercel routes, not invent wildcards."""
import re, runpy
module=runpy.run_path('tools/check-links.py',run_name='link_checker')
pattern=module['route_pattern']
assert re.fullmatch(pattern('/worldcraft/:demo(a|b).html'),'/worldcraft/a.html')
assert not re.fullmatch(pattern('/worldcraft/:demo(a|b).html'),'/worldcraft/c.html')
assert not re.fullmatch(pattern('/worldcraft/:demo(a|b).html'),'/worldcraft/aXhtml')
assert re.fullmatch(pattern('/compound/v2/:lang(en|nl)/:hook(a|b)/:n([1-9][0-9]{0,3})'),'/compound/v2/en/a/12')
assert not re.fullmatch(pattern('/forms/:slug([a-z0-9-]+)'),'/forms/INVALID')
assert re.fullmatch(pattern('/public/:path*'),'/public/a/b/file.txt')
for name in ['teach-the-village','bloom-quest','leaf-commander','storyrealm','fraction-kingdom','space-station','reef-rescue','boss-battle','teach-the-robot','memory-palace']:
 assert module['route_exists']('/worldcraft/'+name)
 assert module['route_exists']('/worldcraft/'+name+'.html')
assert not module['route_exists']('/worldcraft/not-a-real-world')
print('PASS: constrained route parameters, literal extensions, multi-parameter routes and real Worldcraft links.')
