// Merge city aggregates, not individual visitors. Counts across cities can overlap.
export function mergeLocations(cities, zoom) {
  const level = zoom < 4 ? 'country' : zoom < 7 ? 'region' : 'city';
  const groups = new Map();
  for (const city of cities) {
    if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng) || Math.abs(city.lat) > 90 || Math.abs(city.lng) > 180 || !Number.isSafeInteger(city.visitors) || city.visitors < 2) continue;
    const countryKey = city.countryCode || city.country || '';
    const key = JSON.stringify([countryKey, level !== 'country' ? city.region || '' : '', level === 'city' ? city.city || '' : '']);
    let group = groups.get(key);
    if (!group) {
      group = { country: city.country || city.countryCode || '', region: city.region || '', city: city.city || '', visitors: 0, lat: 0, lng: 0, level };
      groups.set(key, group);
    }
    group.visitors += city.visitors;
    group.lat += city.lat * city.visitors;
    group.lng += city.lng * city.visitors;
  }
  return [...groups.values()].map(g => ({ ...g, lat: g.lat / g.visitors, lng: g.lng / g.visitors }));
}
export function locationLabel(group) {
  const name = group[group.level];
  if (!name) return group.country ? `somewhere in ${group.country}`.toLowerCase() : 'somewhere';
  return `${name} · ${group.visitors.toLocaleString('en')} ${group.visitors === 1 ? 'soul' : 'souls'}`.toLowerCase();
}
export const dotRadius = visitors => Math.max(4, Math.min(24, Math.sqrt(visitors)));

async function initMap() {
  const container = document.getElementById('visitor-map');
  const status = document.getElementById('visitor-map-status');
  if (!container) return;
  const out = () => { status.textContent = 'the lantern is out.'; status.hidden = false; };
  if (!window.L) { out(); return; }
  const L = window.L;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map(container, { minZoom: 2, maxZoom: 12, scrollWheelZoom: false, zoomAnimation: !reduced, fadeAnimation: !reduced, markerZoomAnimation: !reduced }).setView([30, 10], 2);
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  map.attributionControl.addAttribution(attribution);
  // Tile configuration is independent of visitor data, so geo outages keep the basemap.
  fetch('/api/geo?tiles=1', { signal: AbortSignal.timeout(10000) }).then(async response => {
    if (!response.ok || !(await response.json()).available) throw new Error('tiles unavailable');
    L.tileLayer('/api/geo?tiles=1&z={z}&x={x}&y={y}', { maxZoom: 12 }).on('tileerror', () => {
      document.getElementById('visitor-map-background').hidden = false;
    }).addTo(map);
  }).catch(() => { document.getElementById('visitor-map-background').hidden = false; });
  const markers = L.layerGroup().addTo(map);
  // The daily stats panel can be hidden while browsing tomorrow's prediction.
  const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  resize.observe(container);
  try {
    const response = await fetch('/api/geo?privacy=2', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('geo unavailable');
    const data = await response.json();
    if (!Array.isArray(data.cities)) throw new Error('invalid geo');
    const cities = data.cities.slice(0, 3000);
    function draw() {
      markers.clearLayers();
      mergeLocations(cities, map.getZoom()).forEach((group, index) => {
        const radius = dotRadius(group.visitors), size = radius * 2;
        const dot = document.createElement('span');
        dot.className = 'visitor-flame';
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
    draw(); map.on('zoomend', draw);
    status.textContent = cities.length ? '' : 'no lanterns yet.';
    status.hidden = cities.length > 0;
  } catch { out(); }
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'complete') initMap();
  else window.addEventListener('load', initMap, { once: true });
}
