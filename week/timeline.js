import {DAYS, DATES, INITIAL} from './itinerary.js';

function render(itinerary) {
  document.querySelector('.week-page h1').textContent = itinerary.title;
  document.querySelector('.week-page .site-lead').textContent = itinerary.intro;
  itinerary.days.forEach(({route, note, events}, i) => {
    const article = document.getElementById(DAYS[i]);
    article.querySelector('.week-route').textContent = route;
    article.querySelector('.week-note').textContent = note;
    const list = article.querySelector('.week-timeline');
    list.replaceChildren(...events.map(({time, text}) => {
      const li = document.createElement('li');
      const clock = document.createElement('time');
      clock.dateTime = DATES[i] + 'T' + time;
      clock.textContent = time;
      const activity = document.createElement('span');
      activity.textContent = text;
      li.append(clock, activity);
      return li;
    }));
  });
}

render(INITIAL);
try {
  const response = await fetch('/api/week', {cache:'no-store'});
  if (!response.ok) throw new Error();
  render((await response.json()).itinerary);
} catch {
  document.getElementById('week-offline').hidden = false;
}
