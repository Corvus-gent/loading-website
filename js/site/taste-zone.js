// Preserve the original query and fragment on the first visit.
const url = new URL(location.href);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
if (url.searchParams.get('layer_zone') !== zone) {
  url.searchParams.set('layer_zone', zone);
  location.replace(url);
}
