import { element } from './event-data.js';

const positions = [[65, 27], [30, 42], [65, 68]];

function dot(node, x, y) {
  node.style.setProperty('--x', x + '%');
  node.style.setProperty('--y', y + '%');
  return node;
}

export function drawRadar(container, attendees, matches, onLock) {
  const dial = element('div', undefined, 'dial');
  for (const size of ['one', 'two', 'three']) dial.append(element('i', undefined, 'ring ' + size));
  dial.append(element('i', undefined, 'sweep'), element('i', undefined, 'radar-center'));
  for (const [direction, name] of [['north', 'N'], ['east', 'E'], ['south', 'S'], ['west', 'W']]) {
    const label = element('span', name, 'direction ' + direction);
    label.setAttribute('aria-hidden', 'true');
    dial.append(label);
  }
  const matched = new Set(matches.map(({ person }) => person.id));
  for (const [index, person] of attendees.entries()) {
    if (matched.has(person.id)) continue;
    const angle = index * 2.39996;
    const radius = 44 * Math.sqrt((index + 1) / attendees.length);
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const blip = dot(element('i', undefined, 'blip'), x, y);
    blip.style.setProperty('--delay', '-' + (index % 8) / 2 + 's');
    dial.append(blip);
  }
  for (const [index, { person }] of matches.entries()) {
    const lock = dot(element(onLock ? 'button' : 'span', undefined, onLock ? 'lock radar-lock' : 'lock'), ...positions[index]);
    if (onLock) {
      lock.type = 'button';
      lock.addEventListener('click', () => onLock(person.id));
    }
    lock.setAttribute('aria-label', 'View match ' + (index + 1) + ': ' + person.name);
    lock.append(element('b', '×'), element('small', String(index + 1).padStart(2, '0')));
    dial.append(lock);
  }
  container.replaceChildren(dial);
}
