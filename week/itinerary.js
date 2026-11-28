export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DATES = DAYS.map((_, i) => '2026-11-' + (23 + i));
export const INITIAL = {
  title: 'seven days. five cities. one bedroom.',
  intro: '23 – 29 November 2026. London, Gent, Rotterdam, Amsterdam, Calais, and back again.',
  days: [
    {route: 'Brussels → London', note: '', events: [
      {time: '07:00', text: 'Wake up'},
      {time: '08:00', text: 'Book the Eurostar'},
      {time: '09:00', text: 'Head to Brussels'},
      {time: '10:00', text: 'Board the train'},
      {time: '11:00', text: 'Work on the train'},
      {time: '12:00', text: 'Arrive in London'}
    ]},
    {route: 'London · Corgi and Salesforce', note: 'Two days in London. Corgi, then Salesforce, then Corgi again.', events: []},
    {route: 'wintercircus → gravensteen', note: 'Home in Gent. Built under the circus roof, then walked to the castle.', events: []},
    {route: 'wintercircus → rotterdam → amsterdam → london → gent → calais', note: "Six stops, four countries, one day. Don't ask how.", events: []},
    {route: 'calais → london → corgi → salesforce → pidgy @ conference', note: 'Back across the water. Corgi, Salesforce, and Pidgy at the conference.', events: []},
    {route: 'my bedroom', note: 'Zero kilometers. Shipping instead.', events: []},
    {route: '… who knows', note: '', events: []}
  ]
};
