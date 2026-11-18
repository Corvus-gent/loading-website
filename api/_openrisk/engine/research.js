import { coverageNews, engineering, identify, signal } from './enrich.js';
import { score } from './score.js';

async function observe(key, lookup, emit) {
  let value = null;
  try { value = await lookup(); } catch {}
  emit({ key, value, status:value ? 'observed' : 'unavailable' });
  return value;
}

export async function research(name, emit) {
  const [[identity, github]] = await Promise.all([
    (async () => {
      const id = await observe('identity', () => identify(name), emit);
      const gh = await observe('engineering', () => id?.value.github ? engineering(id.value.github,2500) : null, emit);
      return [id,gh];
    })(),
    observe('news', () => coverageNews(name), emit),
  ]);
  const signals = {};
  if (identity?.value.founded) {
    signals.founded = signal(identity.value.founded,identity.source,'scraped','medium',identity.fetchedAt);
  }
  if (github) signals.github = github;
  emit({ key:'score', value:score(signals) });
}

const cache = new Map();
const retention = 15 * 60 * 1000;

export function subscribeResearch(name, emit) {
  const key = name.toLowerCase();
  let entry = cache.get(key);
  if (!entry || entry.expires<=Date.now()) {
    if (cache.size>=300) cache.delete(cache.keys().next().value);
    entry = { events:[], listeners:new Set(), expires:Date.now()+retention };
    cache.set(key,entry);
    entry.ready = research(name,event=>{
      entry.events.push(event);
      for (const listener of entry.listeners) listener(event);
    });
  }
  for (const event of entry.events) emit(event);
  entry.listeners.add(emit);
  return { done:entry.ready, unsubscribe:()=>entry.listeners.delete(emit) };
}
