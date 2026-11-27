"""Generate Vercel CSP rules from the final, trusted HTML build. Never hash request data."""
import argparse
import base64
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

GROUPS = ('script', 'handler', 'style', 'attribute')


def digest(value):
    raw = hashlib.sha256(value.encode()).digest()
    return "'sha256-" + base64.b64encode(raw).decode() + "'"


def empty():
    return {group: set() for group in GROUPS}


def combine(*parts):
    return {group: set().union(*(part[group] for part in parts)) for group in GROUPS}


class Inline(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = empty()
        self.block = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        for name, value in attributes:
            if value and name == 'style':
                self.items['attribute'].add(digest(value))
            if value and re.fullmatch(r'on[a-z]+', name):
                self.items['handler'].add(digest(value))
        if tag == 'style' or (tag == 'script' and 'src' not in attrs and
                attrs.get('type', '').lower() in ('', 'module', 'importmap', 'application/javascript', 'text/javascript')):
            self.block = tag

    def handle_data(self, value):
        if self.block and value.strip():
            self.items[self.block].add(digest(value))

    def handle_endtag(self, tag):
        if self.block == tag:
            self.block = None


def inline(text):
    parser = Inline()
    parser.feed(text)
    parser.close()
    return parser.items


def policy(items, extras=None):
    values = {
        'default-src': ["'none'"], 'base-uri': ["'self'"], 'object-src': ["'none'"],
        'frame-ancestors': ["'self'"], 'form-action': ["'self'"],
        'script-src': ["'self'", "'wasm-unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://vercel.live', *sorted(items['script'])],
        'script-src-attr': ["'unsafe-hashes'", *sorted(items['handler'])] if items['handler'] else ["'none'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com', *sorted(items['style'])],
        'style-src-attr': ["'unsafe-hashes'", *sorted(items['attribute'])] if items['attribute'] else ["'none'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'], 'media-src': ["'self'", 'blob:'],
        'connect-src': ["'self'", 'https://ntfy.sh', 'https://vercel.live'],
        'worker-src': ["'self'", 'blob:'], 'frame-src': ["'self'", 'https://vercel.live'],
        'manifest-src': ["'self'"],
    }
    for directive, origins in (extras or {}).items():
        values[directive].extend(origins)
    result = '; '.join(key + ' ' + ' '.join(values[key]) for key in values)
    if len(result) > 4096:
        raise ValueError('CSP exceeds the Vercel header value limit')
    return result


def built_pages(root):
    for path, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {
            'node_modules', 'tools', 'tests', 'test-results', 'playwright-report', 'output'}]
        for name in files:
            if name.endswith('.html'):
                page = Path(path, name)
                yield '/' + page.relative_to(root).as_posix(), inline(page.read_text())


def generate(root, config):
    pages = dict(built_pages(root))
    common = empty()
    for key in GROUPS:
        counts = Counter(value for page in pages.values() for value in page[key])
        common[key] = {value for value, count in counts.items() if count >= 18}

    # WebKit applies this exact inline declaration to its native select control.
    common['attribute'].add(digest('text-overflow:inherit'))
    common['attribute'].add(digest('word-wrap: break-word; white-space: pre-wrap;'))
    common = combine(common, pages['/404.html'])
    # These styles are fixed source literals inserted by site-owned modules.
    def literals(file, pattern):
        return set(digest(value) for value in re.findall(pattern, (root / file).read_text(), re.S))

    common['style'] |= literals('js/site/feedback.js', r"st\.textContent\s*=\s*'([^'\n]+)'")
    cube = inline((root / 'the6cube-gate.js').read_text())
    for name in ('spread', 'polyglot', 'coffee'):
        cube['style'] |= literals('the6cube/' + name + '.js', r'const (?:CSS|RIT|css)\s*=\s*`([^`]+)`')
    stats = empty()
    stats['style'] |= literals('js/stats-map.js', r"style\.textContent\s*=\s*'([^'\n]+)'")
    ray = inline((root / 'app/raygifts/render.js').read_text())
    ray['style'] = {digest((root / 'app/raygifts/ray.css').read_text())}
    for page in ('/airbnb/index.html', '/airbnb-call-me-pls/index.html'):
        pages[page]['attribute'].add(digest('color:#1a1a1a;font-weight:600'))
    pages['/the6cube/stats/index.html']['attribute'].add(digest('text-align:left;white-space:normal'))
    for name in ('spread', 'polyglot', 'coffee'):
        source = (root / ('the6cube/' + name + '.js')).read_text()
        for value in re.findall(r'\bstyle="([^"]+)"', source):
            if '${' not in value:
                cube['attribute'].add(digest(value))
    for path, items in list(pages.items()):
        if path.startswith('/the6cube/'):
            pages[path] = combine(items, cube)
        elif path.startswith('/stats/'):
            pages[path] = combine(items, stats)

    routes = defaultdict(empty)
    def include(route, items):
        routes[route] = combine(routes[route], items)

    for path, items in pages.items():
        include(path, items)
        if path.endswith('/index.html'):
            include(path[:-10].rstrip('/') or '/', items)
        else:
            include(path[:-5], items)
    include('/', pages['/public/realm-entry.html'])
    include('/', pages['/stats/index.html'])
    include('/uptime', pages['/stats/status/index.html'])
    for rule in config['rewrites']:
        dest = rule['destination'].split('?')[0]
        if dest in pages:
            include(rule['source'].rstrip('/') or '/', pages[dest])
    for path, items in pages.items():
        if path.startswith('/public/worldcraft/'):
            include(path.removeprefix('/public')[:-5], items)
        if path.startswith('/stats/'):
            alias = path.removeprefix('/stats').removesuffix('index.html').rstrip('/') or '/'
            include(alias, items)
    for route in ('/raygifts', '/raygifts/:handle', '/api/raygifts'):
        include(route, ray)

    def header(source, value):
        return {'source': source, 'headers': [{'key': 'Content-Security-Policy', 'value': value}]}

    base = policy(common)
    result = [header('/(.*)', base)]
    # Literal rules win over the wildcard catch-all and parameterized rewrites.
    for route in sorted(routes, key=lambda r: (':' not in r, r)):
        try:
            extras = {}
            if route.startswith(('/the6cube/spread', '/the6cube/')):
                extras['connect-src'] = ['https://cdn.jsdelivr.net']
            if route in ('/hack/1/the-feed', '/hack/1/the-feed/index.html', '/hack/the-feed', '/hack/the-feed/index.html'):
                extras['frame-src'] = ['https://hackthefeed-six.vercel.app']
            if route in ('/compound', '/compound/index.html'):
                extras['media-src'] = ['https://r0nc5pohibox5fn2.public.blob.vercel-storage.com']
            value = policy(combine(common, routes[route]), extras)
        except ValueError as error:
            raise ValueError(route + ': ' + str(error)) from error
        if value != base:
            result.append(header(route, value))
            if route != "/" and not route.endswith((".html", "/", "*", "+")):
                result.append(header(route + "/", value))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--config', type=Path, default=Path('vercel.json'))
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    text = args.config.read_text()
    config = json.loads(text)
    generated = generate(args.root, config)
    current = [rule for rule in config['headers'] if any(h['key'] == 'Content-Security-Policy' for h in rule['headers'])]
    if args.write:
        # Keep unrelated routes in the repository's original formatting.
        lines = [line for line in text.splitlines(True) if not line.startswith('    {"source":') or '"Content-Security-Policy"' not in line]
        marker = '  "headers": [\n'
        text = ''.join(lines)
        generated_lines = ''.join('    ' + json.dumps(rule, separators=(',', ':')) + ',\n' for rule in generated)
        args.config.write_text(text.replace(marker, marker + generated_lines, 1))
    elif current != generated:
        raise SystemExit('CSP hashes changed. Run python3 tools/site/csp.py --write after npm run build.')
    print(str(len(generated)) + ' Vercel CSP rules checked')
