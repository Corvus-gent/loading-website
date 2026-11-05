import { redis, connected } from './_redis.js';

const TTL = 1800;
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });
// Format independently of the host's locale conventions.
function brusselsDate(date) {
  const parts = Object.fromEntries(day.formatToParts(date).map(p => [p.type, p.value]));
  return [parts.year, parts.month.padStart(2, '0'), parts.day.padStart(2, '0')].join('-');
}
const sources = [
  ['supporters', 'support_id', 'support_created_on'],
  ['subscriptions', 'subscription_id', 'subscription_created_on'],
  ['extras', 'purchase_id', 'purchased_on'],
];

export async function countCoffee(token, now = new Date(), request = fetch) {
  const month = brusselsDate(now).slice(0, 7);
  const people = new Set(), payments = new Set();
  const result = {ready:true, total:0, supporters:0, supportersEstimated:false, month:0, latest:null};
  const signal = AbortSignal.timeout(20000);
  for (const [source, idField, dateField] of sources) {
    for (let page = 1; ; page++) {
      const res = await request('https://developers.buymeacoffee.com/api/v1/' + source + '?page=' + page, {
        headers:{Authorization:'Bearer ' + token, Accept:'application/json'}, redirect:'error', signal,
      });
      if (page === 1 && source !== 'supporters' && res.status === 404) break;
      if (!res.ok) throw Error('coffee feed unavailable');
      const data = await res.json();
      if (!Array.isArray(data.data) || Number(data.current_page) !== page) throw Error('invalid coffee page');
      for (const row of data.data) {
        if (Number(row.is_refunded) || Number(row.purchase_is_revoked)) continue;
        const id = row[idField];
        if (id == null) throw Error('invalid coffee record');
        const record = source + ':' + id;
        const transaction = row.transaction_id && !/[*]/.test(row.transaction_id) ? 'payment:' + row.transaction_id : record;
        if (payments.has(record) || payments.has(transaction)) continue;
        payments.add(record);
        payments.add(transaction);
        const email = [row.payer_email, row.support_email].find(e => typeof e === 'string' && e.includes('@') && !e.includes('*'));
        if (!email && !row.supporter_id) result.supportersEstimated = true;
        people.add(email ? 'email:' + email.trim().toLowerCase() : row.supporter_id ? 'account:' + row.supporter_id : record);
        const cups = Number(row.support_coffees ?? row.subscription_coffee_num ?? row.purchase_coffees ?? 0);
        if (!Number.isSafeInteger(cups) || cups < 0) throw Error('invalid coffee count');
        if (!cups) continue;
        const timestamp = String(row[dateField]).replace(' ', 'T');
        const date = new Date(/(Z|[+-]\d\d:\d\d)$/i.test(timestamp) ? timestamp : timestamp + 'Z');
        const localDay = brusselsDate(date);
        result.total += cups;
        if (localDay.startsWith(month)) result.month += cups;
        if (!result.latest || localDay > result.latest) result.latest = localDay;
      }
      if (!data.next_page_url && !(page < Number(data.last_page))) break;
    }
  }
  result.supporters = people.size;
  return result;
}

async function cache(command) {
  if (!connected()) return null;
  let timer;
  try {
    return await Promise.race([
      redis(command),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 750); }),
    ]);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

let memo, pending;
async function load(key) {
  const cached = await cache(['GET',key]);
  if (cached) return JSON.parse(cached);
  const value = await countCoffee(process.env.BMC_TOKEN);
  await cache(['SET',key,JSON.stringify(value),'EX',String(TTL)]);
  // Give a warm instance the same lifetime if the shared cache is unavailable.
  memo = {key, value, until:Date.now() + TTL * 1000};
  return value;
}
export default async function coffee(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({error:'method'});
  if (!process.env.BMC_TOKEN) return res.status(200).json({ready:false});
  const key = 'stats:coffee:v1:' + brusselsDate(new Date()).slice(0, 7);
  try {
    if (memo?.key === key && memo.until > Date.now()) return res.status(200).json(memo.value);
    if (pending?.key !== key) {
      const promise = load(key).finally(() => { if (pending?.promise === promise) pending = null; });
      pending = {key, promise};
    }
    return res.status(200).json(await pending.promise);
  } catch {
    return res.status(503).json({error:'coffee unavailable'});
  }
}
