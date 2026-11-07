import {approvedCampaign,contentSlot} from './x-attribution.js';
// Shared by browser capture and public stats: never publish free-form labels.
export const SOURCES = ['direct','corvus','linkedin','instagram','tiktok','facebook','youtube','threads','discord','x','luma','whatsapp','email','qr','buymeacoffee','share','self','google','bing','duckduckgo','other'];
export const CAMPAIGNS = ['compound-1000','hack','bio','coffee-stats','coffee-bio','corvus_softlaunch','gabe-coffee-bio','gabe-important-call','gabe-corvus-page','gabe-corvus-revival','gabe-sf-trip','hackathon-thread','gabe-hackathon-thread','402','402-post','gabe','gabe-bio','gabe-402','gabe-402-post','gabe-self','gabe-coffee-bio','site','game-babel','game-borders','game-wordle','game-flags','game-combo','game-bangle','game-pingle','game-lantern','other'];
export const COMMANDS = ['help','whoami','now','sidequests','support','cv','contact','ls','location','diogenes','lantern','pay','pidgy','coo','headache','sudo','exit','clear','cd','lang','unknown'];
export const GAME_TYPES = ['babel','borders','wordle','flags','combo','bangle','pingle','lantern'];
export const GENRES = ['us hip-hop','rap fr','rap nl/be','latin','lusophone','afro','pop 00s','electronic','rock','classics','soundtrack','funk & phonk'];
export const BROWSERS = ['Chrome','Chrome iOS','Safari','Mobile Safari','Firefox','Microsoft Edge','Edge','Opera','Samsung Internet','Internet Explorer','Android Mobile','Other'];
const HOSTS = ['corvus.gent','www.corvus.gent','stats.corvus.gent'];
const EXTERNAL = ['hackthefeed-six.vercel.app','the-feed.corvus.gent','pidgy-ai.com','app.pidgy-ai.com','buymeacoffee.com','www.buymeacoffee.com','open.spotify.com','music.apple.com','bandcamp.com','soundcloud.com','musicbrainz.org','www.linkedin.com','linkedin.com','instagram.com','www.instagram.com','www.tiktok.com','www.facebook.com','www.youtube.com','threads.net','www.threads.net','x.com','luma.com','alkmist.com','posthog.com','github.com'];
const ROUTES = new Set(['/hackathons/','/hack/','/hack/the-feed/','/stats/hack/','/', '/realm/', '/sf/', '/gabe/', '/people/', '/now/', '/sidequests/', '/support/', '/support/books/', '/support/companies/', '/support/people/', '/support/founders/', '/support/sport-people/', '/support/philosophists/', '/languages/', '/402/', '/call/', '/music/', '/games/', '/wiki/', '/wiki/corvus/', '/wiki/pidgy/', '/privacy/', '/cv/', '/pidgy/', '/map/', '/hunt/', '/stats/', '/stats/pidgy/', '/stats/games/', '/stats/map/', '/stats/music/', '/stats/hunt/', '/x/', '/stats/x/', '/coffee/', '/stats/coffee/', '/army/', '/stats/army/', '/status/', '/stats/status/', '/coffee-with-gabe/']);
export const category = (value, allowed, fallback = 'other') => allowed.includes(value) ? value : fallback;
export const sourceCategory = value => category(value, SOURCES);
export const campaignCategory = value => {
  if (typeof value === 'string' && /^(corvus|pidgy)-(bio|402|402-post)$/.test(value)) return value;
  return category(value, CAMPAIGNS);
};
export function referrerCategory(value) {
  if (!value || value==='$direct') return 'direct';
  const host=String(value).toLowerCase();
  if (host==='lnkd.in') return 'linkedin';
  if (host==='t.co') return 'x';
  for (const [domain,source] of [['instagram.com','instagram'],['linkedin.com','linkedin'],['tiktok.com','tiktok'],['facebook.com','facebook'],['discord.com','discord'],['twitter.com','x'],['x.com','x'],['google.com','google'],['bing.com','bing'],['duckduckgo.com','duckduckgo'],['buymeacoffee.com','buymeacoffee'],['corvus.gent','corvus']]) {
    if (host===domain || host.endsWith('.'+domain)) return source;
  }
  return sourceCategory(host);
}
export function pathCategory(path) {
  if (typeof path !== 'string') return '/other/';
  path = path.split(/[?#]/)[0].replace(/\/+$/, '') + '/';
  if (/^\/hack\/[1-9]\d{0,3}\/(?:the-feed\/)?$/.test(path)) return path;
  if(path==='/compound/')return path;
  if (path.startsWith('/links/')) {
    const persona = path.split('/')[2];
    return '/links/' + (['corvus','pidgy'].includes(persona) ? persona : 'gabe') + '/';
  }
  if (path.startsWith('/go/')) return '/go/';
  if (path.startsWith('/clients/aurus/')) return '/clients/aurus/';
  return ROUTES.has(path) ? path : '/other/';
}
export function hostCategory(host) { return category(host, [...HOSTS, ...EXTERNAL]); }
export function safeURL(value, base = 'https://corvus.gent') {
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (HOSTS.includes(url.hostname)) return `https://${url.hostname}${pathCategory(url.pathname)}`;
    if (!EXTERNAL.includes(url.hostname)) return '';
    const path = url.hostname === 'app.pidgy-ai.com' && url.pathname === '/book/gabe-maxxer/hi-there' ? url.pathname : '/';
    return `https://${url.hostname}${path}`;
  } catch { return ''; }
}
export function countryCategory(value) {
  if (typeof value !== 'string') return '?';
  // Legacy GeoIP used English names; map only real region names to ISO codes.
  if (!countryCategory.names) {
    const display = new Intl.DisplayNames(['en'], {type:'region', fallback:'none'}), names = new Map();
    for (let a=65;a<=90;a++) for (let b=65;b<=90;b++) {
      const code=String.fromCharCode(a,b), name=display.of(code);
      if (name && !['ZZ','QO','XA','XB'].includes(code)) { names.set(code,code); names.set(name,code); }
    }
    countryCategory.names=names;
  }
  return countryCategory.names.get(value) || '?';
}
export const EVENTS = new Set(['squad_member_click','hack_view','hack_app_open','hack_github_click','hack_like','hack_dislike','hack_comment','hack_feedback','hack_share','notice_ok','sidequests_cta_click','sidequests_share','sf_note_seen','sf_note_open','sf_note_click','sf_form_start','sf_form_submit','$pageview','link_click','outbound_click','short_link_out','links_click','links_qr_open','links_crow_click','music_play','vinyl_play','language_vote','goodreads_locked_click','goodreads_access_request','game_start','game_guess','game_end','game_share','share_click','feather_found','terminal_command','site_search','visitor_guess']);
// The campaign owner controls these six categories. Drop arbitrary URL text,
// including email addresses, rather than turning it into a visitor identifier.
export function sidequestTags(p) {
  if (p?.utm_campaign !== 'corvus_softlaunch' || !p.utm_source) return {};
  const tags = {utm_source:sourceCategory(p.utm_source), utm_campaign:'corvus_softlaunch'};
  const allowed = {
    utm_medium:['social','referral','post','company-post','bio'],
    utm_content:['built_in_2_days_post','sidequests_page'],
    utm_id:['li_20261105'],
    utm_term:['founders','builders','gtm','sidequests','linkedin','launch'],
  };
  for (const [key,values] of Object.entries(allowed)) if (p[key]) tags[key] = category(p[key],values);
  return tags;
}
export function privacyEvent(event) {
  if (!event || !EVENTS.has(event.event) || event.properties?.$cookieless_mode !== true) return null;
  const p = event.properties;
  const properties = {
    token: p.token, distinct_id: '$posthog_cookieless', $cookieless_mode: true,
    $process_person_profile: false, $geoip_disable: true,
    $host: category(p.$host, HOSTS, 'other'),
    $pathname: pathCategory(p.$pathname), $current_url: safeURL(p.$current_url),
    $browser: category(p.$browser, BROWSERS, 'Other'),
    $device_type: category(p.$device_type, ['Desktop','Mobile','Tablet'], 'Other'),
  };
  // Cookieless ingestion requires this hash input. Send only the two existing
  // coarse categories, never the browser's raw user agent, versions or model.
  properties.$raw_user_agent = `${properties.$browser}/${properties.$device_type}`;
  if (p.corvus_country_code) properties.corvus_country_code = countryCategory(p.corvus_country_code);
  if(p.utm_campaign==='hack'&&p.utm_content==='squads'){properties.utm_content='squads';if(p.short_slug==='squads')properties.short_slug='squads';}
  if(Number.isInteger(p.hack_id)&&p.hack_id>0&&p.hack_id<=9999)properties.hack_id=p.hack_id;
  if(event.event==='squad_member_click')properties.member=category(p.member,['gabe','siebe','paloma']);
  const referrer = referrerCategory(p.$referring_domain);
  properties.$referring_domain = referrer === 'direct' ? '$direct' : referrer;
  for (const key of ['utm_source','links_source','source']) if (p[key]) properties[key] = sourceCategory(p[key]);
  for (const key of ['utm_campaign','links_campaign','campaign']) if (p[key]) properties[key] = campaignCategory(p[key]);
  for (const key of ['utm_medium','medium']) if (p[key]) properties[key] = category(p[key], ['post','company-page','company-post','bio','links','social','game','qr','email',...ROUTES]);
  if(p.utm_source==='linkedin'&&p.utm_campaign==='gabe-corvus-page'&&['button','website'].includes(p.utm_content))properties.utm_content=p.utm_content;
  Object.assign(properties, sidequestTags(p));
  if (event.event === 'sidequests_cta_click') properties.button = category(p.button,['pidgy','contact','home']);
  if (event.event === 'sidequests_share') properties.method = category(p.method,['native','copy','linkedin','x']);
  const xSource=[p.utm_source,p.links_source,p.source].includes('x');
  const rawCampaign = p.utm_campaign || p.links_campaign || p.campaign;
  const arrivalOwner = /^(corvus|pidgy)-/.exec(rawCampaign || '')?.[1];
  const xCampaign = xSource && approvedCampaign(arrivalOwner ? rawCampaign.slice(arrivalOwner.length + 1) : rawCampaign);
  if(xCampaign){
    const owner = ['corvus','pidgy','gabe'].includes(p.links_person) ? p.links_person : arrivalOwner || 'gabe';
    properties.utm_source='x';properties.utm_campaign=owner+'-'+xCampaign;
    for(const key of ['links_campaign','campaign'])if(p[key])properties[key]=xCampaign;
    const slot=contentSlot(p.utm_content);if(slot)properties.utm_content=slot;
  }
  if (['gabe','pidgy','corvus'].includes(p.links_person)) properties.links_person = p.links_person;
  if (event.event === 'link_click') { properties.link_href=safeURL(p.link_href); properties.page=pathCategory(p.page); }
  if (event.event === 'outbound_click') { properties.host=hostCategory(p.host); properties.href=safeURL(p.href); properties.path=pathCategory(p.path); }
  if (event.event === 'short_link_out') { properties.url=safeURL(p.url); properties.target=category(p.target,['me','home','now','sidequests','support','402','cv','pidgy','book','coffee']); properties.external=!!p.external; }
  if (event.event === 'links_click') properties.link=category(p.link,['pidgy','pidgy-trial','call','portfolio','now','sidequests','linkedin','ig-startup','ig-bjj','realm','games','music','wiki','stats','lantern','crow','keeper','gtm','instagram','youtube','facebook','threads','tiktok','x','luma','alkmist','coffee','home']);
  if (event.event === 'music_play') { properties.genre=category(p.genre,GENRES); /* no artist, title or user-provided track ID */ }
  if (event.event.startsWith('game_')) {
    properties.type=category(p.type,GAME_TYPES);
    if (Number.isInteger(p.guesses) && p.guesses>=0 && p.guesses<=6) properties.guesses=p.guesses;
    if (typeof p.solved==='boolean') properties.solved=p.solved;
  }
  if (/^(game_|visitor_guess)/.test(event.event) && /^\d{4}-\d{2}-\d{2}$/.test(p.day || '')) properties.day=p.day;
  if (event.event==='language_vote') { try { properties.language = new Intl.DisplayNames(['en'], {type:'language',fallback:'none'}).of(p.language) ? p.language : 'other'; } catch { properties.language='other'; } }
  if (event.event==='terminal_command') properties.command=category(p.command,COMMANDS,'unknown');
  if (event.event==='feather_found') { properties.id=category(p.id,['/','/now/','/sidequests/','/support/','/support/books/','/languages/','/call/']); properties.total=Math.min(7,Math.max(0,Number(p.total)||0)); }
  if (event.event==='share_click') properties.what=category(p.what,['gabe','site']);
  // Rebuild rather than spread: removes $set/$set_once, DOM data, IDs, URL query,
  // IP, screen dimensions, UA detail, text and any future SDK-added properties.
  return { event: event.event, properties, timestamp: event.timestamp, uuid: event.uuid };
}
