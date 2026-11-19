// Shared draft controller for every /forms/:slug page. Rendering stays in the form config/view.
export function createFormDraft({ slug, onStatus = () => {}, onRestore = () => {}, request = fetch, storage = localStorage }) {
  const sessionKey = 'corvus.forms.sessionId', draftKey = 'corvus.forms.draft:' + slug;
  let sessionId, draft, timer, retry, revision = 0, disposed = false;
  let lastSaved = '', lastStamp = 0;
  try {
    sessionId = storage.getItem(sessionKey);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId || '')) { sessionId = crypto.randomUUID(); storage.setItem(sessionKey, sessionId); }
    draft = JSON.parse(storage.getItem(draftKey) || 'null');
  } catch { onStatus('This browser cannot keep a draft after closing. Please keep this page open.'); }
  sessionId ||= crypto.randomUUID();
  if (!draft || !draft.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers) || !Number.isFinite(Date.parse(draft.updatedAt))) draft = { answers: {}, updatedAt: new Date().toISOString() };
  lastStamp = Date.parse(draft.updatedAt);
  const payload = () => ({ slug, sessionId, answers: structuredClone(draft.answers), updatedAt: draft.updatedAt });
  const persist = () => { try { storage.setItem(draftKey, JSON.stringify(draft)); } catch { onStatus('Draft storage is full. Keep this page open until it is sent.'); } };
  async function post(action, value, keepalive = false) {
    const response = await request('/api/forms/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), keepalive });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Could not save.');
    return result;
  }
  async function save() {
    clearTimeout(timer); clearTimeout(retry);
    const value = payload(), encoded = JSON.stringify(value.answers), version = revision;
    if (encoded === lastSaved) return;
    onStatus('Saving…');
    try {
      await post('save', value);
      if (version === revision) { lastSaved = encoded; onStatus('Saved automatically'); }
    } catch (error) {
      onStatus('Saved on this device. Retrying…');
      if (!disposed) retry = setTimeout(() => { save().catch(() => {}); }, 5000);
      throw error;
    }
  }
  function change(answers) {
    draft = { answers: structuredClone(answers), updatedAt: new Date(Math.max(Date.now(), lastStamp + 1)).toISOString() };
    lastStamp = Date.parse(draft.updatedAt); revision++; persist();
    clearTimeout(timer); timer = setTimeout(() => { save().catch(() => {}); }, 800);
  }
  function leave() {
    persist();
    if (!Object.keys(draft.answers).length) return;
    // Include the current draft: the beacon can arrive before an in-flight save.
    const body = JSON.stringify(payload());
    const queued = navigator.sendBeacon('/api/forms/flush', new Blob([body], { type: 'application/json' }));
    if (!queued) post('flush', payload(), true).catch(() => {});
  }
  const visibility = () => { if (document.visibilityState === 'hidden') leave(); };
  window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', visibility);
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
    destroy() { disposed = true; clearTimeout(timer); clearTimeout(retry); window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', visibility); }
  };
}
