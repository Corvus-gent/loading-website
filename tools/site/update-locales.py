"""Refresh bundled machine translations for tracked, published page copy.

Run from the repository root with beautifulsoup4, ctranslate2, sentencepiece
and Node. Pass a local CTranslate2 M2M-100 model directory, such as
https://huggingface.co/gn64/M2M100_418M_CTranslate2. The build reads the
checked-in catalogs. Existing entries are kept for editing.
"""

from argparse import ArgumentParser
import ast
import json
from pathlib import Path
import re
import subprocess
from tempfile import NamedTemporaryFile

from bs4 import BeautifulSoup, Comment
import ctranslate2
import sentencepiece


LANGUAGES = ('nl', 'es', 'fr', 'pt', 'de', 'zh', 'hi', 'ta')
ATTRIBUTES = ('alt', 'aria-label', 'title', 'placeholder', 'label')
SKIP = ('script, style, code, pre, kbd, samp, svg, noscript, '
        '[contenteditable], [translate="no"], [data-i18n], #lang-switcher')
ADDITIONAL_PAGES = (
    'army', 'bjj/gabe', 'compound/v2/links', 'curiositycraft', 'curiositycraft/play',
    'curiositycraft/qr', 'cv', 'cv/tech', 'cv/social-media', 'curiosity', 'forms',
    'hack/2', 'hack/4', 'hack/the-feed', 'join-the-army-now', 'legion/join',
    'letters/confirm', 'letters/unsubscribe', 'sf/larp', 'stats/linkedin', 'tattoo',
    'whoami', 'worldcraft', 'worldcraft/qr',
)
PUBLIC_VIEW_SCRIPTS = (
    'js/forms-view.js', 'js/forms-draft.js', 'js/games.js', 'js/live-banner.js',
    'js/live-stream.js', 'js/people.js', 'js/sf.js', 'js/site/daily.js',
    'js/site/legion.js', 'js/site/shell.js', 'js/stats-view.js', 'js/tattoo.js',
    'public/worldcraft/chat.js', 'public/worldcraft/projector-qr.js',
)
PUBLIC_TEXT_LITERAL = re.compile(
    r'''(?:\.(?:textContent|alt|placeholder|title)\s*=(?!=)|'''
    r'''\b(?:status|formatPageText)\(|setAttribute\(['"]aria-label['"],)\s*'''
    r'''('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")'''
)
PLACEHOLDER = re.compile(r'\{\w+\}')


def normalize(text):
    return re.sub(r'\s+', ' ', str(text)).strip()


def eligible(text):
    return (
        bool(re.search(r'[A-Za-z]{2}', text))
        and len(text) <= 3400
        and not re.match(
            r'^(https?://|[\w.+-]+@[\w.-]+\.|[\w-]+\.(?:js|css|json|png|jpg|gent)$)',
            text,
        )
    )


def public_files(routes):
    tracked = set(subprocess.check_output(
        ['git', 'ls-files', '*.html'], text=True
    ).splitlines())
    files = {route.get('file') for route in routes}
    files.update(f'{route}/index.html' for route in ADDITIONAL_PAGES)
    files.update(['index.html', '404.html', 'public/realm-entry.html'])
    files.update(path for path in tracked if re.match(
        r'^cv/(?:studies|work)/[^/]+/index\.html$', path
    ))
    return sorted(files & tracked)


def page_strings(file):
    soup = BeautifulSoup(Path(file).read_text(), 'html.parser')
    if soup.html and soup.html.get('lang', 'en').split('-')[0] != 'en':
        return set()
    if soup.find('meta', attrs={'http-equiv': re.compile('refresh', re.I)}):
        return set()
    for node in soup.select(SKIP):
        if node.parent:
            node.decompose()

    strings = []
    foreign_language = {'lang': re.compile(r'^(?!en(?:-|$))')}
    for node in soup.find_all(string=True):
        if isinstance(node, Comment) or node.parent.name in ('[document]', 'head'):
            continue
        if not node.find_parent(attrs=foreign_language):
            strings.append(node)
    strings.extend(
        node[attr] for node in soup.find_all(True) for attr in ATTRIBUTES
        if isinstance(node.get(attr), str)
    )
    strings.extend(node.get('content', '') for node in soup.select('meta[name="description"]'))
    return {text for text in map(normalize, strings) if eligible(text)}


def generated_strings(routes):
    brief_source = '''
        import {BRIEF_COPY, INSPIRATIONS, STORIES} from './js/inspiration-data.js';
        console.log(JSON.stringify([
          ...Object.values(BRIEF_COPY).flat(),
          ...[...INSPIRATIONS, ...STORIES].flatMap(item =>
            ['name', 'tag', 'alt', 'line', 'lore', 'detail', 'credit'].map(key => item[key]).filter(Boolean))
        ]));
    '''
    strings = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', brief_source]))
    tattoo_js = Path('js/tattoo.js').read_text()
    strings.extend(re.findall(r"(?:textContent=|selected.size\?'':)'([^']+)'", tattoo_js))
    for file in PUBLIC_VIEW_SCRIPTS:
        strings.extend(ast.literal_eval(value) for value in PUBLIC_TEXT_LITERAL.findall(Path(file).read_text()))
    chat = Path('public/worldcraft/chat.js').read_text()
    features = re.search(r'\bfeatures=(\[[^\n]+\]);', chat)
    if features:
        for _, icon, title, description in ast.literal_eval(features[1]):
            strings.extend([title, description, f'{icon} {title}'])
    for button in BeautifulSoup(Path('curiositycraft/index.html').read_text(), 'html.parser').select('[data-starter]'):
        strings.append(button['data-starter'])
    strings.extend([
        '· license', '💬 add a comment', 'All done — thank you! 🙌',
        'Still sending…', 'Thanks, sent!', 'Total play time: {time}', 'Avg per player: {time}', 'Jump to a page', 'where do you want to go?', 'Find a page',
        'Close search', '/ to open · esc to leave · enter to go', 'Language',
    ])
    for route in routes:
        strings.extend(route.get(key, '') for key in ('title', 'description', 'status'))
    for path in Path('forms').glob('*.ts'):
        config = re.search(r'export default\s+([\s\S]+)\s+satisfies FeedbackForm;', path.read_text())
        if not config:
            continue
        form = json.loads(config[1])
        strings.extend([form['title'], form['subtitle']])
        strings.extend(BeautifulSoup(form.get('introHtml', ''), 'html.parser').strings)
        strings.extend(section['title'] for section in form['sections'])
        for question in form['questions']:
            strings.extend(question[key] for key in ('label', 'placeholder') if key in question)
            if question['type'] == 'thumbs':
                strings.extend(prefix + question['label'] for prefix in (
                    'Thumbs up: ', 'Thumbs down: ', 'Optional comment: ',
                ))
    return {text for text in map(normalize, filter(None, strings)) if eligible(text)}


def translate_missing(translator, tokenizer, catalog, strings, language):
    missing = sorted(strings - catalog.keys(), key=len)
    prefix = f'__{language}__'
    for start in range(0, len(missing), 64):
        batch = missing[start:start + 64]
        encoded = [['__en__', *tokens, '</s>'] for tokens in tokenizer.encode(batch, out_type=str)]
        results = translator.translate_batch(
            encoded, target_prefix=[[prefix]] * len(batch), beam_size=1,
            max_batch_size=1024, batch_type='tokens', no_repeat_ngram_size=4,
            max_decoding_length=max(32, 2 * max(map(len, encoded)) + 16),
        )
        for source, result in zip(batch, results):
            tokens = result.hypotheses[0]
            if tokens and tokens[0] == prefix:
                tokens = tokens[1:]
            value = tokenizer.decode(tokens).strip()
            if value and sorted(PLACEHOLDER.findall(source)) == sorted(PLACEHOLDER.findall(value)):
                catalog[source] = value


def write_catalog(path, copy, **options):
    with NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as output:
        json.dump(copy, output, ensure_ascii=False, **options)
        output.write('\n')
    Path(output.name).replace(path)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('model_dir', type=Path)
    parser.add_argument('--language', action='append', choices=LANGUAGES)
    parser.add_argument('--device', choices=('cpu', 'mps'), default='cpu')
    args = parser.parse_args()
    model_dir = args.model_dir
    translator = ctranslate2.Translator(
        str(model_dir), device=args.device,
        compute_type='float16' if args.device == 'mps' else 'int8', intra_threads=6,
    )
    tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(model_dir / 'sentencepiece.bpe.model'))
    directory = json.loads(Path('site-directory.json').read_text())
    routes = [route for route in directory['routes'] if route.get('public') is not False]
    files = public_files(routes)
    strings = generated_strings(routes).union(*(page_strings(file) for file in files))
    out = Path('public/i18n')
    out.mkdir(exist_ok=True)
    paths = {code: out / f'site.{code}.json' for code in args.language or LANGUAGES}
    catalogs = {
        code: json.loads(path.read_text()) if path.exists() else {}
        for code, path in paths.items()
    }
    worldcraft = Path('public/worldcraft/locales')
    worldcraft_source = json.loads((worldcraft / 'en.json').read_text())
    worldcraft_path = worldcraft / 'de.json'
    worldcraft_copy = json.loads(worldcraft_path.read_text()) if worldcraft_path.exists() else {}
    print(f'{len(files)} pages, {len(strings)} strings', flush=True)
    for code, catalog in catalogs.items():
        if code == 'de':
            worldcraft_text = {normalize(text) for text in worldcraft_source.values() if eligible(normalize(text))}
            worldcraft_catalog = {normalize(worldcraft_source[key]): value for key, value in worldcraft_copy.items() if key in worldcraft_source}
            worldcraft_catalog = catalog | worldcraft_catalog
            translate_missing(translator, tokenizer, worldcraft_catalog, worldcraft_text, code)
            worldcraft_copy = {
                key: worldcraft_catalog.get(normalize(source), source)
                for key, source in worldcraft_source.items()
            }
            write_catalog(worldcraft_path, worldcraft_copy, indent=2)
        translate_missing(translator, tokenizer, catalog, strings, code)
        write_catalog(paths[code], catalog, sort_keys=True, indent=1)
        missing = strings - catalog.keys()
        print(f'{code}: {len(strings) - len(missing)}/{len(strings)} entries', flush=True)
        for text in sorted(missing):
            print('  missing:', text)


if __name__ == '__main__':
    main()
