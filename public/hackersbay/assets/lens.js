import { PERSONAS } from './persona.js';

const signals = {
  cofounder: /co.?founder|founding partner/i, design: /design|\bux\b|frontend/i, pilots: /pilots?|users|customers|design.partners/i,
  code: /engineer|\bcode\b|backend|developer|coding|javascript|python/i, opensource: /open.source|github/i,
  devtools: /dev.?tools|developer tools|\bapi\b|infrastructure|infra/i, privacy: /privacy|redaction|confidential/i,
  logistics: /food|meal|sleep|venue|logistics/i, prizes: /prize|payout/i, travel: /travel|transit|route/i,
  traction: /traction|paid pilot|shipping|live product/i, funding: /invest|funding|budget/i,
  community: /community|meetup|organizer/i, intros: /intro|connections/i, builders: /builders|founders/i,
  distribution: /distribution|audience|reach/i, prototyping: /prototype|demos|prototyp/i,
  team: /teammate|team|collaborator/i, accessibility: /accessib|captions/i, hardware: /hardware|sensor/i
};
const labels = {
  cofounder: 'co-founder fit', design: 'design', pilots: 'pilot testing', code: 'engineering', opensource: 'open source',
  devtools: 'developer tools', privacy: 'privacy', logistics: 'event logistics', prizes: 'prize logistics',
  travel: 'getting there', traction: 'traction', funding: 'funding', community: 'community',
  intros: 'warm intros', builders: 'active builders', distribution: 'distribution', prototyping: 'prototyping',
  team: 'teaming up', accessibility: 'accessibility', hardware: 'hardware'
};
const lenses = {
  hacker: {
    summary: 'Budget around the published facts and use the room to find practical help.',
    details: event => [
      ['Food', event.logistics.food], ['Sleep', event.logistics.sleep], ['Cash prize', event.logistics.prizes],
      ['Payout speed', event.logistics.payout], ['Travel', event.logistics.travel]
    ]
  },
  builder: {
    summary: 'Find a co-founder candidate and two people with something concrete to trade.',
    details: () => [
      ['Co-founder potential', 'Prototype and technical partners in the demo roster'],
      ['Quality of room', 'Selected projects pitch to listed judges'],
      ['Chance to win', 'Published prize odds are unavailable'], ['Time cost', 'Four hours on the published schedule']
    ]
  },
  connector: {
    summary: 'Find the builders with a reason to talk and propose one intro at a time.',
    details: () => [
      ['Top builders', 'Ranked for what they can offer and use'],
      ['Smart outreach', 'A concrete reason for each side'], ['Intros', 'Both sides must opt in'],
      ['Invite volume', 'Three suggestions and no bulk sends']
    ]
  },
  investor: {
    summary: 'Look for a working product, an early customer signal, and a plausible pilot.',
    details: () => [
      ['What’s building', 'Selected demos from the boat'],
      ['Traction', 'Fictional signals to show how diligence could work'],
      ['Sponsor fit', 'Sandbox, web data, and privacy workflows'],
      ['ROI to track', 'Qualified intros → pilots → follow-ups']
    ]
  }
};

function textTags(value) {
  return Object.keys(signals).filter(tag => signals[tag].test(value));
}

const overlap = (a, b) => a.filter(tag => b.includes(tag));

export function matchRoom(card, people) {
  const persona = PERSONAS[card.type];
  const wanted = textTags(card.wants);
  const offered = textTags(card.offers + ' ' + card.builds);
  const seeks = [...new Set([...wanted, ...persona.seeks])];
  const brings = [...new Set([...offered, ...persona.brings])];
  const priorities = card.type === 'hacker' ? ['logistics', 'travel', 'prizes']
    : card.type === 'builder' ? ['cofounder', 'design']
    : card.type === 'connector' ? ['builders', 'traction'] : ['traction', 'pilots', 'privacy'];

  return people.map(person => {
    const forYou = overlap(seeks, person.brings);
    const forThem = overlap(brings, person.seeks);
    const weight = forYou.length * 3 + forThem.length * 4 + overlap(priorities, forYou).length * 3
      + overlap(wanted, forYou).length + overlap(offered, forThem).length;
    return { person, forYou, forThem, weight };
  }).sort((a, b) => b.weight - a.weight || b.forThem.length - a.forThem.length || a.person.name.localeCompare(b.person.name));
}

export function describeMatch(match) {
  const { person, forYou, forThem } = match;
  const overlapLabel = tags => tags.slice(0, 2).map(tag => labels[tag]).join(' and ');
  return {
    yourReason: `They offer ${person.offers}.${forYou.length ? ' Relevant to your interest in ' + overlapLabel(forYou) + '.' : ''}`,
    theirReason: `They’re looking for ${person.wants}.${forThem.length ? ' Your card has a signal for ' + overlapLabel(forThem) + '.' : ''}`
  };
}

export function lensFor(card, event, matches) {
  const { summary, details } = lenses[card.type];
  const base = { hacker: 32, builder: 53, connector: 58, investor: 47 }[card.type];
  const fit = matches.slice(0, 3).reduce((total, match) => total + match.weight, 0);
  const score = Math.min(card.type === 'hacker' ? 60 : 95, base + Math.round(fit / 2.4));
  return { title: PERSONAS[card.type].lens, score, summary, details: details(event) };
}
