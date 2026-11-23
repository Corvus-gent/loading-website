export const ENTRANCES = [
  {id: 'mon', label: 'Mon · Lantern'}, {id: 'tue', label: 'Tue · Glyphs'},
  {id: 'wed', label: 'Wed · Ink'}, {id: 'thu', label: 'Thu · Water'},
  {id: 'fri', label: 'Fri · Room'}, {id: 'sat', label: 'Sat · Mirror'},
  {id: 'sun', label: 'Sun · Night'},
];
export const PREFERENCE_KEY = 'corvus-entry-choice';
export function isChoice(value) {
  return value === 'today' || ENTRANCES.some(day => day.id === value);
}
export function brusselsDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Brussels', weekday: 'short'})
    .format(date).toLowerCase();
}
export function resolveEntrance(query, stored, date = new Date()) {
  const choice = isChoice(query) ? query : isChoice(stored) ? stored : 'today';
  return {choice, day: choice === 'today' ? brusselsDay(date) : choice};
}
