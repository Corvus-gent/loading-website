import {sourceCategory} from './analytics-policy.js';
import {campaignSlug, contentSlot} from './x-attribution.js';

const platforms = {li:'linkedin',ig:'instagram',tt:'tiktok',dc:'discord',bmc:'buymeacoffee',yt:'youtube',fb:'facebook'};
export function linkContext(pathname, search) {
  const [, section, ...parts] = pathname.replace(/\/+$/, '').split('/');
  if (section !== 'links') return null;
  const person = ['gabe', 'corvus', 'pidgy'].includes(parts[0]) ? parts.shift() : 'gabe';
  const query = new URLSearchParams(search);
  const platform = parts[0] || query.get('utm_source') || 'direct';
  const source = sourceCategory(Object.hasOwn(platforms, platform) ? platforms[platform] : platform);
  const slug = campaignSlug(parts[1] || 'bio') || 'other';
  const slot = source === 'x' && contentSlot(query.get('utm_content'));
  return {links_person:person, links_source:source, links_campaign:slug, ...(slot ? {utm_content:slot} : {})};
}
