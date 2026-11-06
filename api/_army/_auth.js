import {id, digest, seal, cookie, readCookie, validID} from './_security.js';
import {DAY} from '../../js/army/domain.js';
export function armyAuth(store) {
  async function issue(uid, purpose = 'claim') {
    if (!['claim','daily','weekly'].includes(purpose)) throw Error('purpose');
    const user = await store.getUser(uid); if (!user?.email) throw Error('email');
    const token = id() + id(), hash = digest('token:' + token);
    await store.own(uid, 'token:' + hash, {uid, purpose}, 1800);
    const job = await queue(uid, purpose === 'claim' ? 'claim' : 'confirm', {secret: seal(token), purpose}, 1800);
    return {token, job};
  }
  async function queue(uid, kind, data = {}, seconds = 2 * DAY, jobID = id()) {
    const job = {uid, kind, data, created: new Date(store.now()).toISOString(), expires: store.now() + seconds * 1000};
    if (await store.get('mail:' + jobID)) return jobID;
    await store.own(uid, 'mail:' + jobID, job, seconds);
    await store.run(['ZADD', store.key('outbox'), store.now(), jobID]);
    return jobID;
  }
  async function session(req) {
    const sid = readCookie(req, 'army_session', 'army_session');
    if (!validID(sid)) return null;
    const record = await store.get('session:' + digest(sid));
    return record ? store.getUser(record.uid) : null;
  }
  async function consume(token, res) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{48}$/.test(token)) throw Error('expired');
    const raw = await store.run(['GETDEL', store.key('token:' + digest('token:' + token))]);
    if (!raw) throw Error('expired');
    const entry = JSON.parse(raw);
    const user = await store.getUser(entry.uid); if (!user?.email) throw Error('expired');
    if (entry.purpose === 'claim') await store.verify(user.id);
    else {
      const sub = await store.get('sub:' + user.id + ':' + entry.purpose);
      if (!sub) throw Error('expired');
      await store.verify(user.id);
      sub.confirmed = true; sub.confirmedAt = new Date(store.now()).toISOString();
      await store.own(user.id, 'sub:' + user.id + ':' + entry.purpose, sub, 365 * DAY);
    }
    const sid = id(); await store.own(user.id, 'session:' + digest(sid), {uid: user.id}, 7 * DAY);
    cookie(res, 'army_session', sid, 7 * DAY); cookie(res, 'army_id', user.id, 90 * DAY);
    return {user: await store.getUser(user.id), purpose: entry.purpose};
  }
  async function unsubscribeToken(uid, kind) {
    const token = id() + id();
    await store.own(uid, 'unsubscribe:' + digest(token), {uid, kind}, 366 * DAY);
    return token;
  }
  async function unsubscribe(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{48}$/.test(token)) return true;
    const entry = await store.get('unsubscribe:' + digest(token)); if (!entry) return true;
    await store.run(['DEL', store.key('sub:' + entry.uid + ':' + entry.kind), store.key('unsubscribe:' + digest(token))]);
    const user = await store.getUser(entry.uid);
    if (user && !user.applied && !await store.get('sub:' + user.id + ':' + (entry.kind === 'daily' ? 'weekly' : 'daily'))) await store.remove(user.id);
    return true;
  }
  return {issue, queue, session, consume, unsubscribeToken, unsubscribe};
}
