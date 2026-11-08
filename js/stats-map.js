// Each visitor belongs to one city per country in the selected time window.
export function mergeLocations(cities, zoom) {
  const level = zoom < 4 ? 'country' : zoom < 7 ? 'region' : 'city';
  const groups = new Map();
  for (const city of cities) {
    if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng) || Math.abs(city.lat) > 90 || Math.abs(city.lng) > 180 || !Number.isSafeInteger(city.visitors) || city.visitors < (city.unknown ? 1 : 2)) continue;
    const countryKey = city.countryCode || city.country || '';
    const key = JSON.stringify([countryKey, level !== 'country' && city.unknown ? 'unknown' : '', level !== 'country' ? city.region || '' : '', level === 'city' ? city.city || '' : '']);
    let group = groups.get(key);
    if (!group) {
      group = { country: city.country || city.countryCode || '', region: city.region || '', city: city.city || '', visitors: 0, lat: 0, lng: 0, level, unknown: !!city.unknown };
      groups.set(key, group);
    }
    group.unknown = group.unknown && !!city.unknown;
    group.visitors += city.visitors;
    group.lat += city.lat * city.visitors;
    group.lng += city.lng * city.visitors;
  }
  return [...groups.values()].map(g => ({ ...g, lat: g.lat / g.visitors, lng: g.lng / g.visitors }));
}
export function locationLabel(group) {
  const name = group[group.level];
  if (group.unknown && group.level !== 'country') return `unknown city · ${group.country} · ${group.visitors.toLocaleString('en')} souls`.toLowerCase();
  if (!name) return `somewhere in ${group.country || 'the world'} · ${group.visitors.toLocaleString('en')} souls`.toLowerCase();
  return `${name} · ${group.visitors.toLocaleString('en')} ${group.visitors === 1 ? 'soul' : 'souls'}`.toLowerCase();
}
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
  const markers = L.layerGroup().addTo(map);
  // The daily stats panel can be hidden while browsing tomorrow's prediction.
  const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  resize.observe(container);
  let cities=[], fitted=false;
    function draw() {
      markers.clearLayers();
      mergeLocations(cities, map.getZoom()).forEach((group, index) => {
        const radius = dotRadius(group.visitors), size = radius * 2;
        const dot = document.createElement('span');
        dot.className = 'visitor-flame' + (group.unknown ? ' visitor-unknown' : '');
        dot.style.cssText = `width:${size}px;height:${size}px;animation-delay:-${index % 9}s`;
        const label = locationLabel(group);
        const tooltip = document.createElement('span');
        tooltip.textContent = label; // Never interpret location names as HTML.
        const marker = L.marker([group.lat, group.lng], {
          icon: L.divIcon({ className: 'visitor-dot', html: dot, iconSize: [size, size], iconAnchor: [radius, radius] }),
          title: label, alt: label, keyboard: true, riseOnHover: true
        }).bindTooltip(tooltip, { direction: 'top', offset: [0, -radius], className: 'visitor-tooltip' }).addTo(markers);
        marker.on('click', () => marker.openTooltip());
        marker.on('add', () => { const element = marker.getElement(); element?.addEventListener('focus', () => marker.openTooltip()); element?.addEventListener('blur', () => marker.closeTooltip()); });
        const element = marker.getElement();
        element?.addEventListener('focus', () => marker.openTooltip());
        element?.addEventListener('blur', () => marker.closeTooltip());
      });
    }
  map.on('zoomend',draw);
  const update=data=>{
    updateTiles(data?.tiles);
    if(!Array.isArray(data?.cities)){out();return;}
    cities=data.cities;
    if(!fitted&&cities.length){map.fitBounds(cities.map(c=>[c.lat,c.lng]),{padding:[25,25],maxZoom:3,animate:false});fitted=true;}
    draw();
    const note=document.querySelector('#visitor-map-coverage');
    if(note)note.textContent=`${(data.mapped||0).toLocaleString('en')} visitors mapped${data.unlocated ? ` · ${data.unlocated} with no usable country location` : ''}. dashed lights = unknown city or privacy-grouped city.${data.cityUnavailable ? " city details temporarily unavailable; all country totals are included." : ""}`;
    status.textContent = cities.length ? '' : 'no lanterns yet.';
    status.hidden = cities.length > 0;
  };
  update(snapshot);return update;
}
export {initMap};
