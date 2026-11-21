export async function loadRoom() {
  const get = async file => {
    const response = await fetch(new URL(file, import.meta.url), { signal: AbortSignal.timeout(4500) });
    if (!response.ok) throw new Error('Room manifest unavailable');
    return response.json();
  };
  const [event, attendees] = await Promise.all([get('event.json'), get('attendees.json')]);
  return { event, attendees };
}

export function portrait(person) {
  const avatar = document.createElement('span');
  avatar.setAttribute('aria-hidden', 'true');
  if (Number.isInteger(person.portrait)) {
    avatar.className = 'portrait';
    avatar.style.setProperty('--col', person.portrait % 4);
    avatar.style.setProperty('--row', Math.floor(person.portrait / 4));
  } else {
    avatar.className = 'portrait initials';
    avatar.textContent = person.name.split(' ').map(part => part[0]).join('').slice(0, 2);
  }
  return avatar;
}

export function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}
