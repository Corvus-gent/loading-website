(() => {
  if (location.origin !== 'https://corvus.gent' || !/^\/hackersbay(?:\/|$)/.test(location.pathname)) return;
  const bridge = window.webkit?.messageHandlers?.captainSquawk;
  if (!bridge) return;
  const seen = new Set();
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  let running = false;
  let cursor = 0;

  function announce(id) {
    if (!uuid.test(id) || seen.has(id)) return;
    seen.add(id);
    bridge.postMessage(id);
  }

  function checkPage() {
    for (const state of document.querySelectorAll('[data-mutual-id]')) announce(state.dataset.mutualId);
  }

  new MutationObserver(checkPage).observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['data-mutual-id'] });
  checkPage();

  window.hackersBayNativeScan = async () => {
    if (running) return;
    running = true;
    try {
      const stored = JSON.parse(localStorage.getItem('hackersbay-intros-v1') || '[]');
      const pending = stored.filter(row => row.shared && row.status === 'pending' && !seen.has(row.id) &&
        Date.now() - row.createdAt < 86400000 && uuid.test(row.id) && uuid.test(row.key));
      if (!pending.length) return;
      const batch = Array.from({ length: Math.min(4, pending.length) }, (_, i) => pending[(cursor + i) % pending.length]);
      cursor = (cursor + batch.length) % pending.length;
      await Promise.all(batch.map(async ({id,key}) => {
        try {
          const response = await fetch('/api/hackersbay?action=intro-status', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,key}),
            signal:AbortSignal.timeout(7000)
          });
          if (response.status === 404) seen.add(id);
          if (response.ok) {
            const {status} = await response.json();
            if (status === 'mutual') announce(id);
            else if (status === 'declined') seen.add(id);
          }
        } catch { /* Check again on the next timer. */ }
      }));
    } catch { /* The app can still open the site if browser storage is unavailable. */ }
    finally { running = false; }
  };
})();
