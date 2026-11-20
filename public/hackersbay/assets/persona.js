export const PERSONAS = {
  hacker: {
    title: 'Broke hacker', lens: 'Survival score', icon: '◈',
    description: 'Food, a place to crash, and prizes that actually pay out.',
    builds: 'Scrappy prototypes and useful open-source tools',
    wants: 'Free food, travel help, and a prize with a clear payout',
    offers: 'Fast prototyping and an extra pair of hands',
    seeks: ['logistics', 'prizes', 'travel', 'team'],
    brings: ['code', 'prototyping', 'opensource']
  },
  builder: {
    title: 'Busy builder', lens: 'Worth-it score', icon: '⌁',
    description: 'Co-founders, serious builders, and a good use of four hours.',
    builds: 'Products, working demos, and developer tools',
    wants: 'A co-founder, honest product feedback, and a real shot to win',
    offers: 'Backend engineering and a bias for shipping',
    seeks: ['cofounder', 'design', 'pilots', 'team'],
    brings: ['code', 'prototyping', 'devtools']
  },
  connector: {
    title: 'Power connector', lens: 'Crew finder', icon: '✳',
    description: 'Find builders worth introducing and make the ask one-to-one.',
    builds: 'Founder communities and curated introductions',
    wants: 'Top builders, warm intros, and a reason to reach out',
    offers: 'Introductions to founders, partners, and early users',
    seeks: ['builders', 'community', 'traction', 'team'],
    brings: ['intros', 'community', 'pilots']
  },
  investor: {
    title: 'Investor / brand', lens: 'Treasure report', icon: '◇',
    description: 'What’s shipping, who’s getting traction, and where to invest.',
    builds: 'Portfolio support and technical partnerships',
    wants: 'Early traction, live products, and sponsor fit',
    offers: 'Pilot budgets, distribution, and investor feedback',
    seeks: ['traction', 'devtools', 'pilots', 'privacy'],
    brings: ['funding', 'distribution', 'pilots']
  }
};

export const DEFAULT_DEMO_LENS = 'hacker';
export const EVENT_PATH = '/hackersbay/e/boat-hackathon-demo-day';
const STORAGE_KEY = 'hackersbay-persona-v1';

export function cleanText(value, max = 150) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function normalizeProfileUrl(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value || value.length > 320 || /\s/.test(value)) throw new Error('Enter one public profile or website link.');
  let url;
  try {
    url = new URL(/^[a-z][a-z+.-]*:\/\//i.test(value) ? value : 'https://' + value);
  } catch {
    throw new Error('Enter a valid public website link.');
  }
  const host = url.hostname;
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]+$/i.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|onion|home\.arpa)$/i.test(host)) {
    throw new Error('Use a public profile or website link.');
  }
  url.protocol = 'https:';
  url.search = '';
  url.hash = '';
  return url;
}

export function personaLabel(url) {
  const part = url.pathname.split('/').filter(Boolean).findLast(piece => !['in', 'company', 'users'].includes(piece));
  if (part) {
    try { return cleanText(decodeURIComponent(part), 48) || url.hostname; } catch { /* Use the hostname. */ }
  }
  return url.hostname.replace(/^www\./, '');
}

export function preset(type) {
  const persona = PERSONAS[type];
  if (!Object.hasOwn(PERSONAS, type)) return null;
  const { builds, wants, offers } = persona;
  return { type, name: persona.title, builds, wants, offers, source: 'preset' };
}

export function guessPersona(url, profileText = '', privateMode = false) {
  const name = personaLabel(url);
  const signal = [url.hostname, name, profileText].join(' ').toLowerCase();
  const type = /\b(angel investor|ventures?|investment|venture capital|investing|portfolio companies)\b/.test(signal) ? 'investor'
    : /\b(founder communit(?:y|ies)|community (?:building|organizer|organiser|lead|manager|operator)|meetup (?:host|organizer)|warm introductions|event organizer)\b/.test(signal) ? 'connector' : 'builder';
  const card = preset(type);
  if (/\b(open.source|github|repositories|developer tools)\b/.test(signal)) card.builds = 'Code, experiments, and open-source projects';
  if (/\b(design|ux|product designer)\b/.test(signal)) card.offers = 'Product design and clear feedback on demos';
  if (/\b(privacy|confidential)\b/.test(signal)) card.builds = 'Privacy-focused software and experiments';
  return { ...card, name, source: privateMode ? 'private-demo' : 'heuristic' };
}

export function normalizeCard(value) {
  if (!value || !Object.hasOwn(PERSONAS, value.type)) return null;
  const card = { type: value.type, name: cleanText(value.name, 48) };
  for (const field of ['builds', 'wants', 'offers']) card[field] = cleanText(value[field]);
  if (Object.values(card).some(value => !value)) return null;
  card.source = ['preset', 'heuristic', 'private-demo', 'llm', 'private'].includes(value.source) ? value.source : 'heuristic';
  if (value.reader === 'context') card.reader = 'context';
  return card;
}

let sessionCard;
export function getPersona() {
  try { return normalizeCard(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return sessionCard || null; }
}
export function savePersona(card) {
  const cleaned = normalizeCard(card);
  sessionCard = cleaned;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned)); } catch { /* Keep it in this page session. */ }
  return cleaned;
}
