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
  const riskBadge = risk => risk?.grade ? badge(risk.grade + ' · ' + risk.value, risk.grade <= 'B' ? 'ok' : risk.grade === 'C' ? 'warn' : 'red') : risk?.provisional ? badge('Provisional · '+risk.value,'warn') : badge('Insufficient data');
  const logo = (item, large = false) => {
    const initials=item.name.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
    const color=Array.from(item.name).reduce((sum,letter)=>sum+letter.charCodeAt(0),0)%4;
    const artwork=ctx.logoIds?.includes(item.id)?root+'/logo/'+item.id:'';
    return '<span class="logo brand-color-'+color+(large?' large':'')+(artwork?' has-art':'')+'" aria-hidden="true">'+esc(initials)
      +(artwork?'<img alt="" '+(large?'':'loading="lazy" ')+'decoding="async" src="'+esc(artwork)+'">':'')+'</span>';
  };
  main.addEventListener('error',event=>{
    const image=event.target;
    if (image instanceof HTMLImageElement && image.parentElement?.classList.contains('logo')) {
      image.hidden=true;
      image.parentElement.classList.remove('has-art');
    }
  },true);
  const stamp = value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value||'') ? value.slice(0,16).replace('T',' ')+' UTC' : date(value);
  const date = stamp => /^\d{4}-\d{2}-\d{2}/.test(stamp || '') ? stamp.slice(0, 10) : '—';
  const ctx = { city:'Gent', sort:'risk', sortDirection:null, role:'Investor', page:'map', selectedPeriod:'2026-10', range:12, category:'Financial', order:'risk', descending:true };
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
    const tabs = [['map','Explore'], ...(ctx.role==='Investor' ? [['portfolio','Portfolio']] : ctx.role==='Founder' ? [['founder','Founder desk'],['funds','Investor fit']] : [['admin','Operations']])];
    top.innerHTML = tabs.map(([page,label])=>button(label,'data-page="'+page+'"',ctx.page===page?'current':'')).join('');
  };
  const viewRoutes = {map:'',portfolio:'/portfolio',founder:'/founder',funds:'/investors',admin:'/operations'};
  const citySlug = name => name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function setPath(path) {
    const target=root+path;
    if (location.pathname!==target) history.pushState(null,'',target);
  }
  function navigate(page, recordPath = true) {
    ctx.cancel?.abort();
    ctx.page = page;
    if (recordPath && Object.hasOwn(viewRoutes,page)) setPath(page==='map' && ctx.countryList ? '/country/'+citySlug(ctx.countryList) : page==='map' && ctx.city!=='Gent' ? '/city/'+citySlug(ctx.city) : viewRoutes[page]);
    nav();
    if (page === 'map') map();
    if (page === 'portfolio') portfolio();
    if (page === 'founder') founder();
    if (page === 'funds') funds();
    if (page === 'admin') admin();
    if (!['profile','cold'].includes(page)) window.scrollTo(0,0);
  }

  function companions(company, mode = 'row', metric = '') {
    return '<button type="button" class="' + mode + '" data-company="' + esc(company.id) + '">' + logo(company) + '<span><strong>' + esc(company.name) + '</strong><small>' + esc(company.city) + (metric ? ' · ' + esc(metric) : '') + ' · ' + esc(company.sector) + (company.signals?.stage ? ' · '+esc(company.signals.stage.value) : '') + '</small></span>' + riskBadge(company.risk) + '</button>';
  }

  function pin(city, px, py) {
    return '<button class="pin" data-city="' + esc(city.name) + '" title="' + esc(city.name) + '" aria-label="' + esc(city.name) + '" aria-pressed="' + (ctx.city === city.name) + '" style="left:' + px + '%;top:' + py + '%"></button><span class="map-label" style="left:' + px + '%;top:' + py + '%">' + esc(city.name) + '</span>';
  }

  function inset(key, label, cities) {
    const [west,south,east,north]=ctx.insets.bounds[key];
    const path=ctx.insets.paths[key];
    const pins=cities.map(city=>{
      const x=(city.lon-west)*100/(east-west);
      const y=(north-city.lat)*100/(north-south);
      return '<button class="pin" data-city="'+esc(city.name)+'" title="'+esc(city.name)+'" aria-label="'+esc(city.name)+' map pin" aria-pressed="'+(ctx.city===city.name)+'" style="left:'+x+'%;top:'+y+'%"></button>';
    }).join('');
    const labels=cities.map(city=>button(city.name,'data-city="'+esc(city.name)+'" aria-pressed="'+(ctx.city===city.name)+'"','inset-city')).join('');
    return '<section class="market" aria-label="'+label+'"><div class="inset-geo" data-map-camera="'+key+'-'+esc(label)+'" tabindex="0" aria-label="'+esc(label)+' map"><div class="map-layer"><svg viewBox="0 0 300 115" preserveAspectRatio="none" aria-hidden="true"><path d="'+esc(path)+'" fill="#223754" stroke="#52769c" stroke-width=".7"/></svg>'+pins+'</div><span class="market-name">'+label+'</span>'+mapControls(label)+'</div><div class="inset-cities">'+labels+'</div></section>';
  }

  const mapCountries=['Belgium','England','Netherlands','Germany','France','United States'];
  const cityRegion = name => {
    const country=allCities().find(city=>city.name===name)?.country;
    return mapCountries.includes(country) ? country : 'Belgium';
  };

  const mapCameras = new Map();

  function mapControls(label) {
    return '<div class="map-controls" role="group" aria-label="'+esc(label)+' controls">'
      +button('−','data-map-zoom="out" aria-label="Zoom out · '+esc(label)+'"')
      +button('+','data-map-zoom="in" aria-label="Zoom in · '+esc(label)+'"')
      +button('Reset','data-map-zoom="reset" aria-label="Reset view · '+esc(label)+'"')+'</div>';
  }

  function bindMapCamera(viewport) {
    const key=viewport.dataset.mapCamera;
    const world=key==='world';
    const layer=viewport.querySelector('.map-layer');
    const controls=viewport.querySelector('.map-controls');
    const camera=mapCameras.get(key) || {scale:1,x:0,y:0};
    mapCameras.set(key,camera);
    const maxScale=world?32:8;
    const pointers=new Map();
    let moved=false;
    const point=event=>{
      const bounds=viewport.getBoundingClientRect();
      return {x:(event.clientX-bounds.left)/bounds.width,y:(event.clientY-bounds.top)/bounds.height};
    };
    const center={x:.5,y:.5};
    function paint() {
      const {scale}=camera;
      camera.x=Math.max(1-scale,Math.min(0,camera.x));
      camera.y=Math.max(1-scale,Math.min(0,camera.y));
      layer.style.transform='translate('+camera.x*100+'%, '+camera.y*100+'%) scale('+scale+')';
      layer.style.setProperty('--map-pin-scale',1/scale);
      viewport.classList.toggle('map-closeup',world && scale>=5);
      controls.querySelector('[data-map-zoom="out"]').disabled=scale===1;
      controls.querySelector('[data-map-zoom="in"]').disabled=scale===maxScale;
    }
    function zoom(factor, anchor=center, destination=anchor) {
      const next=Math.max(1,Math.min(maxScale,camera.scale*factor));
      const ratio=next/camera.scale;
      camera.x=destination.x-(anchor.x-camera.x)*ratio;
      camera.y=destination.y-(anchor.y-camera.y)*ratio;
      camera.scale=next;
      paint();
    }
    function act(action) {
      if (action==='reset') { Object.assign(camera,{scale:1,x:0,y:0}); paint(); }
      else zoom(action==='in'?1.6:1/1.6);
    }
    controls.addEventListener('click',event=>{
      const node=event.target.closest('[data-map-zoom]');
      if (node) act(node.dataset.mapZoom);
    });
    viewport.addEventListener('wheel',event=>{
      if (event.target.closest('.map-controls') || !event.deltaY) return;
      if (event.deltaY>0 && camera.scale===1 && !event.ctrlKey) return;
      event.preventDefault();
      zoom(event.deltaY<0?1.2:1/1.2,point(event));
    },{passive:false});
    viewport.addEventListener('keydown',event=>{
      if (event.target!==viewport) return;
      const offsets={ArrowLeft:[.1,0],ArrowRight:[-.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]};
      if (Object.hasOwn(offsets,event.key)) {
        const [x,y]=offsets[event.key];
        camera.x+=x;
        camera.y+=y;
        paint();
      } else if (['+','=','-','0'].includes(event.key)) {
        act(event.key==='0'?'reset':event.key==='-'?'out':'in');
      } else return;
      event.preventDefault();
    });
    const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const span=(a,b)=>Math.hypot((a.x-b.x)*viewport.clientWidth,(a.y-b.y)*viewport.clientHeight);
    viewport.addEventListener('pointerdown',event=>{
      if (event.button!==0 || event.target.closest('.map-controls') || pointers.size>=2) return;
      if (!pointers.size) moved=false;
      pointers.set(event.pointerId,point(event));
    });
    viewport.addEventListener('pointermove',event=>{
      const previous=pointers.get(event.pointerId);
      if (!previous) return;
      const next=point(event);
      const other=[...pointers].find(([id])=>id!==event.pointerId)?.[1];
      if (!other && !moved && span(previous,next)<5) return;
      moved=true;
      viewport.classList.add('map-dragging');
      if (!viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId,next);
      if (other) {
        zoom(span(next,other)/Math.max(1,span(previous,other)),midpoint(previous,other),midpoint(next,other));
      } else {
        camera.x+=next.x-previous.x;
        camera.y+=next.y-previous.y;
        paint();
      }
    });
    const end=event=>{
      pointers.delete(event.pointerId);
      if (!pointers.size) viewport.classList.remove('map-dragging');
    };
    viewport.addEventListener('pointerup',end);
    viewport.addEventListener('pointercancel',end);
    viewport.addEventListener('pointerleave',event=>{
      if (!viewport.hasPointerCapture(event.pointerId)) end(event);
    });
    viewport.addEventListener('click',event=>{
      if (moved && event.detail && !event.target.closest('.map-controls')) event.stopPropagation();
    },true);
    paint();
  }

  function map() {
    const cities=allCities();
    const region=ctx.countryList || cityRegion(ctx.city);
    const regionName=country=>country==='United States'?'Bay Area':country;
    const countries='<div class="country-switch" role="group" aria-label="Map country">' + mapCountries.map(country=>
      button(regionName(country),'data-map-country="'+country+'" aria-pressed="'+(region===country)+'"')).join('')+'</div>';
    const key=region==='United States'?'bay':citySlug(region);
    const [west,south,east,north]=ctx.insets.bounds[key];
    const regionalCities=cities.filter(city=>city.country===region && city.lon>=west && city.lon<=east && city.lat>=south && city.lat<=north);
    const europeCount=cities.filter(city=>mapCountries.includes(city.country) && city.country!=='United States').length;
    main.innerHTML = '<section class="hero"><span class="eyebrow">Startup intelligence</span><h1>Explore startup risk.</h1><p>Explore startups by city or build a risk dossier from public signals.</p><form id="search-form" class="search-wrap" role="search"><label for="company-search" hidden>Search for a startup</label><span class="search-symbol" aria-hidden="true">⌕</span><input id="company-search" placeholder="Search any startup…" maxlength="80" autocomplete="off" aria-controls="search-results" aria-expanded="false"><span class="keycap" aria-hidden="true">/</span><div id="search-results" class="results" hidden></div></form><div class="quick">Quick look ' + ['aikido-security','deliverect','stripe','odoo'].map(id => button(ctx.catalog.find(item => item.id === id).name, 'data-company="' + id + '"')).join('') + '</div></section>'
      + '<div class="layout"><section class="panel atlas"><div class="panel-head"><h2>Ecosystem map</h2>' + '<div class="actions">' + badge(allCompanies().length + ' profiles · ' + allCities().length + ' cities') + button('Suggest startup','data-open-dialog="startup"') + button('+ Add city','data-open-dialog="city"') + '</div></div><div class="map-stage" data-map-camera="world" tabindex="0" aria-label="World map"><div class="map-layer"><svg viewBox="0 0 900 360" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="grid" width="37.5" height="37.5" patternUnits="userSpaceOnUse"><path d="M 37.5 0 L 0 0 0 37.5" fill="none" stroke="#253751" stroke-width=".7"/></pattern></defs><rect width="900" height="360" fill="url(#grid)"/><path d="' + esc(ctx.land) + '" fill="#243855" stroke="#507096" stroke-width=".65"/></svg><button class="cluster" aria-label="European startup hubs" data-city="Brussels" style="left:51.1%;top:22.2%">' + europeCount + '</button><button class="cluster" aria-label="Bay Area startup hubs" data-city="San Francisco" style="left:16%;top:31.4%">2</button>' + worldPins() + '</div><span class="map-caption">NATURAL EARTH · GLOBAL VIEW</span>' + mapControls('world map') + '</div><div class="market-grid">' + countries + inset(key,regionName(region),regionalCities) + '</div></section><section class="panel"><div class="panel-head"><h2 id="city-title"></h2>' + sortControls() + '</div>' + nearbyForm() + (ctx.countryList?'<p id="country-scope" class="source">Selected profiles and approved suggestions across several hubs</p>':'') + '<div id="city-rows" class="rows"></div></section></div>';
    main.querySelector('.map-stage svg').classList.add('earth');
    main.querySelectorAll('[data-map-camera]').forEach(bindMapCamera);
    const input = document.querySelector('#company-search');
    const results = document.querySelector('#search-results');
    let active = 0;
    let hits = [];
    const update = () => {
      const name = input.value.trim();
      active = 0;
      hits = name ? allCompanies().filter(item => item.name.toLowerCase().includes(name.toLowerCase())).sort((a,b) => Number(b.name.toLowerCase().startsWith(name.toLowerCase())) - Number(a.name.toLowerCase().startsWith(name.toLowerCase()))).slice(0,7) : [];
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
    main.querySelector('#city-sort').onchange = event => {
      ctx.sort=event.target.value;
      ctx.sortDirection=null;
      cityRows();
      if (ctx.sort==='nearby' && !ctx.origin) main.querySelector('#nearby-query').focus();
    };
    main.querySelector('#city-direction').onchange = event => {
      ctx.sortDirection=event.target.value;
      cityRows();
    };
    bindNearbyForm();
    cityRows();
  }

  const hiringMetric = item => item.signals.jobs?.value.count ?? item.signals.directoryJobs?.value;
  const startupSorts = {
    risk:{label:'Grade', directions:['High to low','Low to high'], value:item=>item.risk?.grade ? item.risk.value : null},
    coverage:{label:'Evidence coverage', directions:['Most first','Least first'], value:item=>item.risk?.coverage,
      detail:(item,value)=>value+'% evidence coverage'},
    hiring:{label:'Open roles', directions:['Most first','Fewest first'], value:hiringMetric,
      detail:(item,value)=>value+(item.signals.jobs ? ' direct openings' : (value>=50?'+':'')+' directory listings')},
    founded:{label:'Year founded', directions:['Newest first','Oldest first'], value:item=>item.signals.founded?.value,
      detail:(item,value)=>'Founded '+value},
    name:{label:'Name', directions:['A to Z','Z to A'], value:item=>item.name},
    nearby:{label:'Distance', directions:['Nearest first','Farthest first']},
  };

  function sortControls() {
    return '<div class="startup-sort"><label>Sort by<select id="city-sort" aria-label="Sort startups">'
      +Object.entries(startupSorts).map(([key,sort])=>'<option value="'+key+'">'+sort.label+'</option>').join('')
      +'</select></label><label>Order<select id="city-direction" aria-label="Sort order"></select></label></div>';
  }

  function nearbyForm() {
    return '<form id="nearby-form" class="stack" hidden><label for="nearby-query">City or postal code</label>'
      + '<input id="nearby-query" name="query" maxlength="80" placeholder="e.g. Brussels or 1000" value="'+esc(ctx.originQuery)+'">'
      + '<label for="nearby-country">Country (optional)</label><select id="nearby-country" name="country">'
      + [['','Auto'],['BE','Belgium'],['NL','Netherlands'],['FR','France'],['DE','Germany'],['GB','United Kingdom'],['US','United States']]
        .map(([code,label])=>'<option value="'+code+'"'+(ctx.originCountry===code?' selected':'')+'>'+label+'</option>').join('')
      + '</select><div class="actions"><button type="submit">Find nearby</button><button type="button" id="nearby-gps">Use approximate location</button></div>'
      + '<p class="source" id="nearby-status" role="status"></p>'
      + '<p class="source">With permission, your browser checks once and rounds your position to a coarse area in this tab. City and postcode lookup uses '+link('https://www.openstreetmap.org/copyright','OpenStreetMap data')+'.</p></form>';
  }

  function bindNearbyForm() {
    const form=main.querySelector('#nearby-form'), status=form.querySelector('#nearby-status');
    const gps=form.querySelector('#nearby-gps'), submit=form.querySelector('[type="submit"]');
    const locateFrom = async (task, pending, query='', country='') => {
      status.textContent=pending;
      gps.disabled=submit.disabled=true;
      try {
        const origin=await task();
        if (!form.isConnected || ctx.sort!=='nearby') return;
        ctx.origin=origin;
        ctx.originQuery=query;
        ctx.originCountry=country;
        cityRows();
      } catch (error) {
        status.textContent=error.message;
      } finally {
        gps.disabled=submit.disabled=false;
      }
    };
    form.onsubmit=event=>{
      event.preventDefault();
      const {query,country}=Object.fromEntries(new FormData(form));
      if (!query.trim()) { status.textContent='Enter a city or postal code.'; return; }
      void locateFrom(()=>api('location',{query,country}),'Finding that location…',query,country);
    };
    gps.onclick=()=>{
      if (!navigator.geolocation) { status.textContent='Location is unavailable. Enter a city or postal code.'; return; }
      void locateFrom(()=>new Promise((resolve,reject)=>{
        navigator.geolocation.getCurrentPosition(({coords})=>resolve({
          label:'your approximate area', approximate:true,
          lat:Math.round(coords.latitude*10)/10, lon:Math.round(coords.longitude*10)/10,
        }),
          error=>reject(new Error(error.code===1?'Location access was declined. Enter a city or postal code.':'Could not get your location. Enter a city or postal code.')),
          {enableHighAccuracy:false,timeout:8000,maximumAge:0});
      }),'Waiting for your location…');
    };
  }

  function distanceKm(origin, place) {
    const radians=Math.PI/180;
    const lat=(place.lat-origin.lat)*radians, lon=(place.lon-origin.lon)*radians;
    const h=Math.sin(lat/2)**2 + Math.cos(origin.lat*radians)*Math.cos(place.lat*radians)*Math.sin(lon/2)**2;
    return 12742*Math.asin(Math.sqrt(Math.min(1,h)));
  }

  function cityRows() {
    const nearby=ctx.sort==='nearby';
    const sort=startupSorts[ctx.sort];
    const order=ctx.sortDirection || 'default';
    main.querySelector('#city-sort').value=ctx.sort;
    const orderInput=main.querySelector('#city-direction');
    orderInput.replaceChildren(new Option(sort.directions[0],'default'),new Option(sort.directions[1],'reverse'));
    orderInput.value=order;
    const direction=order==='reverse'?-1:1;
    main.querySelector('#nearby-form').hidden=!nearby;
    main.querySelector('#nearby-status').textContent=nearby && ctx.origin
      ? 'From '+ctx.origin.label+' · Straight-line distance to each startup’s city' : '';
    const scope=main.querySelector('#country-scope');
    if (scope) scope.hidden=nearby;
    if (nearby) {
      main.querySelector('#city-title').textContent='Nearby startups';
      const places=new Map(allCities().map(place=>[place.name,place]));
      const closest=ctx.origin ? allCompanies().filter(item=>places.has(item.city))
        .map(item=>({item,km:distanceKm(ctx.origin,places.get(item.city))}))
        .sort((a,b)=>direction*(a.km-b.km) || a.item.name.localeCompare(b.item.name)) : [];
      const format=new Intl.NumberFormat('en',{maximumFractionDigits:ctx.origin?.approximate?0:1});
      main.querySelector('#city-rows').innerHTML=closest.length ? closest.map(({item,km})=>
        companions(item,'row',(ctx.origin.approximate?'≈ ':'')+format.format(km)+' km')).join('')
        : empty(ctx.origin?'No startups have a mapped city.':'Choose a starting location to sort the map.');
      main.querySelectorAll('.pin,.inset-city').forEach(node=>node.setAttribute('aria-pressed','false'));
      return;
    }
    const countryCities = new Set(allCities().filter(city=>city.country===ctx.countryList).map(city=>city.name));
    const items = (ctx.countryList ? [...ctx.catalog,...ctx.state.approved] : allCompanies())
      .filter(item => ctx.countryList ? countryCities.has(item.city) : item.city === ctx.city)
      .map(item=>({item,value:sort.value(item)}))
      .sort((a,b)=>{
        if (a.value==null || b.value==null) return Number(a.value==null)-Number(b.value==null) || a.item.name.localeCompare(b.item.name);
        const comparison=ctx.sort==='name' ? a.value.localeCompare(b.value) : b.value-a.value;
        return direction*comparison || a.item.name.localeCompare(b.item.name);
      });
    document.querySelector('#city-title').textContent = (ctx.countryList||ctx.city) + ' · ' + items.length;
    document.querySelector('#city-rows').innerHTML = items.map(({item,value})=>
      companions(item,'row',sort.detail ? (value==null?'Not available':sort.detail(item,value)) : '')
    ).join('') || empty('No profiles are available for this city yet.');
    main.querySelectorAll('.pin,.inset-city').forEach(node => node.setAttribute('aria-pressed', String(!ctx.countryList && node.dataset.city === ctx.city)));
  }

  const signalValue = item => {
    const v = item.signal?.value;
    if (item.basis==='directory') return v + (v>=50?'+':'') + ' roles listed in StartupMap';
    return item.key === 'funding' && v ? v.label + ' · ' + v.announced : item.key === 'jobs' && v ? v.count + ' open roles' : item.key === 'github' && v ? 'Push ' + date(v.pushedAt) : v ?? 'Unknown';
  };

  const scoreNumber = value => new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
  const scoreRules = {
    founded:'45 raw points plus 5 per calendar year since founding, bounded between 20 and 100.',
    funding:'100 raw points up to 6 months, 85 up to 12, 70 up to 18, then 45.',
    jobs:'Starts at 50 raw points. Adds 17 × log₂(open roles + 1), rounded, with a ceiling of 100.',
    github:'100 raw points for a push in the past 14 days, 80 up to 45, 60 up to 120, then 35.',
  };

  function scoreVisual(r) {
    if (r.value==null) return '';
    const observed=r.breakdown.filter(row=>row.points!=null);
    const total=observed.reduce((sum,row)=>sum+row.points*row.weight/r.coverage,0);
    const segments=observed.map(row=>'<span class="score-segment '+row.key+'" style="width:'+row.points*row.weight/r.coverage+'%" title="'+esc(row.title)+': '+scoreNumber(row.points*row.weight/r.coverage)+' points"></span>').join('');
    return '<div class="score-visual" aria-label="'+scoreNumber(total)+' points earned and '+scoreNumber(Math.max(0,100-total))+' points below the maximum"><div class="score-track" aria-hidden="true">'+segments+'</div><div class="score-legend"><span>'+scoreNumber(total)+' earned</span><span>'+scoreNumber(Math.max(0,100-total))+' gap</span></div></div>';
  }

  function scoreObservation(row, asOf) {
    const value=row.signal?.value;
    if (!value) return esc(signalValue(row));
    if (row.key==='founded') {
      const years=new Date(asOf).getUTCFullYear()-value;
      return 'Founded '+value+' · '+years+' calendar '+(years===1?'year':'years')+' in the model';
    }
    if (row.key==='funding') {
      const months=(Date.parse(asOf)-Date.parse(value.announced))/(365.25/12*86400000);
      return esc(value.label)+' · '+(months>=0?scoreNumber(Math.round(months*10)/10)+' months ago':date(value.announced));
    }
    return esc(signalValue(row));
  }

  function scoreBreakdown(r) {
    const scored=r.value!=null;
    const rows=r.breakdown.map(rule=>{
      const known=rule.points!=null;
      const maximum=known && scored ? 100*rule.weight/r.coverage : null;
      const earned=maximum==null ? null : maximum*rule.points/100;
      return {...rule,maximum,earned,gap:earned==null?null:maximum-earned};
    });
    const observed=rows.filter(row=>row.earned!=null);
    const total=observed.reduce((sum,row)=>sum+row.earned,0);
    const highlights=scored ? '' : '<p class="muted">At least 25% evidence coverage is required to show a provisional score.</p>';
    const table=rows.map(row=>'<tr><th scope="row">'+esc(row.title)+'<small class="score-observed">'+scoreObservation(row,r.asOf)+' · '+row.weight+'% model weight</small></th><td>'+(row.points==null?'No evidence':row.points+'/100')+'</td><td>'+(row.earned==null?'—':'<strong class="gain">+'+scoreNumber(row.earned)+'</strong> / '+scoreNumber(row.maximum))+'</td><td>'+(row.gap==null?'—':row.gap>0?'<strong class="gap">−'+scoreNumber(row.gap)+'</strong>':'0')+'</td><td>'+(row.signal?link(row.signal.source,date(row.signal.fetchedAt)+' ↗'):'—')+'</td></tr>').join('');
    const math=scored ? '<div class="score-math"><strong>'+observed.map(row=>scoreNumber(row.earned)).join(' + ')+' = '+scoreNumber(total)+' → '+r.value+'/100</strong><small>'+scoreNumber(100-total)+' points below the maximum before rounding.'+(r.provisional?' Provisional score based on limited evidence.':'')+(r.coverage<100?' Observed weights are scaled to 100. Missing signals reduce coverage.':'')+'</small></div>' : '';
    const methodology='<details class="score-method"><summary>Scoring rules and grade thresholds</summary><ul class="items">'+rows.map(row=>'<li><strong>'+esc(row.title)+'</strong> · '+esc(scoreRules[row.key]||'')+'</li>').join('')+'</ul><p>Weighted points = raw score ÷ 100 × available points. Letter grades require at least 45% evidence coverage. Grade A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, E &lt; 40.</p></details>';
    return highlights+'<div class="scroll"><table class="rules score-table"><thead><tr><th>Signal</th><th>Raw score</th><th>Points earned</th><th>Gap</th><th>Source</th></tr></thead><tbody>'+table+'</tbody></table></div>'+math+methodology;
  }

  function scoreTakeaways(r) {
    if (r.value==null) return '<p>OpenRisk needs evidence for at least 25% of the model weight before showing a provisional score.</p>';
    const observed=r.breakdown.filter(row=>row.points!=null);
    const earned=row=>row.weight*row.points/r.coverage;
    const missing=row=>row.weight*(100-row.points)/r.coverage;
    const leader=[...observed].sort((a,b)=>earned(b)-earned(a))[0];
    const largestGap=[...observed].sort((a,b)=>missing(b)-missing(a))[0];
    return '<dl class="dossier-takeaways"><div><dt>Biggest contribution</dt><dd>'+esc(leader.title)+' <strong class="gain">+'+scoreNumber(earned(leader))+'</strong></dd></div>'+
      (missing(largestGap)>0?'<div><dt>Biggest gap</dt><dd>'+esc(largestGap.title)+' <strong class="gap">−'+scoreNumber(missing(largestGap))+'</strong></dd></div>':'')+'</dl>';
  }

  function evidenceDetail(title, content, hint='') {
    return '<details class="evidence-detail"><summary><span>'+esc(title)+'</span>'+(hint?'<small>'+esc(hint)+'</small>':'')+'</summary><div class="evidence-body">'+content+'</div></details>';
  }

  function investmentLens(s) {
    const strengths=[
      s.funding && [s.funding.value.label+' announced '+date(s.funding.value.announced),s.funding.source],
      s.jobs?.value.count>0 && [s.jobs.value.count+' advertised roles show active hiring',s.jobs.source],
      s.github && ['Public GitHub activity recorded on '+date(s.github.value.pushedAt),s.github.source],
    ].filter(Boolean);
    const risks=s.jobs?.value.count>0
      ? 'Hiring can raise burn. Check how much of the current plan is funded.'
      : 'Check current burn, cash runway and near-term funding needs.';
    const upside=s.traction
      ? '<p>'+esc(s.traction.value.label)+' suggests reach. Verify paying conversion, retention and account expansion.</p>'+source(s.traction)
      : '<p>Assess demand through paid revenue growth, retention and customer concentration.</p>';
    const row=(heading,content)=>'<div class="lens-row"><h3>'+heading+'</h3><div>'+content+'</div></div>';
    return row('Reasons to investigate',strengths.length?'<ul class="items">'+strengths.map(([text,url])=>'<li>'+esc(text)+' '+link(url)+'</li>').join('')+'</ul>':empty('Evidence is limited. Start by verifying company fundamentals.'))+
      row('Upside to validate',upside)+
      row('Risks and deal terms','<p>'+esc(risks)+'</p><p>Ask for cash, net burn, retention, entry valuation and investor rights.</p>');

  }

  function profileHeader(item, right = '') {
    return '<div class="breadcrumb">' + button('← Explore', 'data-page="map"', 'link') + '</div><div class="profile-head"><div class="profile-id">' + logo(item,true) + '<div><h1>' + esc(item.name) + '</h1><p>' + esc([item.city,item.sector].filter(Boolean).join(' · ')) + '</p></div></div><div class="actions">' + right + '</div></div>';
  }

  const dossierModes = ['Read','Dashboard','Evidence'];
  let dossierMode='Read';
  try {
    const saved=localStorage.getItem('openrisk:dossier-mode');
    if (dossierModes.includes(saved)) dossierMode=saved;
  } catch {}

  function dossierSwitcher() {
    return '<div class="dossier-switcher" role="group" aria-label="Dossier view" style="--selected:'+dossierModes.indexOf(dossierMode)+'">'+
      dossierModes.map(mode=>button(mode,'data-dossier-mode="'+mode+'" aria-pressed="'+(mode===dossierMode)+'"')).join('')+'</div>';
  }

  function profile(item, recordPath = true, logView = true) {
    navigate('profile',false);
    if (recordPath) setPath('/startup/'+item.id);
    ctx.current = item.id;
    const s = item.signals || {}, r = item.risk || { value:null, coverage:0, breakdown:[] };
    const funding = s.funding?.value;
    const age = funding ? (Date.now() - Date.parse(funding.announced)) / (30.4375 * 86400000) : null;
    const news = s.news?.value?.length ? '<ul class="items">' + s.news.value.map(row => '<li>' + link(row.url, row.title) + ' <small>· ' + esc(date(row.date)) + '</small></li>').join('') + '</ul>' + source(s.news) : empty('No matching stories in the snapshot.');
    const headcount=s.headcount;
    const hiringTrend=s.jobs?.value.delta;
    const listedRoles=s.directoryJobs?.value;
    const directoryRoles=listedRoles ? '<p>'+esc(listedRoles)+(listedRoles>=50?'+':'')+' roles listed in StartupMap</p>'+source(s.directoryJobs) : '';
    const teamData=(s.jobs ? val(s.jobs.value.count + ' open roles',s.jobs)
      +(typeof hiringTrend==='number'?'<div class="source">'+(hiringTrend>0?'+':'')+hiringTrend+' since '+stamp(s.jobs.value.priorAt)+'</div>':'')+'<ul class="items">' + s.jobs.value.roles.map(role=>'<li>' + esc(role) + '</li>').join('') + '</ul>' + (s.jobs.value.departments?.length ? '<div class="source">Teams · '+esc(s.jobs.value.departments.join(', '))+'</div>' : '') : directoryRoles)
      +(headcount ? '<p style="margin-top:8px">'+esc(headcount.value.label || (headcount.value.min+'–'+headcount.value.max+' estimated employees'))+'</p>'+(headcount.value.detail?'<small>'+esc(headcount.value.detail)+'</small>':'')+source(headcount) : '');
    const founderNames=s.founders?.value;
    const identityFields=(founderNames?.length?'<p style="margin-top:8px">Founders · '+esc(founderNames.join(', '))+'</p>'+source(s.founders):'')+(s.location?'<p>'+esc(s.location.value)+'</p>'+source(s.location):'')+(s.enterprise?'<div>Belgian enterprise number '+esc(s.enterprise.value)+'</div>'+source(s.enterprise)+'<div class="source">'+link('https://consult.cbso.nbb.be/','NBB annual accounts ↗')+'</div>':'');
    const accounts = s.accounts?.value;
    const filing = accounts ? panel('Belgian annual accounts','<p>'+esc(accounts.entity)+' · '+esc(accounts.scope)+'</p><div class="scroll"><table class="rules"><thead><tr><th>Filed item</th><th>FY ended '+esc(accounts.fiscalEnd)+'</th></tr></thead><tbody>'+accounts.rows.map(row=>'<tr><td>'+esc(row.label)+' <small>· '+esc(row.code)+'</small></td><td>'+shown({value:row.value,currency:row.code==='9087'?null:accounts.currency})+'</td></tr>').join('')+'</tbody></table></div><div class="source">NBB filing '+esc(accounts.reference)+' · Filed '+esc(accounts.filedAt)+'</div>'+source(s.accounts),'wide') : '';
    const app = s.app?.value;
    const product = (s.github ? '<p>'+esc(s.github.value.repo)+' · Last public push '+date(s.github.value.pushedAt)+'</p>'
      +(Number.isInteger(s.github.value.stars)?'<div>'+number(s.github.value.stars)+' repository stars</div>':'')+source(s.github) : '')
      +(app ? '<div style="margin-top:13px"><strong>'+esc(app.title)+'</strong><p>'+number(app.rating)+' / 5 · '+number(app.reviews)+' ratings<br>App Store · '+esc(app.storefront)+(app.releasedAt?' · Last version '+date(app.releasedAt):'')+'</p>'+source(s.app)+'</div>' : '')
      +(s.traction ? '<div style="margin-top:12px"><strong>'+esc(s.traction.value.label)+'</strong><p>'+esc(s.traction.value.detail)+'</p>'+source(s.traction)+'</div>' : '')
      +(s.website ? link(s.website.value,'Official site ↗')+source(s.website) : '');
    const event = s.corporateEvent ? '<p>'+esc(s.corporateEvent.value.label)+' · '+esc(s.corporateEvent.value.date)+'</p>'+source(s.corporateEvent) : '';
    const trend=r.trend==null?'No comparable prior snapshot':(r.trend>0?'↑ +':r.trend<0?'↓ ':'→ ')+r.trend+' since '+stamp(r.priorAt);
    const claimed = ctx.state.claims.includes(item.id);
    const followed = ctx.state.followed.includes(item.id);
    const controls = (ctx.role==='Investor' ? button(followed?'Following':'Follow','data-follow="'+item.id+'"','accent') : '')
      + (ctx.role!=='Admin' ? button(claimed?'Open founder desk':'Claim this profile','data-claim="'+item.id+'"',ctx.role==='Founder'?'accent':'ghost') : '');
    const kpis=ctx.state.companies[item.id]?.values.length ? metricView(item.id) : '';
    const overview='<section class="dossier-overview" aria-label="Score overview"><div class="dossier-score"><h2>OpenRisk score</h2>'
      + '<div class="scoreline"><div class="score">'+(r.value??'—')+'<sub>/100</sub></div>'+(r.grade?badge('Grade '+r.grade,r.grade<='B'?'ok':'warn'):r.provisional?badge('Provisional','warn'):'')+'</div>'
      + scoreVisual(r)+'<p class="source">'+r.coverage+'% evidence coverage</p></div><div class="dossier-lead">'
      + '<p>'+esc(item.description)+'</p>'+scoreTakeaways(r)+'<a href="#score-details">See score calculation ↓</a></div></section>';
    const context='<section id="investment-context" class="dossier-chapter"><h2>Investment context</h2>'+investmentLens(s)+'</section>';
    const calculation='<section id="score-details" class="dossier-chapter"><h2>How the score is built</h2><p class="muted">Public evidence · '+esc(date(r.asOf))+' · '+esc(trend)+'</p>'+scoreBreakdown(r)+'</section>';
    const evidence='<section id="source-evidence" class="dossier-chapter"><h2>Source evidence</h2>'
      + evidenceDetail('Company identity',(s.founded?'<p>Founded '+esc(s.founded.value)+'</p>'+source(s.founded):'')+'<div class="source">'+link(item.source,(item.directory||item.domain||'Source')+' ↗')+' · Observed '+esc(date(item.asOf))+'</div>'+identityFields+(s.website?'<div class="source">'+link(s.website.value,'Company website ↗')+'</div>':'')+(s.linkedin?'<div class="source">'+link(s.linkedin.value,'Company LinkedIn ↗')+'</div>':''))
      + evidenceDetail('Financial signals',(funding?val(funding.label,s.funding)+'<div class="source">Announced '+esc(funding.announced)+(age>18?' · '+badge('Older than 18 months','warn'):'')+'</div>':'')+(s.disclosure?val(s.disclosure.value.label,s.disclosure)+'<p>'+esc(s.disclosure.value.detail)+'</p>':'')+(!funding&&!s.disclosure?s.stage?val(s.stage.value,s.stage):empty('No verified financing in this snapshot.'):'')+(!funding&&s.directoryFunding?'<p>Directory-reported round amount · '+esc(s.directoryFunding.value)+'</p>'+source(s.directoryFunding):'')+filing,funding?.label||(accounts?'Belgian annual accounts':''))
      + evidenceDetail('Team & hiring',teamData||empty('No attributable hiring or headcount data in this snapshot.'),s.jobs?s.jobs.value.count+' open roles':listedRoles?listedRoles+(listedRoles>=50?'+':'')+' directory listings':'')
      + evidenceDetail('Product & engineering',product||empty('No attributable product observations in this snapshot.'))
      + evidenceDetail('Coverage & corporate events',event+news)+'</section>';
    const jumps='<nav class="dossier-jumps" aria-label="Dossier sections"><a href="#investment-context">Investment context</a><a href="#score-details">Score details</a><a href="#source-evidence">Source evidence</a>'+(kpis?'<a href="#metric-view">Confirmed KPIs</a>':'')+'</nav>';
    const signals=[
      funding && ['Funding',funding.label,s.funding],
      s.jobs && ['Hiring',s.jobs.value.count+' open roles',s.jobs],
      s.traction && ['Product reach',s.traction.value.label,s.traction],
      !s.traction && s.github && ['Engineering','Push '+date(s.github.value.pushedAt),s.github],
    ].filter(Boolean);
    const scan=signals.length?'<div class="dashboard-signals">'+signals.map(([label,value,observation])=>panel(label,val(value,observation))).join('')+'</div>':'';
    const layout=dossierMode==='Dashboard'?overview+scan+jumps+'<div class="dashboard-columns">'+context+calculation+'</div>'+evidence+kpis
      : dossierMode==='Evidence'?calculation+evidence+kpis+context
      : overview+jumps+context+calculation+evidence+kpis;
    const modeClass='reading-dossier dossier-'+dossierMode.toLowerCase();
    if (logView) {
      main.innerHTML='<article class="'+modeClass+'">'+profileHeader(item,controls)+dossierSwitcher()+'<div class="dossier-layout">'+layout+'</div></article>';
    } else {
      main.querySelector('.reading-dossier').className=modeClass;
      const switcher=main.querySelector('.dossier-switcher');
      switcher.style.setProperty('--selected',dossierModes.indexOf(dossierMode));
      for (const control of switcher.querySelectorAll('button')) {
        control.setAttribute('aria-pressed',String(control.dataset.dossierMode===dossierMode));
      }
      main.querySelector('.dossier-layout').innerHTML=layout;
    }
    if (logView && ctx.role==='Investor' && claimed) void api('state',{action:'view',company:item.id}).catch(()=>{});
    if (logView) window.scrollTo(0,0);
  }

  async function live(name) {
    navigate('cold');
    const controller = new AbortController();
    ctx.cancel = controller;
    const item = { name };
    const keys = { identity:'Identity', news:'Public coverage', engineering:'Product & engineering' };
    const state = {};
    const draw = () => {
      const cards = Object.entries(keys).map(([key, title]) => {
        const event = state[key];
        if (!event) return panel(title, '<div class="shimmer"></div><div class="shimmer"></div><div class="shimmer"></div>');
        if (!event.value) return panel(title, empty('No verified match returned by this source.'));
        const signal = event.value;
        if (key === 'identity') {
          const identity=signal.value;
          return panel(title,'<p>'+esc(identity.description)+'</p>'+(identity.founded?'<p>Founded '+esc(identity.founded)+'</p>':'')+(identity.website?link(identity.website,'Company site ↗'):'')+source(signal));
        }
        if (key==='engineering') return panel(title,'<p>'+esc(signal.value.repo)+' · Last public push '+date(signal.value.pushedAt)+'</p>'+source(signal));
        return panel(title, signal.value.length ? '<ul class="items">' + signal.value.map(row=>'<li>' + link(row.url,row.title) + ' <small>· ' + esc(date(row.date)) + '</small></li>').join('') + '</ul>' + source(signal) : empty('The source returned no matching stories.') + source(signal));
      }).join('');
      const ready=Object.keys(keys).every(key=>state[key]);
      const risk=state.score?.value;
      const preliminary=risk?.value!=null
        ? '<div class="scoreline"><div class="score">'+risk.value+'<sub>/100</sub></div>'+riskBadge(risk)+'</div>'+scoreVisual(risk)+'<p>'+risk.coverage+'% evidence coverage · Preliminary score</p>'
        : val('Unrated')+'<p>Scoring requires sufficient attributable evidence.</p>';
      main.innerHTML = profileHeader(item,ready?button('Suggest startup','data-open-dialog="startup" data-startup-name="'+esc(name)+'"','ghost'):'') + '<div class="ticker" aria-live="polite">' + Object.entries(keys).map(([key,label]) => badge((!state[key] ? '… ' : state[key].value ? '✓ ' : '– ') + label, state[key]?.value ? 'ok' : 'dim')).join('') + '</div><div class="dossier">' + panel('OpenRisk score',preliminary) + (risk?panel('How the score is built',scoreBreakdown(risk),'wide'):'') + cards + panel('Team & hiring',empty('A verified hiring board is required.')) + panel('Financial signals',empty('Company financing and filings need verification.')) + '</div>';
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
          if (Object.hasOwn(keys,event.key) || event.key==='score') { state[event.key] = event; draw(); }
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

  const emptyState = () => ({followed:[],claims:[],companies:{},alerts:{},requests:[],approved:[],jobs:[],invites:[]});
  const allCompanies = () => Array.from(new Map([
    ...ctx.state.jobs.flatMap(job=>job.details||[]),...ctx.state.approved,...ctx.catalog,
  ].map(company=>[company.id,company])).values());
  const allCities = () => [...ctx.cities,...ctx.state.approved.map(company=>company.place).filter(Boolean),...ctx.state.jobs.filter(job=>job.type==='City' && job.stage==='Complete' && job.city && !ctx.cities.some(city=>city.name===job.city.name)).map(job=>job.city)].filter((city,i,arr)=>arr.findIndex(row=>row.name===city.name)===i);
  const worldPins = () => {
    const extra=allCities().filter(city=>!ctx.cities.some(base=>base.name===city.name));
    const plot=city=>pin(city,(city.lon+180)*100/360,(83-city.lat)*250/360);
    return '<div class="world-detail">'+ctx.cities.map(plot).join('')+'</div>'+extra.map(plot).join('');
  };
  async function switchRole(role) {
    ctx.role=(await api('role',{role})).role;
    ctx.state=(await api('state')).state;
    nav();
  }
  async function mutate(command) {
    const response=await api('state',command);
    ctx.state=response.state;
    return response;
  }
  const title = (h, detail) => '<div class="view-title"><h1>'+esc(h)+'</h1><p>'+esc(detail)+'</p></div>';
  const labelFor = (id, key) => ctx.metrics[key]?.label || ctx.state.companies[id]?.definitions[key]?.label || key;
  const number = value => new Intl.NumberFormat('en', {maximumFractionDigits:1}).format(value);
  const shown = row => row ? (row.currency ? esc(new Intl.NumberFormat('en', {style:'currency',currency:row.currency,maximumFractionDigits:row.value % 1 === 0 ? 0 : 2}).format(row.value)) : esc(number(row.value))) : '—';
  const sampleTag = row => row?.sample ? ' '+badge('Sample data','warn') : '';

  function portfolio() {
    const keys=[['name','Startup'],['last','Last update'],['cash','Cash'],['runway','Runway'],['growth','MRR growth'],['risk','Score']];
    const items=allCompanies().filter(item=>ctx.state.followed.includes(item.id)).map(company=>{
      const values=ctx.state.companies[company.id]?.values || [];
      const latest=key=>values.filter(row=>row.metric===key).at(-1);
      const mrr=values.filter(row=>row.metric==='mrr').slice(-2);
      const prev=mrr[0], curr=mrr[1];
      const growth=prev?.value && curr && prev.currency===curr.currency ? 100*(curr.value/prev.value-1) : null;
      return { company,name:company.name,last:values.map(row=>row.fetchedAt).sort().at(-1),cash:latest('cash'),runway:latest('runway'),growth,risk:company.risk?.value,sample:values.some(row=>row.sample) };
    });
    items.sort((a,b)=>{
      const x=a[ctx.order]?.value ?? a[ctx.order], y=b[ctx.order]?.value ?? b[ctx.order];
      if (x==null && y==null) return a.name.localeCompare(b.name);
      if (x==null) return 1;
      if (y==null) return -1;
      return (typeof x==='string'?x.localeCompare(y):x-y)*(ctx.descending?-1:1);
    });
    const rows=items.map(row=>'<tr><td>'+button(row.name,'data-company="'+row.company.id+'"','link')+sampleTag(row)+'</td><td>'+date(row.last)+'</td><td>'+shown(row.cash)+'</td><td class="'+(row.runway?.value<6?'danger':'')+'">'+(row.runway?shown(row.runway)+' mo':'—')+'</td><td>'+(row.growth==null?'—':number(row.growth)+'%')+'</td><td>'+riskBadge(row.company.risk)+'</td></tr>').join('');
    const table = rows ? '<div class="scroll"><table class="rules"><thead><tr>'+keys.map(([key,label])=>'<th scope="col"'+(ctx.order===key?' aria-sort="'+(ctx.descending?'descending':'ascending')+'"':'')+'>'+button(label+(ctx.order===key?(ctx.descending?' ↓':' ↑'):''),'data-port-sort="'+key+'"')+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>' : empty('Follow any startup from its profile to add it here.');
    const alerts=ctx.state.alerts;
    main.innerHTML=title('Portfolio cockpit','Track followed companies and review founder-confirmed updates.')
      +'<div class="stack">'+panel('Followed startups',table)+panel('Alert settings','<form id="alerts-form" class="form-grid"><div><label>Runway warning (months)<input name="threshold" type="number" min="1" max="36" required value="'+(alerts.threshold||6)+'"></label></div><label class="switchline"><input name="monthly" type="checkbox" '+(alerts.monthly?'checked':'')+'> New monthly figures</label><div class="full actions"><button class="accent">Save alerts</button><small>Demo settings · Email delivery simulated</small></div></form>')+'</div>';
  }

  function metricView(id, guest = null) {
    const company=guest || ctx.state.companies[id];
    if (!company) return '';
    const defs={...ctx.metrics,...company.definitions};
    const grouped=Object.entries(defs).filter(([,def])=>def.category===ctx.category);
    const latest=company.values.map(row=>row.period).sort().at(-1);
    const cutoff=latest ? new Date(latest+'-01T00:00:00Z') : null;
    if(cutoff) cutoff.setUTCMonth(cutoff.getUTCMonth()-(ctx.range-1));
    const start=cutoff?.toISOString().slice(0,7);
    const graphs=grouped.map(([key,def])=>{
      const observed=company.values.filter(row=>row.metric===key && row.period>=start);
      const last=observed.at(-1);
      const rows=observed.filter(row=>row.currency===last?.currency);
      const chart=rows.length ? plot(rows) : empty('No recorded values in this period.');
      return panel(def.label,(last?'<div class="value">'+shown(last)+(def.unit==='months'?' mo':'')+sampleTag(last)+'</div><div class="source">'+badge(last.status,'ok')+' '+esc(last.source)+' · '+date(last.fetchedAt)+'</div>':'')+chart);
    }).join('');
    const updates=Object.entries(company.updates).sort(([a],[b])=>b.localeCompare(a)).slice(0,5).map(([period,entry])=>'<li><strong>'+esc(period)+'</strong>'+sampleTag(entry)+' <small>'+date(entry.at)+'</small><p>'+esc(entry.note)+'</p></li>').join('');
    const audit=(company.audit||[]).slice().reverse().slice(0,12).map(row=>'<tr><td>'+esc(row.period)+'</td><td>'+esc(labelFor(id,row.metric))+sampleTag(row)+'</td><td>'+shown(row.old===null?null:{value:row.old,currency:row.oldCurrency??row.currency})+'</td><td>'+shown(row.value===null?null:row)+'</td><td>'+esc(row.actor)+' · '+date(row.at)+'</td></tr>').join('');
    return '<section class="stack" id="metric-view" style="margin-top:18px"><div class="split"><h2>Confirmed KPIs</h2><div class="chart-controls"><select id="metric-category" aria-label="KPI category">'+['Financial','Sales','Commercial','Operational'].map(option=>'<option'+(ctx.category===option?' selected':'')+'>'+option+'</option>').join('')+'</select><select id="metric-range" aria-label="Chart range">'+[3,6,12,24].map(option=>'<option value="'+option+'"'+(ctx.range===option?' selected':'')+'>'+option+' months</option>').join('')+'</select></div></div><div class="cards">'+graphs+'</div>'
      +(updates?panel('Monthly updates','<ul class="items">'+updates+'</ul>'):'')+(audit?panel('Edit history','<div class="scroll"><table class="rules"><thead><tr><th>Period</th><th>Metric</th><th>Previous</th><th>Current</th><th>Changed by</th></tr></thead><tbody>'+audit+'</tbody></table></div>'):'')+'</section>';
  }

  function plot(rows) {
    const values=rows.map(row=>row.value);
    const min=Math.min(...values), max=Math.max(...values);
    const monthIndex = period => 12*Number(period.slice(0,4))+Number(period.slice(5));
    const base=monthIndex(rows[0].period), span=monthIndex(rows.at(-1).period)-base;
    const pts=rows.map(row=>[span?14+244*(monthIndex(row.period)-base)/span:136,max===min?56:98-(row.value-min)*72/(max-min),row]);
    return '<svg class="chart" viewBox="0 0 272 130" role="img" aria-label="Monthly KPI trend"><path d="M14 30H258 M14 60H258 M14 98H258" fill="none" stroke="#283953"/><polyline points="'+pts.map(([x,y])=>x+','+y).join(' ')+'" fill="none" stroke="#89afff" stroke-width="2"/>'+pts.map(([x,y,row])=>'<circle cx="'+x+'" cy="'+y+'" r="3.8" fill="#8fe1cc"><title>'+esc(row.period)+' · '+shown(row)+'</title></circle>').join('')+'<text x="14" y="119" class="number-label">'+esc(rows[0].period)+'</text>'+(rows.length>1?'<text x="258" y="119" text-anchor="end" class="number-label">'+esc(rows.at(-1).period)+'</text>':'')+'</svg>';
  }

  function founder() {
    const claimed = allCompanies().filter(item=>ctx.state.claims.includes(item.id));
    const item = claimed.find(company=>company.id===ctx.current) || claimed[0];
    if (!item) {
      main.innerHTML=title('Founder desk','Claim a startup from Explore to start publishing confirmed updates.')+button('Explore startups','data-page="map"','accent');
      return;
    }
    ctx.current=item.id;
    const c=ctx.state.companies[item.id] || {values:[],updates:{},definitions:{},proposals:[],views:[]};
    const values=Object.fromEntries(c.values.filter(row=>row.period===ctx.selectedPeriod).map(row=>[row.metric,row]));
    const defs={...ctx.metrics,...c.definitions};
    const currency=Object.values(values).find(row=>row.currency)?.currency || 'EUR';
    const fields=Object.entries(defs).map(([key,def])=>'<div><label for="kpi-'+esc(key)+'">'+esc(def.label)+(key==='runway'?' (auto if blank)':'')+'</label><input id="kpi-'+esc(key)+'" name="'+esc(key)+'" type="number" step="'+(def.unit==='count'?'1':'any')+'" '+(key==='runway'&&values[key]?.source==='calculated'?'placeholder="'+esc(values[key].value)+' calculated"':'value="'+esc(values[key]?.value ?? '')+'"')+'></div>').join('');
    const proposals=(c.proposals||[]).filter(row=>row.status==='proposed');
    const inviteList=ctx.state.invites.filter(row=>row.company===item.id).map(row=>'<li><div class="split"><span>'+esc(row.email)+' '+badge(row.status==='revoked'?'Revoked':Date.parse(row.expiresAt)<=Date.now()?'Expired':row.status)+'</span>'+(row.status==='revoked'?'':button('Revoke','data-revoke="'+row.id+'"','link'))+'</div><small>Expires '+date(row.expiresAt)+'</small></li>').join('');
    main.innerHTML=title('Founder desk','Manage demo ownership, review proposed metrics and publish confirmed values.')
      +'<div class="actions" style="margin-bottom:14px"><label for="claimed-company">Claimed profile</label><select id="claimed-company">'+claimed.map(row=>'<option value="'+row.id+'"'+(item.id===row.id?' selected':'')+'>'+esc(row.name)+'</option>').join('')+'</select>'+button('View dossier','data-company="'+item.id+'"')+'</div><div class="stack">'
      +panel('Email → KPI','<div class="actions">'+ctx.samples.map((sample,i)=>button(sample.label,'data-sample="'+i+'"')).join('')+'</div><form id="mail-form" class="stack" style="margin-top:12px"><div><label>Default reporting month<input name="period" type="month" value="'+ctx.selectedPeriod+'" required></label></div><div><label>Investor update<textarea name="text" maxlength="16000" placeholder="Paste a monthly investor update…"></textarea></label></div><div><label>PDF or XLSX attachments <input name="files" type="file" accept=".pdf,.xlsx" multiple></label><small>Files are read locally. Up to two attachments, 2 MB each.</small></div><div><button class="accent">Extract KPI proposals</button></div></form>'
      +(proposals.length?'<div id="proposals"><h3 style="margin-top:18px">Review proposals</h3><div class="scroll"><table class="rules"><thead><tr><th>KPI</th><th>Period</th><th>Proposed value</th><th>Source sentence</th><th>Review</th></tr></thead><tbody>'+proposals.map(p=>'<tr data-proposal="'+p.id+'"><td>'+esc(labelFor(item.id,p.metric))+'<br>'+badge('proposed','warn')+sampleTag(p)+(p.duplicate?' '+badge('Existing value','red'):'')+'</td><td><input aria-label="Reporting month" name="period" type="month" value="'+p.period+'"></td><td><input aria-label="Proposed value" name="value" type="number" step="any" value="'+p.value+'">'+(ctx.metrics[p.metric]?.unit==='money'?'<select aria-label="Currency" name="currency">'+['EUR','USD','GBP'].map(code=>'<option'+(code===(p.currency||'EUR')?' selected':'')+'>'+code+'</option>').join('')+'</select>':'')+'<small>'+esc(p.confidence)+' · '+date(p.fetchedAt)+'</small></td><td><small>'+esc(p.document||'Investor update')+'</small><blockquote><mark>'+esc(p.evidence)+'</mark></blockquote></td><td><div class="actions">'+button('Confirm','data-review="'+p.id+'"')+button('Reject','data-review="'+p.id+'" data-reject="yes"','link')+'</div></td></tr>').join('')+'</tbody></table></div><div class="actions spaced">'+button('Confirm all','data-confirm-all','accent')+'</div></div>':''))
      +panel('Monthly KPI form','<form id="kpi-form" class="form-grid"><div><label>Reporting month<input name="period" id="kpi-period" type="month" value="'+ctx.selectedPeriod+'" required></label></div><div><label>Currency<select name="currency">'+['EUR','USD','GBP'].map(code=>'<option'+(currency===code?' selected':'')+'>'+code+'</option>').join('')+'</select></label></div><div></div>'+fields+'<div class="full"><label>Monthly text update<textarea name="note" maxlength="2000">'+esc(c.updates[ctx.selectedPeriod]?.note||'')+'</textarea></label></div><div class="full actions"><button class="accent">Save KPI update</button><small>Blank metrics keep their existing values.</small></div></form>')
      +panel('Custom KPI','<form id="custom-form" class="form-grid"><label>Name<input name="label" maxlength="48" required></label><label>Category<select name="category"><option>Operational</option><option>Commercial</option><option>Sales</option><option>Financial</option></select></label><label>Unit<select name="unit"><option value="count">Number</option><option value="money">Currency</option><option value="months">Months</option></select></label><div><button>Create KPI</button></div></form>')
      +panel('Investor invitations','<form id="invite-form" class="actions"><label style="flex:1">Email<input name="email" type="email" maxlength="180" required></label><button>Create 7-day link</button></form><small>Email delivery is simulated. Copy the link to share it.</small><div id="invite-result"></div><ul class="items">'+inviteList+'</ul>')
      +panel('Investor engagement',c.views.length?'<ul class="items">'+c.views.slice().reverse().slice(0,12).map(view=>'<li>'+esc(view.label)+' · '+esc(view.kind)+' · '+date(view.at)+'</li>').join('')+'</ul>':empty('Investor views and invite opens appear here.'))+'</div>';
  }

  async function submitProposals(node) {
    const rows=node.dataset.confirmAll!==undefined ? [...document.querySelectorAll('[data-proposal]')] : [node.closest('[data-proposal]')];
    const items=rows.map(row=>{
      const input=row.querySelector('input[name="value"]');
      if (!node.dataset.reject && (!input.value || !input.reportValidity())) throw Error('Enter a valid proposed value.');
      return {id:row.dataset.proposal,value:Number(input.value),period:row.querySelector('[name="period"]').value,currency:row.querySelector('[name="currency"]')?.value,reject:Boolean(node.dataset.reject)};
    });
    const pending=new Map([...document.querySelectorAll('[data-proposal]')].map(row=>[row.dataset.proposal,
      [...row.querySelectorAll('input,select')].map(input=>[input.name,input.value])]));
    node.disabled=true;
    try {
      await mutate({action:'review',company:ctx.current,items});
      founder();
      for (const row of document.querySelectorAll('[data-proposal]')) {
        for (const [name,value] of pending.get(row.dataset.proposal)||[]) row.querySelector('[name="'+name+'"]').value=value;
      }
      (document.querySelector('#proposals') || document.querySelector('#mail-form'))?.scrollIntoView({block:'nearest'});
      toast(node.dataset.reject?'Proposal rejected.':items.length+' KPI proposal'+(items.length===1?'':'s')+' confirmed.');
    } finally { node.disabled=false; }
  }

  function openDialog(kind, startupName) {
    document.querySelector('#openrisk-dialog')?.remove();
    const city=kind==='city';
    main.insertAdjacentHTML('beforeend','<dialog id="openrisk-dialog"><div class="split"><h2>'+(city?'Add a city':'Suggest a startup')+'</h2>'+button('Close','data-close-dialog','link')+'</div><form id="'+(city?'city-form':'startup-form')+'" class="stack">'+(city?'<label>City name<input name="name" required maxlength="70" placeholder="e.g. Paris"></label>':'<p>Enter a name or website. After approval, the profile is preloaded on this workspace map.</p><label>Startup name<input name="name" maxlength="80"></label><label>Website<input name="website" inputmode="url" maxlength="300" placeholder="example.com"></label><label>City (optional)<input name="city" maxlength="80" placeholder="e.g. Paris"></label>')+'<button class="accent">'+(city?'Start preload':'Submit for approval')+'</button><div data-job-progress aria-live="polite"></div><div data-form-error role="alert"></div></form></dialog>');
    const dialog=document.querySelector('#openrisk-dialog');
    if(startupName) dialog.querySelector('[name="name"]').value=startupName;
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.showModal();
  }

  async function runJob(node,command,done) {
    node.disabled=true;
    const surface=document.querySelector('#openrisk-dialog [data-job-progress]') || document.querySelector('#queue-progress');
    const paint = message=>{ if(surface) surface.innerHTML='<div class="source">'+esc(message)+'</div><progress aria-label="Job progress"></progress>'; };
    paint('Queued · discovering public sources');
    let active=true, timer;
    async function poll() {
      try {
        const {state}=await api('state');
        const job=state.jobs.find(row=>row.type===(command.action==='add-city'?'City':'Startup'));
        if (active && job) paint(job.stage+' · '+job.name);
      } catch {}
      if (active) timer=setTimeout(poll,850);
    }
    timer=setTimeout(poll,700);
    try {
      const result=await mutate(command);
      done(result);
      toast(command.action==='approve'?'Approved and added to the map.':result.count+' profiles indexed for '+result.city+'.');
    } finally {
      active=false;
      clearTimeout(timer);
      if(surface) surface.textContent='';
      node.disabled=false;
    }
  }

  function admin() {
    const { requests, jobs, stats } = ctx.state;
    const rows=requests.map(row=>{
      const review=row.status==='pending' ? '<form data-review-startup="'+esc(row.id)+'"><label>Map city<input name="city" maxlength="80" required value="'+esc(row.city)+'" placeholder="e.g. Paris"></label><button class="accent">Approve &amp; preload</button></form>' : '';
      return '<tr><td><strong>'+esc(row.name || row.website)+'</strong><br>'+link(row.website,row.website)+'</td><td>'+esc(row.city || '—')+'</td><td>'+date(row.at)+'</td><td>'+badge(row.status,row.status==='approved'?'ok':'warn')+'</td><td>'+review+'</td></tr>';
    }).join('');
    const list=jobs.slice(0,15).map(row=>'<li><strong>'+esc(row.name)+'</strong> · '+esc(row.type)+' · '+badge(row.stage,row.stage==='Complete'?'ok':'warn')+(row.count!=null?' · '+row.count+' indexed':'')+(row.candidates?.length?' · '+row.candidates.length+' discovery candidates':'')+' <small>'+date(row.updatedAt||row.at)+'</small>'+(row.sources?.length?'<div class="source">'+row.sources.map(source=>badge((source.ok?'✓ ':'– ')+source.label,source.ok?'ok':'dim')).join(' ')+'</div>':'')+'</li>').join('');
    const extracted=stats?.extracted || 0, confirmed=stats?.confirmed || 0, unchanged=stats?.unchanged || 0;
    const seeds=ctx.cities.map(city=>{
      const sweep=ctx.preloadReport?.cities[city.name];
      const count=allCompanies().filter(item=>item.city===city.name).length;
      return '<tr><td>'+esc(city.name)+'</td><td>'+count+'</td><td>'+(sweep ? sweep.count : '—')+'</td><td>'+(sweep ? stamp(sweep.completedAt) : '—')+'</td></tr>';
    }).join('');
    const health=Object.entries(ctx.preloadReport?.sources||{}).map(([label, row])=>'<tr><td>'+esc(label)+'</td><td>'+stamp(row.lastSuccess)+'</td><td>'+stamp(row.lastFailure)+'</td></tr>').join('');
    main.innerHTML=title('Operations','Review map submissions, preload runs and extraction quality.')+'<div class="stack">'
      +panel('Startup request queue','<div id="queue-progress" aria-live="polite"></div>'+(rows?'<div class="scroll"><table class="rules"><thead><tr><th>Startup</th><th>City</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('No startup requests yet.'))+'<div class="actions spaced">'+button('Suggest startup','data-open-dialog="startup"')+'</div>')
      +panel('City preloads','<div class="scroll"><table class="rules"><thead><tr><th>City</th><th>Indexed profiles</th><th>Signals captured</th><th>Snapshot run</th></tr></thead><tbody>'+seeds+'</tbody></table></div>'+(list?'<h3 style="margin-top:14px">Workspace jobs</h3><ul class="items">'+list+'</ul>':'')+'<div class="actions spaced">'+button('+ Add city','data-open-dialog="city"')+'</div>')
      +(health?panel('Source health','<div class="scroll"><table class="rules"><thead><tr><th>Connector</th><th>Last success</th><th>Last failure</th></tr></thead><tbody>'+health+'</tbody></table></div>'):'')
      +panel('Extraction quality','<div class="cards"><div><div class="value">'+extracted+'</div><small>Documents processed</small></div><div><div class="value">'+confirmed+'</div><small>Confirmed fields</small></div><div><div class="value">'+(confirmed?Math.round(100*unchanged/confirmed)+'%':'—')+'</div><small>Confirmed unchanged</small></div></div>')+'</div>';
  }

  function funds() {
    const company=allCompanies().find(item=>item.id===ctx.current && ctx.state.claims.includes(item.id));
    if (!company) {
      main.innerHTML=title('Investor fit','Claim a startup to match its sector and location to investor mandates.')+button('Founder desk','data-page="founder"','accent');
      return;
    }
    const fits=(ctx.funds||[]).map(fund=>{
      const geo=allCities().find(city=>city.name===company.city)?.country || (company.city==='Paris'?'France':'Unknown');
      const inEurope=['Belgium','France','Germany','United Kingdom','England','Netherlands','Spain','Portugal','Ireland','Sweden','Finland','Italy','Austria','Switzerland','Denmark','Norway'].includes(geo);
      const geographic=fund.regions.includes(geo) || inEurope && fund.regions.includes('Europe');
      const sector=fund.sectors.some(sector=>company.sector.toLowerCase().includes(sector));
      return {...fund,geographic,sector,fit:40*Number(geographic)+60*Number(sector)};
    }).sort((a,b)=>b.fit-a.fit);
    main.innerHTML=title('Investor fit','Match public mandates against '+company.name+'’s sector and ecosystem.')+'<div class="cards">'+fits.map(fund=>panel(fund.name,'<div class="scoreline"><div class="score">'+fund.fit+'<sub>/100 fit</sub></div></div><p>'+esc(fund.description)+'</p><div class="actions">'+badge(fund.geographic?'Region matches':'Region unverified',fund.geographic?'ok':'dim')+badge(fund.sector?'Sector matches':'Sector unverified',fund.sector?'ok':'dim')+'</div><ul class="items"><li>Stage · '+esc(fund.stage)+'</li><li>Example portfolio · '+esc(fund.portfolio.join(', '))+'</li><li>Check size · '+esc(fund.ticket)+'</li>'+(fund.recent?'<li>'+link(fund.recent.url,fund.recent.label+' ↗')+'</li>':'')+'<li>Follow-on rate and responsiveness · No measured history</li></ul><div class="source">'+link(fund.source)+' · Reviewed '+esc(fund.asOf)+'</div>')).join('')+'</div>';
  }

  document.addEventListener('change',event=>{
    const input=event.target;
    if(input.id==='claimed-company') { ctx.current=input.value; founder(); }
    if(input.id==='kpi-period' && input.value) { ctx.selectedPeriod=input.value; founder(); }
    if(input.id==='metric-category' || input.id==='metric-range') {
      if(input.id==='metric-category') ctx.category=input.value;
      else ctx.range=Number(input.value);
      document.querySelector('#metric-view').outerHTML=metricView(ctx.state.companies.guest?'guest':ctx.current);
    }
  });

  const readers = new Map();

  function loadXlsx() {
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=root+'/document/xlsx.js';
      script.onload=()=>typeof globalThis.readXlsxFile==='function' ? resolve(globalThis.readXlsxFile) : reject(Error('The spreadsheet reader did not load.'));
      script.onerror=()=>reject(Error('The spreadsheet reader is unavailable.'));
      document.head.append(script);
    });
  }

  async function validateWorkbook(file) {
    const bytes=new DataView(await file.arrayBuffer());
    const size=bytes.byteLength;
    let end=size-22;
    while (end>=Math.max(0,size-65557) && bytes.getUint32(end,true)!==0x06054b50) end--;
    if (end<Math.max(0,size-65557)) throw Error('OpenRisk could not read this XLSX archive.');
    const entries=bytes.getUint16(end+10,true), directory=bytes.getUint32(end+16,true);
    if (entries>350 || directory>end) throw Error('The spreadsheet archive exceeds the demo limits.');
    let cursor=directory, expanded=0;
    for (let i=0;i<entries;i++) {
      if (cursor+46>end || bytes.getUint32(cursor,true)!==0x02014b50) throw Error('OpenRisk could not read this XLSX archive.');
      expanded+=bytes.getUint32(cursor+24,true);
      if (expanded>20_000_000) throw Error('The expanded spreadsheet exceeds the demo limits.');
      cursor+=46+bytes.getUint16(cursor+28,true)+bytes.getUint16(cursor+30,true)+bytes.getUint16(cursor+32,true);
    }
  }

  async function openAttachment(file) {
    if (file.size > 2_000_000) throw Error('Keep attachments under 2 MB each.');
    const kind=file.name.split('.').at(-1).toLowerCase();
    if (kind==='xlsx') {
      await validateWorkbook(file);
      if (!readers.has(kind)) readers.set(kind,loadXlsx().catch(error=>{readers.delete(kind);throw error;}));
      const read=await readers.get(kind);
      const rows=await read(file);
      return rows.slice(0,350).map(row=>row.slice(0,12).map(cell=>
        cell instanceof Date ? cell.toISOString().slice(0,10) : String(cell ?? '').slice(0,180)
      ).filter(Boolean).join(' ')).join('\n').slice(0,16000);
    }
    if (kind==='pdf') {
      if (!readers.has(kind)) readers.set(kind,import(root+'/document/pdf.mjs').catch(error=>{readers.delete(kind);throw error;}));
      const pdfjs=await readers.get(kind);
      pdfjs.GlobalWorkerOptions.workerSrc=root+'/document/pdf.worker.mjs';
      const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useWasm:false});
      const document=await task.promise;
      try {
        const chunks=[];
        let length=0;
        for (let i=1;i<=Math.min(document.numPages,12) && length<16000;i++) {
          const page=await document.getPage(i);
          const {items}=await page.getTextContent();
          const text=items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('');
          chunks.push(text);
          length+=text.length;
        }
        const text=chunks.join('\n').slice(0,16000).trim();
        if (!text) throw Error('The PDF has no selectable text.');
        return text;
      } finally { await task.destroy(); }
    }
    throw Error('Choose a PDF or XLSX attachment.');
  }

  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(!form.dataset.reviewStartup && !['alerts-form','kpi-form','custom-form','mail-form','invite-form','startup-form','city-form'].includes(form.id)) return;
    event.preventDefault();
    const feedback=form.querySelector('[data-form-error]');
    if(feedback) feedback.textContent='';
    const fields=new FormData(form);
    const submit=form.querySelector('button[type="submit"],button:not([type])');
    if(submit) submit.disabled=true;
    try {
      if(form.dataset.reviewStartup) {
        await runJob(submit,{action:'approve',request:form.dataset.reviewStartup,city:fields.get('city')},()=>admin());
      } else if(form.id==='alerts-form') {
        await mutate({action:'alerts',threshold:Number(fields.get('threshold')),monthly:fields.has('monthly')});
        toast('Alert settings saved.');
      } else if(form.id==='kpi-form') {
        const keys=[...Object.keys(ctx.metrics),...Object.keys(ctx.state.companies[ctx.current].definitions)];
        const latest=ctx.state.companies[ctx.current].values.filter(row=>row.period===fields.get('period'));
        const values=Object.fromEntries(keys.filter(key=>fields.get(key)!=='' && fields.has(key)).flatMap(key=>{
          const old=latest.find(row=>row.metric===key);
          const value=Number(fields.get(key));
          const def=ctx.metrics[key]||ctx.state.companies[ctx.current].definitions[key];
          return old?.value===value && (def.unit!=='money'||old.currency===fields.get('currency')) ? [] : [[key,value]];
        }));
        await mutate({action:'save',company:ctx.current,period:fields.get('period'),currency:fields.get('currency'),note:fields.get('note'),values});
        founder();
        toast('KPI update saved.');
      } else if(form.id==='custom-form') {
        await mutate({action:'define',company:ctx.current,...Object.fromEntries(fields)});
        founder();
        toast('Custom KPI created.');
      } else if(form.id==='mail-form') {
        const text=String(fields.get('text')||'');
        const files=[...form.elements.files.files];
        if (files.length>2) throw Error('Choose at most two attachments.');
        if (files.length) submit.textContent='Reading attachments…';
        const attachments=[];
        for (const file of files) attachments.push({name:file.name,text:await openAttachment(file)});
        await mutate({action:'extract',company:ctx.current,period:fields.get('period'),text,attachments,
          sample:ctx.samples.some(row=>row.text===text)||Boolean(form.dataset.sampleText)});
        founder();
        document.querySelector('#proposals')?.scrollIntoView({block:'nearest'});
        toast('Review the proposed values before publishing.');
      } else if(form.id==='invite-form') {
        const result=await mutate({action:'invite',company:ctx.current,email:fields.get('email')});
        founder();
        document.querySelector('#invite-result').innerHTML='<label class="source">Private demo link<input readonly value="'+esc(location.origin+result.invitePath)+'"></label>';
        document.querySelector('#invite-result input').select();
        toast('Invitation created.');
      } else if(form.id==='startup-form') {
        await mutate({action:'submit',...Object.fromEntries(fields)});
        document.querySelector('#openrisk-dialog').close();
        if(ctx.page==='admin') admin();
        toast('Submitted to the admin queue.');
      } else {
        await runJob(submit,{action:'add-city',name:fields.get('name')},result=>{
          ctx.countryList=null;
          if (ctx.sort==='nearby') { ctx.sort='risk'; ctx.sortDirection=null; }
          ctx.city=result.city;
          document.querySelector('#openrisk-dialog').close();
          navigate('map');
        });
      }
    } catch(error) {
      if(feedback) feedback.textContent=error.message;
      else toast(error.message);
    }
    finally {
      if(submit) {
        submit.disabled=false;
        if(form.id==='mail-form') submit.textContent='Extract KPI proposals';
      }
    }
  });

  function openPath() {
    const relative=location.pathname.slice(root.length);
    const city=/^\/city\/([a-z0-9-]+)$/.exec(relative);
    ctx.countryList=null;
    const country=mapCountries.find(name=>'/country/'+citySlug(name)===relative);
    if (country) { ctx.countryList=country; navigate('map',false); return; }
    if (!relative) ctx.city='Gent';
    if (city) {
      ctx.city=allCities().find(item=>citySlug(item.name)===city[1])?.name || 'Gent';
      navigate('map',false);
      return;
    }
    const startup=/^\/startup\/([a-z0-9-]+)$/.exec(relative);
    const item=startup && allCompanies().find(company=>company.id===startup[1]);
    if (item) { profile(item,false); return; }
    const page=Object.keys(viewRoutes).find(key=>viewRoutes[key]===relative);
    const allowed={Investor:['map','portfolio'],Founder:['map','founder','funds'],Admin:['map','admin']};
    navigate(allowed[ctx.role]?.includes(page)?page:'map',false);
  }
  addEventListener('popstate',openPath);

  document.addEventListener('click', async event => {
    const node = event.target.closest('button');
    if (!node) return;
    if (node.dataset.page) navigate(node.dataset.page);
    if (mapCountries.includes(node.dataset.mapCountry)) {
      if (ctx.sort==='nearby') { ctx.sort='risk'; ctx.sortDirection=null; }
      ctx.countryList=node.dataset.mapCountry;
      setPath('/country/'+citySlug(ctx.countryList));
      map();
      main.querySelector('[data-map-country="'+ctx.countryList+'"]').focus({preventScroll:true});
    }
    if (node.dataset.city) {
      const selected=ctx.countryList || ctx.sort==='nearby' || cityRegion(ctx.city)!==cityRegion(node.dataset.city);
      if (ctx.sort==='nearby') { ctx.sort='risk'; ctx.sortDirection=null; }
      ctx.countryList=null;
      ctx.city=node.dataset.city;
      setPath('/city/'+citySlug(ctx.city));
      if (selected) map(); else cityRows();
    }
    if (dossierModes.includes(node.dataset.dossierMode) && ctx.page==='profile') {
      dossierMode=node.dataset.dossierMode;
      try { localStorage.setItem('openrisk:dossier-mode',dossierMode); } catch {}
      profile(allCompanies().find(item=>item.id===ctx.current),false,false);
    }
    if (node.dataset.company) profile(allCompanies().find(item => item.id === node.dataset.company));
    try {
      if (node.dataset.follow) {
        const item = allCompanies().find(item=>item.id===node.dataset.follow);
        const enabled = !ctx.state.followed.includes(item.id);
        await mutate({action:'follow',company:item.id,enabled});
        profile(item);
        toast(enabled ? item.name + ' added to portfolio.' : item.name + ' unfollowed.');
      }
      if (node.dataset.claim) {
        if (ctx.role !== 'Founder') await switchRole('Founder');
        const company = node.dataset.claim;
        if (!ctx.state.claims.includes(company)) await mutate({action:'claim',company});
        ctx.current=company;
        navigate('founder');
      }
      if (node.dataset.portSort) {
        const key=node.dataset.portSort;
        ctx.descending=key===ctx.order ? !ctx.descending : key!=='name';
        ctx.order=key;
        portfolio();
      }
      if (node.dataset.openDialog) openDialog(node.dataset.openDialog,node.dataset.startupName);
      if (node.dataset.closeDialog) node.closest('dialog').close();
      if (node.dataset.sample!==undefined) {
        const sample=ctx.samples[Number(node.dataset.sample)];
        const form=document.querySelector('#mail-form');
        form.elements.text.value=sample.text;
        form.elements.period.value=sample.period;
        form.dataset.sampleText=sample.text;
      }
      if (node.dataset.review || node.dataset.confirmAll!==undefined) await submitProposals(node);
      if (node.dataset.revoke) { await mutate({action:'revoke',company:ctx.current,invite:node.dataset.revoke}); founder(); toast('Invitation revoked.'); }
    } catch (error) { toast(error.message); }
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
    try {
      await switchRole(roleInput.value);
      if (ctx.page==='profile') profile(allCompanies().find(item=>item.id===ctx.current));
      else navigate(ctx.role==='Investor'?'portfolio':ctx.role==='Founder'?'founder':'admin');
    }
    catch (error) { roleInput.value = ctx.role; toast(error.message); }
    finally { roleInput.disabled = false; }
  };
  try {
    const invite = /^\/project-cto\/invite\/(.+)$/.exec(location.pathname);
    if (invite) {
      document.querySelector('.bar-end').hidden=true;
      const guest=await api('invite/'+invite[1]);
      ctx.metrics=guest.metrics || {};
      ctx.state={ companies:{ guest }, claims:[], followed:[] };
      main.innerHTML=title(guest.name,'Investor invitation · Read-only monthly KPIs')+metricView('guest',guest);
      return;
    }
    const [boot, state] = await Promise.all([api('bootstrap'),api('state').catch(()=>({state:emptyState(),metrics:{},samples:[]}))]);
    Object.assign(ctx, boot, state);
    openPath();
  } catch (error) {
    main.textContent = error.message;
  }
}
