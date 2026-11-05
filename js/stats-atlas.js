import { renderCountries, countryPeriod } from './stats-countries.js';
const container = document.querySelector('#visitor-map');
let visible = false,
  started = false,
  data,
  update;
function mount() {
  if (update) {
    update(data);
    return;
  }
  if (!visible || started || !data) return;
  started = true;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/js/vendor/leaflet/leaflet.css';
  document.head.append(css);
  import('./stats-map.js')
    .then(async ({ initMap }) => {
      const initial = data;
      update = await initMap(initial);
      if (initial !== data) update?.(data);
    })
    .catch(() => {
      document.querySelector('#visitor-map-status').textContent = 'the lantern is out.';
    });
}
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    visible = true;
    observer.disconnect();
    mount();
  }
});
observer.observe(container);
window.statsPage.watch('map', window.statsPage.today, (s) => {
  data = s.data;
  const list = document.querySelector('#countries');
  document.querySelector('#countries-period').textContent = countryPeriod(
    s.day || window.statsPage.today
  );
  if (data?.countries) renderCountries(list, data.countries);
  else list.textContent = 'country counts are unavailable. try again shortly.';
  if (!data) document.querySelector('#visitor-map-status').textContent = 'the lantern is out.';
  mount();
});
