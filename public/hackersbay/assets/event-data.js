import { dressedSprite, seededLook } from './wardrobe.js';

async function get(file) {
  const response = await fetch(new URL(file, import.meta.url), { signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error('Room manifest unavailable');
  return response.json();
}

export const loadCrew = () => get('attendees.json');

export async function loadRoom() {
  const [event, attendees] = await Promise.all([get('event.json'), loadCrew()]);
  return { event, attendees };
}

export function crewAvatar(person) {
  const {type,look} = seededLook(person);
  return dressedSprite(type,look);
}

export function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}
