const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekday = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Brussels',
  weekday: 'short',
});
const day = weekdays.indexOf(weekday.format(new Date())) + 1;
const logo = '/logo/day-' + day + '.svg';

const favicon = document.querySelector('link[data-weekly-favicon]') ?? document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/svg+xml';
favicon.href = logo;
if (!favicon.isConnected) document.head.append(favicon);

for (const mark of document.querySelectorAll('img[data-weekly-logo]')) {
  mark.src = logo;
}
