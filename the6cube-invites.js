import config from './vercel.json' with { type: 'json' };

const root = config.redirects.find(rule => rule.source === '/6').destination;
const channels = new Map([['/6l', 'li'], ['/6w', 'wc'], ['/6x', 'x'], ['/6t', 'tg'], ['/6i', 'ig']]);

export function channelInvite(url) {
  const channel = channels.get(url.pathname);
  if (!channel) return null;
  const target = new URL(root, 'https://corvus.gent');
  target.searchParams.set('utm_source', channel);
  if (target.origin !== 'https://corvus.gent') return null;
  return target.pathname + target.search;
}
