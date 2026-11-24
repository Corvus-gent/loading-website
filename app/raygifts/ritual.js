export const questions = [
  { label: 'What keeps you up?', options: ['Too many thoughts', 'A body still in motion', 'One more scroll'] },
  { label: 'What scent mood are you in?', options: ['Soft and cozy', 'Fresh and bright', 'Earthy and grounded'] },
  { label: 'Who is this for?', options: ['For me', 'A gift'] },
];

export function resultCode(value) {
  return typeof value === 'string' && /^[0-2][0-2][0-1]$/.test(value) ? value : '';
}

export function resultTitle(code) {
  if (!resultCode(code)) return 'Find your evening ritual';
  return ['The soft landing', 'The last stretch', 'The offline hour'][Number(code[0])];
}

const moods = [/slumber|relax|becalmed/i, /clear|clarity|bright|citrus/i, /yoga|earth|wood/i];
const concerns = [/becalmed|destress/i, /yoga|wind.down/i, /slumber|relax/i];

export function availableChoices(products) {
  return products.flatMap(product => product.variants.filter(({available}) => available).map(variant => ({
    ...variant,
    product,
    label: variant.name === 'Default Title' ? product.name : product.name + ' · ' + variant.name,
  })));
}

export function recommendation(products, code) {
  if (!resultCode(code)) return [];
  const [concern, mood, gift] = Array.from(code, Number);
  const items = availableChoices(products).filter((choice, index, all) => all.findIndex(other => other.product.handle === choice.product.handle) === index);
  function score(item) {
    const label = item.label;
    return 4 * moods[mood].test(label) + 2 * concerns[concern].test(label);
  }
  return items.sort((a, b) => score(b) - score(a)).slice(0, gift ? 3 : 2);
}

const steps = [
  { minutes: 60, name: 'Screens off', copy: 'Put the phone on charge somewhere out of reach.', match: /journal|notebook/i },
  { minutes: 40, name: 'Run a bath', copy: 'Leave a few minutes to let the water run.', match: /bath|soap/i },
  { minutes: 20, name: 'Set the scent', copy: 'Make this the moment you turn off the big light.', match: /candle|incense|scent|wax melt/i },
  { minutes: 5, name: 'Reach for an eye pillow', copy: 'Get comfortable and give yourself a quiet minute.', match: /eye pillow|eye mask/i },
];

export function nextBedtime(time, now) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

export function timeline(bedtime, products) {
  const choices = availableChoices(products);
  const used = new Set();
  return steps.map(step => {
    const { match, minutes, name, copy } = step;
    const choice = choices.find(({ id, product }) => !used.has(id) && match.test(product.name + ' ' + product.type));
    if (choice) used.add(choice.id);
    return { name, copy, choice, time: new Date(bedtime.getTime() - minutes * 60000) };
  });
}

export function calendarFile(events, now) {
  const format = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ray//Wind-down//EN', 'CALSCALE:GREGORIAN',
    ...events.flatMap(({ name, time }, index) => [
      'BEGIN:VEVENT', 'UID:' + format(time) + '-' + index + '@corvus.gent', 'DTSTAMP:' + format(now),
      'DTSTART:' + format(time), 'DTEND:' + format(new Date(time.getTime() + 5 * 60000)), 'SUMMARY:' + name, 'END:VEVENT',
    ]),
    'END:VCALENDAR', '',
  ].join('\r\n');
}
