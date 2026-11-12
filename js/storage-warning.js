let timer;
export function showStorageWarning(until) {
  clearTimeout(timer);
  const note = document.getElementById('storage-warning');
  if (!note) return;
  const remaining = /^\d{4}-\d{2}-\d{2}$/.test(until || '')
    ? Date.parse(until + 'T00:00:00.000Z') - Date.now() : 0;
  note.hidden = !(remaining > 0);
  note.textContent = note.hidden ? '' : 'storage link not encrypted until ' + until;
  if (!note.hidden) timer = setTimeout(() => showStorageWarning(until), Math.min(remaining, 86400000));
}
