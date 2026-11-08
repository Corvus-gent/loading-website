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
export function locationLabel(group){
  const n=group.visitors.toLocaleString('en')+' '+(group.visitors===1?'soul':'souls');
  if(group.unknown)return `${group.country} · city unknown · ${n}`.toLowerCase();
  if(group.level==='cluster')return `${group.points.slice(0,2).map(p=>p.city||p.regionName||p.region).join(' + ')}${group.points.length>2?' + '+(group.points.length-2)+' areas':''} · ${n}`.toLowerCase();
  if(group.precision==='region')return `${group.regionName||group.region}, ${group.country} · city unknown · ${n}`.toLowerCase();
  const name=group.city||group[group.level]||group.country||'somewhere';
  return `${name}${group.precision==='metro'?' area':''}${group.region?', '+group.region:''} · ${n}`.toLowerCase();
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
const hotspots = [{id:'sf',name:'san francisco',lat:37.8,lng:-122.4,color:'#57e1df'},{id:'hk',name:'hong kong',lat:22.3,lng:114.2,color:'#ed9aff'}];
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
    const label=document.createElement('span');label.textContent=hotspot.name+' · corvus hotspot';
    const marker=L.marker([hotspot.lat,hotspot.lng],{pane:'corvusHotspots',icon:L.divIcon({className:'corvus-hotspot',html:icon,iconSize:[44,44],iconAnchor:[22,22]}),title:hotspot.name+' · corvus hotspot (highlight, not visitor count)',keyboard:true}).addTo(map);
    marker.bindTooltip(label,{permanent:true,direction:'top',offset:[0,-12],className:'corvus-hotspot-label'});
    const focusHotspot=()=>map.setView([hotspot.lat,hotspot.lng],6,{animate:!reduced});
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
      referenceCities(zoom,map.getBounds()).forEach((city,index)=>{
        const color=referenceColor(city.country);
        const dot=L.circleMarker([city.lat,city.lng],{radius:3,color,weight:1,fillColor:color,fillOpacity:.5,className:'reference-city-dot',interactive:false}).addTo(references);
        if((zoom>=3&&index<35)||(zoom>=2&&index<8)){const label=document.createElement('span');label.textContent=city.city.toLowerCase();dot.bindTooltip(label,{permanent:true,direction:'top',className:'reference-city',offset:[0,-2]});}
      });
      mergeLocations(cities.filter(c=>!c.unknown||countryToggle?.checked), zoom).forEach((group, index) => {
        const radius = dotRadius(group.visitors), size = radius * 2, hit = Math.max(44,size);
        const dot = document.createElement('span');
        dot.className = 'visitor-flame' + (group.unknown ? ' visitor-unknown' : '');
        dot.style.cssText = `width:${size}px;height:${size}px;animation-delay:-${index % 9}s`;
        const label = locationLabel(group);
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
      const shown=cities.some(c=>!c.unknown||countryToggle?.checked);status.hidden=shown;
    }
  map.on('zoomend moveend',draw);
  const update=data=>{
    updateTiles(data?.tiles);
    if(!Array.isArray(data?.cities)){out();return;}
    cities=data.cities;
    if(focus){const current=focus.value;const options=[new Option('world','')];const names=new Intl.DisplayNames(['en'],{type:'region'});for(const c of data.countries||[])if(c.c!=='?'&&cityCatalog.some(p=>p[0]===c.c))options.push(new Option(names.of(c.c),c.c));focus.replaceChildren(...options);focus.value=options.some(o=>o.value===current)?current:'';}

    if(!fitted&&cities.length){map.fitBounds(cities.map(c=>[c.lat,c.lng]),{padding:[25,25],maxZoom:3,animate:false});fitted=true;}
    draw();
    const note=document.querySelector('#visitor-map-coverage');
    const precise=cities.filter(c=>!c.unknown).reduce((n,c)=>n+c.visitors,0),coarse=cities.filter(c=>c.unknown).reduce((n,c)=>n+c.visitors,0);
    const coarseLabel=document.querySelector('#map-country-only-count');if(coarseLabel)coarseLabel.textContent=coarse.toLocaleString('en');
    if(note)note.textContent=`${precise.toLocaleString('en')} located to a city area or region · ${coarse.toLocaleString('en')} country only${data.unlocated ? ` · ${data.unlocated} country unknown` : ''}. gold = recorded visitors; coloured cities and SF/HK hotspots = reference highlights, not visitor counts.${data.cityUnavailable ? ' city details temporarily unavailable.' : ''}`;
    status.textContent = precise || countryToggle?.checked ? '' : 'city-level pings appear here as they arrive.';
    status.hidden = !!precise || !!countryToggle?.checked;
  };
  update(snapshot);return update;
}
export {initMap};
