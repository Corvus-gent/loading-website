import { formatPageText, translatePageText } from './i18n/page-copy.js';
import {cityCatalog} from './data/geo-cities.generated.js?v=20261108cities1';
// Each visitor belongs to one city per country in the selected time window.
export function projected(point,zoom){const size=256*2**zoom,sin=Math.sin(Math.max(-85,Math.min(85,point.lat))*Math.PI/180);return{x:(point.lng+180)/360*size,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size};}
export function mergeLocations(cities,zoom){
  const groups=new Map();
  for(const city of cities){
    if(!Number.isFinite(city.lat)||!Number.isFinite(city.lng)||Math.abs(city.lat)>90||Math.abs(city.lng)>180||!Number.isSafeInteger(city.visitors)||city.visitors<(city.unknown?1:2))continue;
    const p=projected(city,zoom),country=city.countryCode||city.country;
    // Nearby areas cluster on screen, never collapse a whole large country.
    const key=city.unknown?country+':unknown':JSON.stringify([country,Math.floor(p.x/44),Math.floor(p.y/44)]);
    const g=groups.get(key)||{...city,visitors:0,lat:0,lng:0,points:[]};
    g.visitors+=city.visitors;g.lat+=city.lat*city.visitors;g.lng+=city.lng*city.visitors;g.points.push(city);groups.set(key,g);
  }
  return [...groups.values()].map(g=>({...g,lat:g.lat/g.visitors,lng:g.lng/g.visitors,level:g.points.length>1?'cluster':g.unknown?'country':g.precision==='region'?'region':'city'}));
}
const language = () => globalThis.document?.documentElement.lang || 'en';
export function locationLabel(group, regions = new Intl.DisplayNames(language(), {type: 'region'})) {
  const count = group.visitors.toLocaleString(language());
  const n = formatPageText(group.visitors === 1 ? '{count} soul' : '{count} souls', {count});
  const country = /^[A-Z]{2}$/.test(group.countryCode || '') ? regions.of(group.countryCode) : group.country;
  const cityUnknown = translatePageText('city unknown');
  if (group.unknown) return `${country} · ${cityUnknown} · ${n}`;
  if (group.level === 'cluster') {
    const names = group.points.slice(0, 2).map(point => point.city || point.regionName || point.region);
    if (group.points.length > 2) names.push(formatPageText('{count} areas', {
      count: (group.points.length - 2).toLocaleString(language())
    }));
    return names.join(' + ') + ' · ' + n;
  }
  if (group.precision === 'region') return `${group.regionName || group.region}, ${country} · ${cityUnknown} · ${n}`;
  const name = group.city || group[group.level] || country || translatePageText('somewhere');
  const area = group.precision === 'metro' ? formatPageText('{name} area', {name}) : name;
  return `${area}${group.region ? ', ' + group.region : ''} · ${n}`;
}
export function referenceCities(zoom,bounds){
  const cells=new Set(),result=[];
  for(const [country,region,city,lat,lng,population]of [...cityCatalog].sort((a,b)=>b[5]-a[5])){
    if(!bounds.contains([lat,lng]))continue;
    const p=projected({lat,lng},zoom),key=Math.floor(p.x/65)+':'+Math.floor(p.y/50);
    if(cells.has(key))continue;cells.add(key);result.push({country,region,city,lat,lng,population});if(result.length>=140)break;
  }
  return result;
}
const referencePalette = ['#64c7ed','#b5a0ff','#ee98d4','#71d9c0'];
const referenceColor = code => referencePalette[[...code].reduce((n,c)=>n+c.charCodeAt(0),0)%referencePalette.length];
export const hotspots = [
  {
    "id": "sf",
    "name": "san francisco",
    "lat": 37.7749,
    "lng": -122.4194,
    "zoom": 10,
    "color": "#d6b4ee"
  },
  {
    "id": "nyc",
    "name": "NYC",
    "lat": 40.7128,
    "lng": -74.006,
    "zoom": 10,
    "color": "#d6b4ee"
  },
  {
    "id": "guangdong",
    "name": "guangdong",
    "lat": 23.1291,
    "lng": 113.2644,
    "zoom": 7,
    "color": "#d6b4ee"
  },
  {
    "id": "shanghai",
    "name": "shanghai",
    "lat": 31.2304,
    "lng": 121.4737,
    "zoom": 9,
    "color": "#d6b4ee"
  },
  {
    "id": "lisboa",
    "name": "lisboa",
    "lat": 38.7223,
    "lng": -9.1393,
    "zoom": 11,
    "color": "#d6b4ee"
  },
  {
    "id": "paris",
    "name": "paris",
    "lat": 48.8566,
    "lng": 2.3522,
    "zoom": 11,
    "color": "#d6b4ee"
  },
  {
    "id": "london",
    "name": "london",
    "lat": 51.5074,
    "lng": -0.1278,
    "zoom": 10,
    "color": "#d6b4ee"
  },
  {
    "id": "brussels",
    "name": "brussel",
    "lat": 50.8503,
    "lng": 4.3517,
    "zoom": 11,
    "color": "#d6b4ee"
  },
  {
    "id": "ghent",
    "name": "gent",
    "lat": 51.0543,
    "lng": 3.7174,
    "zoom": 12,
    "color": "#d6b4ee"
  }
];
export const dotRadius = visitors => Math.max(4, Math.min(24, Math.sqrt(visitors)));

async function initMap(snapshot) {
  const container = document.getElementById('visitor-map');
  const status = document.getElementById('visitor-map-status');
  if (!container) return;
  const out = () => { status.textContent = 'the lantern is out.'; status.hidden = false; };
  if(!window.L)await new Promise(resolve=>{
    const script=document.createElement('script');script.src='/js/vendor/leaflet/leaflet.js';script.onload=script.onerror=resolve;document.head.append(script);
  });
  if (!window.L) { out(); return; }
  const L = window.L;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map(container, { minZoom: 1, maxZoom: 12, scrollWheelZoom: false, zoomAnimation: !reduced, fadeAnimation: !reduced, markerZoomAnimation: !reduced }).setView([30, 10], 2);
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  map.attributionControl.addAttribution(attribution);
  // Tile configuration is independent of visitor data, so geo outages keep the basemap.
  let tiles;
  function updateTiles(enabled){
  if(enabled&&!tiles)tiles=L.tileLayer('/api/geo?tiles=1&z={z}&x={x}&y={y}',{maxZoom:12}).on('tileerror',()=>{document.querySelector('#visitor-map-background').hidden=false;}).addTo(map);
  document.querySelector('#visitor-map-background').hidden=!!enabled;
  }
  map.createPane('corvusHotspots').style.zIndex=450;
  for(const hotspot of hotspots){
    const icon=document.createElement('span');icon.className='corvus-hotspot-light';icon.style.setProperty('--hotspot',hotspot.color);
    const label=document.createElement('span');label.textContent=hotspot.name;
    const marker=L.marker([hotspot.lat,hotspot.lng],{pane:'corvusHotspots',icon:L.divIcon({className:'corvus-hotspot',html:icon,iconSize:[44,44],iconAnchor:[22,22]}),title:hotspot.name+' · corvus hotspot (highlight, not visitor count)',keyboard:true}).addTo(map);
    marker.bindTooltip(label,{permanent:false,direction:'auto',offset:[0,hotspot.labelDirection==='bottom'?12:-12],className:'corvus-hotspot-label'});
    const focusHotspot=()=>{map.setView([hotspot.lat,hotspot.lng],hotspot.zoom||6,{animate:!reduced});marker.openTooltip();document.querySelectorAll('[data-map-hotspot]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mapHotspot===hotspot.id)));};
    marker.getElement()?.addEventListener('focus',()=>marker.openTooltip());
    marker.getElement()?.addEventListener('blur',()=>marker.closeTooltip());
    marker.on('click',focusHotspot);
    document.querySelector('[data-map-hotspot="'+hotspot.id+'"]')?.addEventListener('click',focusHotspot);
  }
  const references=L.layerGroup().addTo(map);
  const markers = L.layerGroup().addTo(map);
  const countryToggle=document.querySelector('#map-country-only');
  const focus=document.querySelector('#map-country-focus');
  focus?.addEventListener('change',()=>{
    const code=focus.value;
    const points=code ? cityCatalog.filter(c=>c[0]===code).sort((a,b)=>b[5]-a[5]).slice(0,25).map(c=>[c[3],c[4]]) : cities.map(c=>[c.lat,c.lng]);
    if(code)points.push(...cities.filter(c=>c.countryCode===code&&!c.unknown).map(c=>[c.lat,c.lng]));
    if(points.length)map.fitBounds(points,{padding:[35,35],maxZoom:code?6:3});
  });
  countryToggle?.addEventListener('change',draw);
  // The daily stats panel can be hidden while browsing tomorrow's prediction.
  const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  resize.observe(container);
  let cities=[], fitted=false;
    function draw() {
      markers.clearLayers();references.clearLayers();
      const zoom=map.getZoom();
      const regions = new Intl.DisplayNames(language(), {type: 'region'});
      (zoom>=4?referenceCities(zoom,map.getBounds()):[]).forEach((city,index)=>{
        const color=referenceColor(city.country);
        const dot=L.circleMarker([city.lat,city.lng],{radius:3,color,weight:1,fillColor:color,fillOpacity:.5,className:'reference-city-dot',interactive:false}).addTo(references);
        if(zoom>=5&&index<8){const label=document.createElement('span');label.textContent=city.city.toLowerCase();dot.bindTooltip(label,{permanent:true,direction:'top',className:'reference-city',offset:[0,-2]});}
      });
      mergeLocations(cities.filter(c=>!c.unknown||countryToggle?.checked), zoom).forEach((group, index) => {
        const radius = dotRadius(group.visitors), size = radius * 2, hit = Math.max(44,size);
        const dot = document.createElement('span');
        dot.className = 'visitor-flame' + (group.unknown ? ' visitor-unknown' : '');
        dot.style.cssText = `width:${size}px;height:${size}px;animation-delay:-${index % 9}s`;
        const label = locationLabel(group, regions);
        const tooltip = document.createElement('span');
        tooltip.textContent = label; // Never interpret location names as HTML.
        const marker = L.marker([group.lat, group.lng], {
          icon: L.divIcon({ className: 'visitor-dot', html: dot, iconSize: [hit, hit], iconAnchor: [hit / 2, hit / 2] }),
          title: label, alt: label, keyboard: true, riseOnHover: true
        }).bindTooltip(tooltip, { direction: 'auto', offset: [0, 0], className: 'visitor-tooltip' }).addTo(markers);
        marker.on('click', () => {marker.openTooltip();if(group.points.length>1)map.fitBounds(group.points.map(p=>[p.lat,p.lng]),{padding:[40,40],maxZoom:map.getZoom()+2});});
        marker.on('add', () => { const element = marker.getElement(); element?.addEventListener('focus', () => marker.openTooltip()); element?.addEventListener('blur', () => marker.closeTooltip()); });
        const element = marker.getElement();
        element?.addEventListener('focus', () => marker.openTooltip());
        element?.addEventListener('blur', () => marker.closeTooltip());
      });
      status.hidden=cities.length>0;
    }
  map.on('zoomend moveend',draw);
  const update=data=>{
    updateTiles(data?.tiles);
    if(!Array.isArray(data?.cities)){out();return;}
    cities=data.cities;
    if(focus){const current=focus.value;const options=[new Option(translatePageText('world'),'')];const names=new Intl.DisplayNames(language(),{type:'region'});for(const c of data.countries||[])if(c.c!=='?'&&cityCatalog.some(p=>p[0]===c.c))options.push(new Option(names.of(c.c),c.c));focus.replaceChildren(...options);focus.value=options.some(o=>o.value===current)?current:'';}

    if(!fitted&&cities.length){map.fitBounds(cities.map(c=>[c.lat,c.lng]),{padding:[25,25],maxZoom:3,animate:false});fitted=true;}
    draw();
    const note=document.querySelector('#visitor-map-coverage');
    const precise=cities.filter(c=>!c.unknown).reduce((n,c)=>n+c.visitors,0),coarse=cities.filter(c=>c.unknown).reduce((n,c)=>n+c.visitors,0);
    const coarseLabel=document.querySelector('#map-country-only-count');if(coarseLabel)coarseLabel.textContent=coarse.toLocaleString(language());
    if (note) note.textContent = [
      formatPageText('{precise} located to a city area or region · {coarse} country only', {
        precise: precise.toLocaleString(language()), coarse: coarse.toLocaleString(language())
      }) + (data.unlocated ? ' · ' + formatPageText('{count} country unknown', {
        count: data.unlocated.toLocaleString(language())
      }) : '') + '.',
      translatePageText('gold = recorded visitors; coloured cities and corvus hotspots = reference highlights, not visitor counts.'),
      data.cityUnavailable ? translatePageText('city details temporarily unavailable.') : ''
    ].filter(Boolean).join(' ');
    status.textContent = precise || countryToggle?.checked ? '' : 'city-level pings appear here as they arrive.';
    status.hidden = cities.length>0;
  };
  update(snapshot);
  if (new URLSearchParams(location.search).has('contributors')) contributorLights(L, map, reduced);
  return update;
}
// Feedback contributors light up where their flag points: the biggest city of that country.
async function contributorLights(L, map, reduced) {
  let people = [];
  try { people = (await (await fetch('/api/feedback', {cache: 'no-store'})).json()).contributors || []; } catch { return; }
  const capital = {};
  for (const [cc, , , lat, lng, pop] of cityCatalog) if (!capital[cc] || pop > capital[cc][2]) capital[cc] = [lat, lng, pop];
  const code = flag => { const cps = [...(flag || '')].map(c => c.codePointAt(0) - 0x1f1e6); return cps.length === 2 && cps.every(n => n >= 0 && n < 26) ? String.fromCharCode(65 + cps[0], 65 + cps[1]) : null; };
  if (!map.getPane('corvusContributors')) { map.createPane('corvusContributors'); map.getPane('corvusContributors').style.zIndex = 660; }
  const style = document.createElement('style');
  style.textContent = '.contributor-light span{display:block;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle,#fff8dd 0,#ffd76a 30%,#ffd76a00 70%);animation:clight 2.6s ease-in-out infinite}.contributor-light.guest span{background:radial-gradient(circle,#f3ecff 0,#b9a3ff 30%,#b9a3ff00 70%)}@keyframes clight{50%{transform:scale(1.35);opacity:.7}}@media(prefers-reduced-motion:reduce){.contributor-light span{animation:none}}';
  document.head.append(style);
  const bounds = [];
  people.forEach((p, i) => {
    const cc = code(p.flag), at = cc && capital[cc]; if (!at) return;
    const jitter = (n) => ((Math.sin((i + 1) * n) * 10000) % 1) * 1.6;
    const lat = at[0] + jitter(12.9898), lng = at[1] + jitter(78.233), size = Math.min(54, 22 + p.count * 4);
    L.marker([lat, lng], {pane: 'corvusContributors', icon: L.divIcon({className: 'contributor-light' + (p.verified ? '' : ' guest'), html: '<span></span>', iconSize: [size, size], iconAnchor: [size / 2, size / 2]}), title: `${p.flag} ${p.name} · ${p.count} contribution${p.count === 1 ? '' : 's'}${p.verified ? ' · verified' : ''}`, keyboard: true}).addTo(map);
    bounds.push([lat, lng]);
  });
  if (bounds.length) map.fitBounds(bounds, {padding: [60, 60], maxZoom: 5, animate: !reduced});
  const status = document.getElementById('visitor-map-status');
  if (status) { status.hidden = false; status.textContent = bounds.length ? `${bounds.length} feedback contributor${bounds.length === 1 ? '' : 's'} light up the map: gold = verified, lilac = guest.` : 'No contributors with a flag yet.'; }
}
export {initMap};
