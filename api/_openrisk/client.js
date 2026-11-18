export async function client() {
  const root = '/project-cto';
  const main = document.querySelector('#workspace');
  const top = document.querySelector('#top-nav');
  const roleInput = document.querySelector('#role');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const safeUrl = value => {
    try { return new URL(value).protocol === 'https:' ? new URL(value).href : ''; }
    catch { return ''; }
  };
  const link = (url, label = 'Source ↗') => safeUrl(url) ? '<a href="' + esc(safeUrl(url)) + '" target="_blank" rel="noreferrer">' + esc(label) + '</a>' : '';
  const badge = (text, tone = 'dim') => '<span class="badge ' + tone + '">' + esc(text) + '</span>';
  const riskBadge = risk => risk?.grade ? badge(risk.grade + ' · ' + risk.value, risk.grade <= 'B' ? 'ok' : risk.grade === 'C' ? 'warn' : 'red') : badge('Unrated');
  const logo = (item, large = false) => '<span class="logo' + (large ? ' large' : '') + '" aria-hidden="true">' + esc(item.name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase()) + (item.domain ? '<img alt="" loading="lazy" src="https://www.google.com/s2/favicons?sz=64&amp;domain=' + encodeURIComponent(item.domain) + '">' : '') + '</span>';
  const date = stamp => /^\d{4}-\d{2}-\d{2}/.test(stamp || '') ? stamp.slice(0, 10) : '—';
  const ctx = { city: 'Gent', sort: 'risk', role: 'Investor', page: 'map', cache: new Map() };
  let toastTimer;
  function toast(text) {
    clearTimeout(toastTimer);
    document.querySelector('#toast').textContent = text;
    toastTimer = setTimeout(() => { document.querySelector('#toast').textContent = ''; }, 4200);
  }
  async function api(path, body) {
    const options = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const res = await fetch(root + '/api/' + path, options);
    if (res.status === 401) { location.replace(root); throw new Error('Session expired'); }
    const value = await res.json();
    if (!res.ok) throw new Error(value.error || 'Please retry.');
    return value;
  }
  const button = (label, attrs = '', cls = '') => '<button type="button" class="' + cls + '" ' + attrs + '>' + esc(label) + '</button>';
  const panel = (title, content, className = '') => '<section class="panel ' + className + '"><h2>' + esc(title) + '</h2>' + content + '</section>';
  const empty = text => '<p class="empty">' + esc(text) + '</p>';
  const source = signal => signal ? '<div class="source">' + badge(signal.status, signal.status === 'founder-confirmed' ? 'ok' : signal.status === 'proposed' ? 'warn' : 'dim') + ' ' + esc(signal.confidence) + ' confidence · ' + esc(date(signal.fetchedAt)) + ' · ' + link(signal.source) + '</div>' : '';
  const val = (text, s) => '<div class="value">' + esc(text) + '</div>' + source(s);
  const nav = () => {
    roleInput.value = ctx.role;
    top.innerHTML = button('Explore', 'data-page="map"', ctx.page === 'map' ? 'current' : '');
  };
  function navigate(page) {
    ctx.cancel?.abort();
    ctx.page = page;
    nav();
    if (page === 'map') map();
    if (!['profile','cold'].includes(page)) window.scrollTo(0,0);
  }

  function companions(company, mode = 'row') {
    return '<button type="button" class="' + mode + '" data-company="' + esc(company.id) + '">' + logo(company) + '<span><strong>' + esc(company.name) + '</strong><small>' + esc(company.city) + ' · ' + esc(company.sector) + '</small></span>' + riskBadge(company.risk) + '</button>';
  }

  function pin(city, px, py) {
    return '<button class="pin" data-city="' + esc(city.name) + '" title="' + esc(city.name) + '" aria-label="' + esc(city.name) + '" aria-pressed="' + (ctx.city === city.name) + '" style="left:' + px + '%;top:' + py + '%"></button><span class="map-label" style="left:' + px + '%;top:' + py + '%">' + esc(city.name) + '</span>';
  }

  function map() {
    main.innerHTML = '<section class="hero"><span class="eyebrow">Startup intelligence</span><h1>See the risk.<br>Find the opportunity.</h1><p>Explore startups by city or build a risk dossier from public signals.</p><form id="search-form" class="search-wrap" role="search"><label for="company-search" hidden>Search for a startup</label><span class="search-symbol" aria-hidden="true">⌕</span><input id="company-search" placeholder="Search any startup…" maxlength="80" autocomplete="off" aria-controls="search-results" aria-expanded="false"><span class="keycap" aria-hidden="true">/</span><div id="search-results" class="results" hidden></div></form><div class="quick">Quick look ' + ['aikido-security','deliverect','stripe','odoo'].map(id => button(ctx.catalog.find(item => item.id === id).name, 'data-company="' + id + '"')).join('') + '</div></section>'
      + '<div class="layout"><section class="panel atlas"><div class="panel-head"><h2>Ecosystem map</h2>' + badge(ctx.cities.length + ' cities') + '</div><div class="map-stage"><svg viewBox="0 0 900 360" preserveAspectRatio="none" aria-label="World map"><defs><pattern id="grid" width="37.5" height="37.5" patternUnits="userSpaceOnUse"><path d="M 37.5 0 L 0 0 0 37.5" fill="none" stroke="#253751" stroke-width=".7"/></pattern></defs><rect width="900" height="360" fill="url(#grid)"/><path d="' + esc(ctx.land) + '" fill="#243855" stroke="#507096" stroke-width=".65"/></svg><button class="cluster" aria-label="Belgium startup hubs" data-city="Gent" style="left:51.1%;top:22.2%">4</button><button class="cluster" aria-label="Bay Area startup hubs" data-city="San Francisco" style="left:16%;top:31.4%">2</button><span class="map-caption">NATURAL EARTH · GLOBAL VIEW</span></div><div class="market-grid"><div class="market" aria-label="Belgium city pins">' + ctx.cities.filter(c=>c.country==='Belgium').map(c=>pin(c,c.px,c.py)).join('') + '<div class="market-name">Belgium</div></div><div class="market" aria-label="Bay Area city pins">' + ctx.cities.filter(c=>c.country==='United States').map(c=>pin(c,c.px,c.py)).join('') + '<div class="market-name">Bay Area</div></div></div></section><section class="panel"><div class="panel-head"><h2 id="city-title"></h2><select id="city-sort" aria-label="Sort startups"><option value="risk">By score</option><option value="name">By name</option></select></div><div id="city-rows" class="rows"></div></section></div>';
    main.querySelector('.map-stage svg').classList.add('earth');
    const input = document.querySelector('#company-search');
    const results = document.querySelector('#search-results');
    let active = 0;
    let hits = [];
    const update = () => {
      const name = input.value.trim();
      active = 0;
      hits = name ? ctx.catalog.filter(item => item.name.toLowerCase().includes(name.toLowerCase())).sort((a,b) => Number(b.name.toLowerCase().startsWith(name.toLowerCase())) - Number(a.name.toLowerCase().startsWith(name.toLowerCase()))).slice(0,7) : [];
      results.innerHTML = name ? hits.map(item => companions(item, '')).join('') + '<button type="button" data-cold="' + esc(name) + '"><span class="logo">↗</span><span><strong>Research ' + esc(name) + '</strong><small>Look up public sources live</small></span>' + badge('Live') + '</button>' : '';
      results.hidden = !name;
      input.setAttribute('aria-expanded', String(Boolean(name)));
      results.firstElementChild?.classList.add('active');
    };
    input.addEventListener('input', update);
    input.addEventListener('focus', update);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        results.hidden = true;
        input.setAttribute('aria-expanded','false');
      }
      if (['ArrowDown','ArrowUp'].includes(event.key) && results.children.length) {
        event.preventDefault();
        results.children[active]?.classList.remove('active');
        active = (active + results.children.length + (event.key === 'ArrowDown' ? 1 : -1)) % results.children.length;
        results.children[active]?.classList.add('active');
        results.children[active]?.scrollIntoView({block:'nearest'});
      }
    });
    document.querySelector('#search-form').onsubmit = event => {
      event.preventDefault();
      if (input.value.trim()) results.children[active]?.click();
    };
    document.querySelector('#city-sort').value = ctx.sort;
    document.querySelector('#city-sort').onchange = event => { ctx.sort = event.target.value; cityRows(); };
    cityRows();
  }

  function cityRows() {
    const items = ctx.catalog.filter(item => item.city === ctx.city).sort((a,b) =>
      (ctx.sort === 'risk' ? (b.risk?.value ?? -1) - (a.risk?.value ?? -1) : 0) || a.name.localeCompare(b.name));
    document.querySelector('#city-title').textContent = ctx.city + ' · ' + items.length;
    document.querySelector('#city-rows').innerHTML = items.map(item=>companions(item)).join('') || empty('No profiles are available for this city yet.');
    main.querySelectorAll('.pin').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.city === ctx.city)));
  }

  const signalValue = item => {
    const v = item.signal?.value;
    return item.key === 'funding' && v ? v.announced : item.key === 'jobs' && v ? v.count + ' open roles' : item.key === 'github' && v ? 'Push ' + date(v.pushedAt) : v ?? 'Unknown';
  };

  function profileHeader(item, right = '') {
    return '<div class="breadcrumb">' + button('← Explore', 'data-page="map"', 'link') + '</div><div class="profile-head"><div class="profile-id">' + logo(item,true) + '<div><h1>' + esc(item.name) + '</h1><p>' + esc([item.city,item.sector].filter(Boolean).join(' · ')) + '</p></div></div><div class="actions">' + right + '</div></div>';
  }

  function profile(item) {
    navigate('profile');
    ctx.current = item.id;
    const s = item.signals || {}, r = item.risk || { value:null, coverage:0, breakdown:[] };
    const funding = s.funding?.value;
    const age = funding ? (Date.now() - Date.parse(funding.announced)) / (30.4375 * 86400000) : null;
    const ticker = [['Website',item.source],['Jobs',s.jobs],['GitHub',s.github],['Financing',funding],['News',s.news]].map(([label, value]) => badge((value ? '✓ ' : '– ') + label, value ? 'ok' : 'dim')).join('');
    const breakdown = r.breakdown.map(rule => '<tr><td>' + esc(rule.title) + '</td><td>' + rule.weight + '%</td><td>' + esc(signalValue(rule)) + '</td><td>' + (rule.points ?? '—') + '</td><td>' + (rule.signal ? link(rule.signal.source, date(rule.signal.fetchedAt) + ' ↗') : '—') + '</td></tr>').join('');
    const news = s.news?.value?.length ? '<ul class="items">' + s.news.value.map(row => '<li>' + link(row.url, row.title) + ' <small>· ' + esc(date(row.date)) + '</small></li>').join('') + '</ul>' + source(s.news) : empty('No matching stories in the snapshot.');
    const summary = (item.summary || []).map((entry, i) => '<li><strong>' + ['What changed','What’s risky','Ask the founder'][i] + '</strong> · ' + esc(entry.text) + ' ' + link(entry.source) + '</li>').join('');
    main.innerHTML = profileHeader(item) + '<div class="ticker" aria-label="Sources">' + ticker + '</div><div class="dossier">'
      + panel('OpenRisk score','<div class="scoreline"><div class="score">' + (r.value ?? '—') + '<sub>/100</sub></div>' + riskBadge(r) + '</div><div class="meter"><span style="width:' + r.coverage + '%"></span></div><p class="muted">' + r.coverage + '% evidence coverage · ' + (r.trend === null ? '— prior snapshot' : esc(r.trend)) + '</p><div class="source">Public signal rubric · ' + date(r.asOf) + '</div>')
      + panel('How the score is built','<div class="scroll"><table class="rules"><thead><tr><th>Signal</th><th>Weight</th><th>Observed value</th><th>Points</th><th>Source</th></tr></thead><tbody>' + breakdown + '</tbody></table></div>','wide')
      + panel('Company identity','<p>' + esc(item.description) + '</p>' + (s.founded ? '<div>Founded ' + esc(s.founded.value) + '</div>' + source(s.founded) : '') + '<div class="source">' + link(item.source,item.domain + ' ↗') + ' · Curated ' + esc(date(item.asOf)) + '</div>')
      + panel('Team & hiring',s.jobs ? val(s.jobs.value.count + ' open roles',s.jobs) + '<ul class="items">' + s.jobs.value.roles.map(role=>'<li>' + esc(role) + '</li>').join('') + '</ul>' : empty('No supported hiring board in this snapshot.'))
      + panel('Financial signals',funding ? val(funding.label,s.funding) + '<div class="source">Announced ' + esc(funding.announced) + (age > 18 ? ' · ' + badge('Older than 18 months','warn') : '') + '</div>' : s.disclosure ? val(s.disclosure.value.label,s.disclosure) + '<p>' + esc(s.disclosure.value.detail) + '</p>' : empty('No verified financing or annual accounts in this snapshot.'))
      + panel('Product & engineering',s.github ? '<p>' + esc(s.github.value.repo) + ' · Last public push ' + esc(date(s.github.value.pushedAt)) + '</p>' + source(s.github) : empty('No attributable public repository in this snapshot.'))
      + panel('Public coverage',news) + panel('Diligence brief','<ul class="items">' + summary + '</ul>') + '</div>';
    window.scrollTo(0,0);
  }

  async function live(name) {
    navigate('cold');
    const controller = new AbortController();
    ctx.cancel = controller;
    const item = { name };
    const keys = { identity: 'Identity', news: 'Public coverage' };
    const state = {};
    const draw = () => {
      const cards = Object.entries(keys).map(([key, title]) => {
        const event = state[key];
        if (!event) return panel(title, '<div class="shimmer"></div><div class="shimmer"></div><div class="shimmer"></div>');
        if (!event.value) return panel(title, empty('No verified match returned by this source.'));
        const signal = event.value;
        if (key === 'identity') return panel(title, '<p>' + esc(signal.value.description) + '</p>' + source(signal));
        return panel(title, signal.value.length ? '<ul class="items">' + signal.value.map(row=>'<li>' + link(row.url,row.title) + ' <small>· ' + esc(date(row.date)) + '</small></li>').join('') + '</ul>' + source(signal) : empty('The source returned no matching stories.') + source(signal));
      }).join('');
      main.innerHTML = profileHeader(item) + '<div class="ticker" aria-live="polite">' + Object.entries(keys).map(([key,label]) => badge((!state[key] ? '… ' : state[key].value ? '✓ ' : '– ') + label, state[key]?.value ? 'ok' : 'dim')).join('') + '</div><div class="dossier">' + panel('OpenRisk score',val('Unrated') + '<p>Scoring requires sufficient attributable evidence.</p>') + cards + '</div>';
    };
    draw();
    window.scrollTo(0,0);
    try {
      const res = await fetch(root + '/api/cold?name=' + encodeURIComponent(name), { signal: controller.signal });
      if (res.status === 401) return location.replace(root);
      if (!res.ok) throw Error();
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const {value,done} = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const rows = buffer.split('\n');
        buffer = rows.pop();
        for (const row of rows) {
          const event = JSON.parse(row);
          if (Object.hasOwn(keys,event.key)) { state[event.key] = event; draw(); }
        }
        if (done) break;
      }
    } catch {
      if (!controller.signal.aborted) toast('Live sources are temporarily unavailable.');
    } finally {
      if (!controller.signal.aborted) {
        for (const key of Object.keys(keys)) state[key] ??= { value:null };
        draw();
      }
    }
  }

  document.addEventListener('click', event => {
    const node = event.target.closest('button');
    if (!node) return;
    if (node.dataset.page) navigate(node.dataset.page);
    if (node.dataset.city) { ctx.city = node.dataset.city; cityRows(); }
    if (node.dataset.company) profile(ctx.catalog.find(item => item.id === node.dataset.company));
    if (node.dataset.cold) void live(node.dataset.cold);
  });
  document.addEventListener('error', event => { if (event.target instanceof HTMLImageElement) event.target.hidden = true; }, true);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      if (ctx.page !== 'map') navigate('map');
      document.querySelector('#company-search')?.focus();
    }
  });
  roleInput.onchange = async () => {
    roleInput.disabled = true;
    try { ctx.role = (await api('role', { role:roleInput.value })).role; nav(); }
    catch (error) { roleInput.value = ctx.role; toast(error.message); }
    finally { roleInput.disabled = false; }
  };
  try {
    Object.assign(ctx, await api('bootstrap'));
    navigate('map');
  } catch (error) {
    main.textContent = error.message;
  }
}
