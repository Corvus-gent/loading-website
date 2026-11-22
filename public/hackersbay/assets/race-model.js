import { matchRoom } from './lens.js';
import { preset } from './persona.js';

export const SCOUTS = {
  hacker: { name: 'Deckhand', focus: 'Food, travel, and a prize that pays.', color: '#4be9a5', demoMs: 5700 },
  builder: { name: 'Navigator', focus: 'Co-founders, design, and time well spent.', color: '#58ceff', demoMs: 4900 },
  connector: { name: 'Quartermaster', focus: 'People with a good reason on both sides.', color: '#ff7863', demoMs: 6200 },
  investor: { name: 'Merchant', focus: 'Traction and a pilot worth backing.', color: '#ffd589', demoMs: 6700 }
};
export const FEATHER_KEY = 'hackersbay-race-feather-v1';

export function prepareScout(type, people) {
  const index = new Map(people.map((person,i) => [person.id,i]));
  const matches = new Map(matchRoom(preset(type),people).map(match => [index.get(match.person.id), match]));
  const rows = [...matches].map(([id, match]) => [id, match.weight, match.forYou.length, match.forThem.length]);
  return { matches, rows };
}

// This isolated function runs directly in the Boat.dev VM and the local demo.
export function rankRaceCandidates(type, rows) {
  const weights = {
    hacker: [6,2,3],
    builder: [5,4,3],
    connector: [3,5,11],
    investor: [6,3,5]
  }[type];
  const ranked = rows.map(([id, fit, wants, offers]) => ({
    id, fit, score: fit + weights[0]*wants + weights[1]*offers + weights[2]*Math.min(wants,offers)
  }));
  return ranked.sort((a,b) => b.score-a.score || b.fit-a.fit || a.id-b.id).slice(0,3).map(row => row.id);
}

export function raceScore(rows, picks, elapsed) {
  const values = new Map(rows.map(row => [row[0],row]));
  const quality = Math.round(picks.reduce((sum,id) => {
    const [,fit, wants, offers] = values.get(id);
    return sum + fit * 2 + 2 * (wants+offers) + 3 * Math.min(wants,offers);
  },0) / picks.length);
  const speed = Math.max(0, 16 - Math.floor(elapsed / 650));
  return { score: quality + speed, quality, speed };
}

export function readFeather() {
  try {
    const value = JSON.parse(localStorage.getItem(FEATHER_KEY));
    if (Object.hasOwn(SCOUTS, value?.type) && Array.isArray(value?.crew) && value.crew.length === 3) return value;
  } catch { /* A browser-local feather is optional. */ }
  return null;
}
