// Shared rules. Rewards are granted by the server, never by a submitted score.
export const LANGUAGES = ['en', 'nl', 'es', 'fr', 'pt', 'de', 'zh'];
export const RANKS = [
  ['tiro', 0], ['miles', 30], ['decanus', 100], ['optio', 300],
  ['centurio', 700], ['tribunus', 1500], ['legatus', 3000],
];
export const WEIGHTS = {streak: 2, best: 3, feather: 10, recruit: 100, toll: 25, weekly: 150, daily: 10};
export const FEATHERS = ['/', '/now/', '/sidequests/', '/support/', '/support/books/', '/languages/', '/call/'];
export const RETENTION = {anonymous: 90, pending: 7, waiting: 90, rejected: 30, member: 365};
export const DAY = 86400;
export const dayKey = (now = Date.now()) => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Brussels'}).format(now);
export function weekKey(now = Date.now()) {
  const d = new Date(dayKey(now) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
export const cleanUsername = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '_') : '';
export const validUsername = value => /^[a-z][a-z0-9_-]{2,23}$/.test(value) && !['admin', 'private', 'api', 'general', 'corvus', 'soldier', 'unknown', 'undefined', 'null'].includes(value);
export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw Error('email');
  return email;
}
export function publicLink(value) {
  if (typeof value === 'string') value = value.trim();
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 300) throw Error('link');
  // People type "linkedin.com/in/me" or "@handle"-style links; add the scheme for them.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = 'https://' + value.replace(/^\/+/, '');
  value = value.replace(/^http:\/\//i, 'https://');
  let url; try { url = new URL(value); } catch { throw Error('link'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|0\.|\[)/.test(url.hostname)) throw Error('link');
  // Links are displayed, never fetched server-side.
  return url.href;
}
export function application(input) {
  const username = cleanUsername(input.username);
  if (!validUsername(username)) throw Error('username');
  const why = typeof input.why === 'string' ? input.why.trim() : '';
  if (!why || [...why].length > 280 || /[\u0000-\u0008\u000b-\u001f]/.test(why)) throw Error('why');
  return {email: normalizeEmail(input.email), username, link: publicLink(input.link), why,
    country: typeof input.country==='string'&&/^[A-Z]{2}$/.test(input.country)?input.country:null,
    lang: LANGUAGES.includes(input.lang) ? input.lang : 'en'};
}
export function points(s) {
  return Math.max(0, Number(s.streak || 0)) * WEIGHTS.streak + Math.max(0, Number(s.best || 0)) * WEIGHTS.best +
    Math.min(FEATHERS.length, (s.feathers || []).length) * WEIGHTS.feather + Math.max(0, Number(s.recruits || 0)) * WEIGHTS.recruit +
    (s.paid ? WEIGHTS.toll : 0) + Math.max(0, Number(s.weeklyWins || 0)) * WEIGHTS.weekly + Math.max(0, Number(s.missionPoints || 0));
}
export function rank(s) {
  if (s.verifiedAt && s.general === true) return 'imperator';
  const value = points(s); return [...RANKS].reverse().find(([, minimum]) => value >= minimum)[0];
}
export function publicSoldier(s, {link = true} = {}) {
  const named = !!s.verifiedAt && !!s.username;
  return {username: named ? s.username : null, serial: s.serial || null, rank: rank(s), points: points(s),
    created: s.created.slice(0, 10), streak: s.streak || 0, best: s.best || 0, feathers: (s.feathers || []).length,
    recruits: s.recruits || 0, approved: s.status === 'approved', tier:activeTier(s),country:s.country||null,hidden:!!s.hidden,
    ...(link && named ? {link: s.link || ''} : {})};
}
export const TIERS=['tiro','miles','centurio','legatus','senator','imperator'];
export function activeTier(s,now=Date.now()){
  if(s.general&&s.verifiedAt)return 'imperator';
  const p=s.membership;
  return p&&TIERS.includes(p.tier)&&p.tier!=='imperator'&&p.state!=='refunded'&&(p.tier==='senator'||Date.parse(p.until)>now)?p.tier:null;
}
export function dailyMission(day, type) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !['babel','borders','wordle','flags','combo','bangle','pingle','lantern'].includes(type)) throw Error('mission');
  return {id: `daily:${day}`, type: 'daily-game', game: type, start: day, end: day, reward: WEIGHTS.daily};
}
export function missionReward(mission, at = Date.now()) {
  if (!['daily-game', 'special-puzzle', 'hackathon'].includes(mission.type) || !Number.isSafeInteger(mission.reward) || mission.reward < 0 || mission.reward > 1000) throw Error('mission');
  const day = dayKey(at); return day >= mission.start && day <= mission.end ? mission.reward : 0;
}
// Waitlist priority, highest first. Paying, recruiting or Pidgy trials move you up
// the line; none of them ever approve you. Pidgy: 1 trial ≈ tiro, 5 ≈ miles.
export const PIDGY = {tiro: 1, miles: 5};
export function priority(s, now = Date.now()) {
  const tier = activeTier(s, now), trials = Math.max(0, Number(s.pidgyTrials || 0));
  const fromTier = tier ? TIERS.indexOf(tier) + 1 : (s.paid ? 1 : 0);
  const fromPidgy = trials >= PIDGY.miles ? 2 : trials >= PIDGY.tiro ? 1 : 0;
  return Math.max(fromTier, fromPidgy, Number(s.recruits || 0) >= 3 ? 1 : 0);
}
