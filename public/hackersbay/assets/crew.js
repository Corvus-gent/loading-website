const status = document.querySelector('#crew-live');
const totals = [document.querySelector('#crew-pirates'), document.querySelector('#crew-mutuals')];
const format = new Intl.NumberFormat();
let inFlight = false;

async function refresh() {
  if (document.hidden || inFlight) return;
  inFlight = true;
  try {
    const response = await fetch('/api/hackersbay?action=crew-counts', { signal: AbortSignal.timeout(6000) });
    const data = await response.json();
    if (!response.ok || !data.available) throw new Error('Crew count unavailable');
    totals[0].textContent = format.format(data.pirates);
    totals[1].textContent = format.format(data.mutuals);
    if (status.textContent !== 'Live · refreshes every 20 seconds') status.textContent = 'Live · refreshes every 20 seconds';
  } catch {
    for (const total of totals) total.textContent = '–';
    status.textContent = 'Live counts are unavailable right now.';
  } finally {
    inFlight = false;
  }
}
void refresh();
setInterval(refresh, 20000);
document.addEventListener('visibilitychange', refresh);
