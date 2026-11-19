// Shared draft controller for every /forms/:slug page. Rendering stays in the form config/view.
export function createFormDraft({ slug, onStatus = () => {}, onRestore = () => {}, request = fetch, storage, allowedIds, requestTimeouts = { save: 15000, flush: 45000 } }) {
  const sessionKey = 'corvus.forms.sessionId', draftKey = 'corvus.forms.draft:' + slug;
  let sessionId, draft, timer, retry, revision = 0, disposed = false;
  let lastSaved = '', lastStamp = 0, canPersist = true, retryDelay = 5000;
  try {
    storage ??= window.localStorage;
    sessionId = storage.getItem(sessionKey);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId || '')) { sessionId = crypto.randomUUID(); storage.setItem(sessionKey, sessionId); }
    draft = JSON.parse(storage.getItem(draftKey) || 'null');
  } catch { canPersist = false; onStatus('This browser cannot keep a draft after closing. Please keep this page open.'); }
  sessionId ||= crypto.randomUUID();
  if (!draft || !draft.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers) || !Number.isFinite(Date.parse(draft.updatedAt))) draft = { answers: {}, updatedAt: new Date().toISOString() };
  if (allowedIds) draft.answers = Object.fromEntries(Object.entries(draft.answers).filter(([id]) => allowedIds.includes(id)));
  lastStamp = Math.min(Date.parse(draft.updatedAt), Date.now());
  draft.updatedAt = new Date(lastStamp).toISOString();
  const payload = () => ({ slug, sessionId, answers: structuredClone(draft.answers), updatedAt: draft.updatedAt });
  const persist = () => { try { storage.setItem(draftKey, JSON.stringify(draft)); canPersist = true; } catch { canPersist = false; onStatus('This browser cannot keep a draft. Keep this page open until it is sent.'); } };
  async function post(action, value, keepalive = false) {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), requestTimeouts[action]);
    try {
      const response = await request('/api/forms/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), keepalive, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) { const error = new Error(result.error || 'Could not save.'); error.status = response.status; throw error; }
      return result;
    } finally { clearTimeout(deadline); }
  }
  async function save() {
    clearTimeout(timer); clearTimeout(retry);
    const value = payload(), encoded = JSON.stringify(value.answers), version = revision;
    if (encoded === lastSaved) return;
    onStatus('Saving…');
    try {
      await post('save', value);
      if (version === revision) { lastSaved = encoded; retryDelay = 5000; onStatus(canPersist ? 'Saved automatically' : 'Saved online. This browser cannot keep a draft after refresh.'); }
    } catch (error) {
      const retryable = !error.status || error.status === 408 || error.status === 429 || error.status >= 500;
      onStatus(retryable ? (canPersist ? 'Saved on this device. Retrying…' : 'Could not save yet. Keep this page open; retrying…') : 'Could not sync this draft. Your answers remain on this page. Please try Done again.');
      if (!disposed && retryable) {
        retry = setTimeout(() => { save().catch(() => {}); }, retryDelay);
        retryDelay = Math.min(60000, retryDelay * 2);
      }
      throw error;
    }
  }
  function change(answers) {
    draft = { answers: structuredClone(answers), updatedAt: new Date(Math.max(Date.now(), lastStamp + 1)).toISOString() };
    if (allowedIds) draft.answers = Object.fromEntries(Object.entries(draft.answers).filter(([id]) => allowedIds.includes(id)));
  lastStamp = Math.min(Date.parse(draft.updatedAt), Date.now());
  draft.updatedAt = new Date(lastStamp).toISOString(); revision++; persist();
    clearTimeout(timer); timer = setTimeout(() => { save().catch(() => {}); }, 800);
  }
  function leave() {
    persist();
    if (!Object.keys(draft.answers).length) return;
    // Include the current draft: the beacon can arrive before an in-flight save.
    const body = JSON.stringify(payload());
    let queued = false;
    try { queued = navigator.sendBeacon?.('/api/forms/flush', new Blob([body], { type: 'application/json' })) || false; } catch { /* Some privacy modes reject the beacon API. */ }
    if (!queued) post('flush', payload(), true).catch(() => {});
  }
  const reconnect = () => {
    if (!disposed && Object.keys(draft.answers).length && JSON.stringify(draft.answers) !== lastSaved) {
      retryDelay = 5000; save().catch(() => {});
    }
  };
  const visibility = () => { if (document.visibilityState === 'hidden') leave(); else reconnect(); };
  window.addEventListener('pagehide', leave); window.addEventListener('online', reconnect); document.addEventListener('visibilitychange', visibility);
  onRestore(structuredClone(draft.answers));
  // Restored drafts may never have reached the server before a crash/offline exit.
  if (Object.keys(draft.answers).length) timer = setTimeout(() => { save().catch(() => {}); }, 800);
  return {
    sessionId,
    change,
    async done() {
      clearTimeout(timer); await save();
      let result;
      for (let attempt = 0; attempt < 4; attempt++) {
        result = await post('flush', payload());
        if (!result.pending) { onStatus('Thanks, sent!'); return result; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      onStatus('Sending is still in progress. Your answers are saved.');
      return result;
    },
    destroy() { disposed = true; clearTimeout(timer); clearTimeout(retry); window.removeEventListener('pagehide', leave); window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', visibility); }
  };
}
