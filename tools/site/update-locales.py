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
import unicodedata

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
    'js/site/legion.js', 'js/site/shell.js', 'js/tattoo.js',
    'js/stats.js', 'js/stats-army.js', 'js/stats-atlas.js', 'js/stats-countries.js',
    'js/stats-data.js', 'js/stats-games.js', 'js/stats-hunt.js', 'js/stats-map.js', 'js/stats-music.js',
    'js/stats-pidgy.js', 'js/stats-status.js', 'js/stats-support.js', 'js/stats-view.js',
    'js/status-graph.js', 'js/x-clocks.js', 'js/stats-x.js', 'stats/linkedin/charts.js',
    'public/worldcraft/chat.js', 'public/worldcraft/projector-qr.js',
)
PUBLIC_TEXT_LITERAL = re.compile(
    r'''(?:\.(?:textContent|alt|placeholder|title)\s*=(?!=)|'''
    r'''\b(?:status|formatPageText|translatePageText|feedback)\(|setAttribute\(['"]aria-label['"],)\s*'''
    r'''('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")'''
)
PLACEHOLDER = re.compile(r'\{\w+\}')
NUMBER_MARKER = re.compile(r'(?<!\d)\d{3}(?!\d)')
MARKERS = ('123', '456', '789', '321', '654', '987')


def mask_placeholders(source):
    tokens = PLACEHOLDER.findall(source)
    markers = [marker for marker in MARKERS if marker not in source]
    if len(tokens) > len(markers):
        return source, {}
    replacements = {}
    def mask(match):
        number = markers[len(replacements)]
        replacements[number] = match.group()
        return number
    return PLACEHOLDER.sub(mask, source), replacements


def restore_placeholders(value, replacements):
    if not replacements:
        return value
    # Some translations use their own decimal digits.
    def restore(match):
        digits = ''.join(str(unicodedata.decimal(c)) for c in match.group() if c.isdecimal())
        return replacements.get(digits, match.group())
    return NUMBER_MARKER.sub(restore, value)


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
        'preparing the first snapshot…', 'snapshot unavailable.', 'counting the arrivals…',
        'the count is resting. try again shortly.', 'visitor count unavailable.',
        'visitor today. just the one, so far.', 'day one. the crow came back.',
        'counts unavailable.', 'most loved', 'new suggestions', 'plays per genre',
        'type', 'played', 'solved', 'terminal activity', 'terminal counts unavailable.',
        'nobody opened the terminal.', 'command-line counts unavailable.',
        'outbound counts unavailable.', 'country counts unavailable.',
        'partial snapshot', 'last saved snapshot', 'loading statistics', 'service status →',
        'stats storage (redis) is unavailable.', 'a stats data source failed to respond.',
        'showing the available figures.', 'preparing the figures…', 'loading stats…',
        'the stats API is unavailable.', 'try again',
        'support counts arrive with the next snapshot.', 'link / action', 'this day',
        'show less', 'show all', 'quick', 'capitals', 'unknown location', '30-day uptime',
        'the lantern is burning.', 'the lantern flickers.', 'the lantern is out.',
        'waiting for the first light.', 'no checks recorded yet.', 'no recorded incidents.',
        'no incident data yet.', 'history storage (redis) is unavailable.',
        'history api unavailable · showing the last reading.',
        'history api unavailable · could not load measurements.', 'overall',
        'site pages', 'vanity slugs', 'stats pages', 'redis', 'posthog', 'resend',
        'notion', 'buy me a coffee', 'map tiles', 'spotify', 'stats snapshots',
        'snapshot job', 'no data', 'healthy', 'degraded / slow', 'down', 'slow',
        'last observed', 'resolved', 'ongoing at last check', 'city unknown',
        'no data yet', 'all time', '{count} soul', '{count} souls',
        '{count} visitor', '{count} visitors', '{count} countries · {period} · city areas + country totals.',
        '{count} country · {period} · city areas + country totals.',
        '{service} went down on {time} · {duration} · {state}.',
        '{service} was slow on {time} · {duration} · {state}.', '{date} · Brussels time',
        'cookieless visitor counts are estimates. clicks are counted from the tracking launch.',
        'cookieless counts are estimates. signup attribution is first-touch; these are separate aggregate counts, not tracked individual journeys.',
        'one feather = 10 clicks · display capped at 20 feathers',
        'counted visits', 'app opens', 'feedback', 'github clicks', 'likes', 'dislikes',
        'comments', 'shares', 'by source', 'squad link clicks', 'Gabe · solo run',
        '{source}: {count}', 'Stats unavailable. Please try again shortly.',
        'Impressions', 'Engagements', 'New followers', 'Profile viewers', 'Weekly profile viewers',
        'daily chart', 'cumulative chart', 'Metric', 'Period', 'View',
        'Full export', 'Last 28 complete days', 'Last 7 complete days', 'Cumulative', 'Daily',
        'Not included in this export.', 'Not available', 'Stats unavailable',
        'Stats unavailable. Please try again later.',
        'Manually transcribed LinkedIn weekly snapshot. The content export has no daily profile-view history; unreported weeks are not plotted.',
        'replies, posts, and where the links lead.', 'the log is empty for now',
        'the log is resting. try again soon.', 'the crow is syncing the log. check back in a moment.',
        'the log is resting.', 'per voice', 'no voices logged yet.',
        'best voice this week: waiting for a click.', 'two shores · audiences',
        'eu is the european audience; sf is the san francisco audience. the clocks above help you think in both.',
        'per hour · bx / brussels', 'clicks by logged hour, 00 to 23, Europe/Brussels',
        'hourly numbers', 'all hours use bx time, for both audiences. attributed to the logged hour, not the time a visitor clicked.',
        'top campaigns', 'no campaign clicks yet.', 'from gabe', 'read the post ↗', 'no own posts logged yet.',
        'replies', 'posts', 'links used', 'clicks to corvus', 'clicks to pidgy', 'clicks / links',
        'today · brussels', 'voice', 'clicks', 'region', 'links', 'hour', 'campaign', 'eu · europe', 'sf · san francisco',
        'one crow. two clocks.', 'live now', 'plan across the pond ↔', 'bx · brussels', 'sf · san francisco',
        'first occurrence', 'second occurrence', 'clock change', 'think in', 'date', 'time',
        'back to now', 'csv date + hour stay on bx time. eu / sf chooses the audience, not the clock.',
        'your planned moment', 'same date', 'previous day in sf', 'choose a valid moment',
        'that local time does not exist. check the date or choose another time around the clock change.',
        'choose a date and time.', 'that hour happens twice when the clocks go back. choose which occurrence.',
        'night owl', 'first coffee', 'in the thick of it', 'after hours',
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
        masked, replacements = zip(*(mask_placeholders(source) for source in batch))
        encoded = [['__en__', *tokens, '</s>'] for tokens in tokenizer.encode(list(masked), out_type=str)]
        results = translator.translate_batch(
            encoded, target_prefix=[[prefix]] * len(batch), beam_size=1,
            max_batch_size=1024, batch_type='tokens', no_repeat_ngram_size=4,
            max_decoding_length=max(32, 2 * max(map(len, encoded)) + 16),
        )
        for source, result, mapping in zip(batch, results, replacements):
            tokens = result.hypotheses[0]
            if tokens and tokens[0] == prefix:
                tokens = tokens[1:]
            value = restore_placeholders(tokenizer.decode(tokens).strip(), mapping)
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
