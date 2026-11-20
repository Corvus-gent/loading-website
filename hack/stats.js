import { formatPageText, translatePageText } from '../js/i18n/page-copy.js';
import { number } from '../js/stats-view.js';

const element = (tag, text) => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};
const root = document.getElementById('hack-stats');
const totalLabels = {
  view: 'counted visits',
  app_open: 'app opens',
  feedback: 'feedback',
  github_click: 'github clicks',
  like: 'likes',
  dislike: 'dislikes',
  comment: 'comments',
  share: 'shares'
};
let snapshot;

function render() {
  if (!snapshot) return;
  const grid = element('div', '');
  grid.className = 'stats-hack-grid';
  for (const [key, label] of Object.entries(totalLabels)) {
    const row = element('p', translatePageText(label));
    row.prepend(element('strong', number(snapshot.totals[key] || 0)));
    grid.append(row);
  }
  root.replaceChildren(grid, element('h2', translatePageText('by source')));
  for (const [source, count] of Object.entries(snapshot.sources)) {
    root.append(element('p', formatPageText('{source}: {count}', {
      source: source.replace(':', ' · '), count: number(count)
    })));
  }
  root.append(element('h2', translatePageText('squad link clicks')));
  for (const [id, name] of [['1:gabe', 'Gabe'], ['1:siebe', 'Siebe Baree'], ['1:xx', 'XX'], ['2:gabe', 'Gabe · solo run']]) {
    root.append(element('p', translatePageText(name) + ' · ' + number(snapshot.members?.[id] || 0)));
  }
  document.getElementById('hack-comments').replaceChildren(...snapshot.comments.map(comment =>
    element('p', comment.name + ' · ' + comment.text + ' · ♥ ' + number(comment.likes))
  ));
}

async function load() {
  try {
    const response = await fetch('/api/hack');
    if (!response.ok) throw Error('Stats unavailable');
    snapshot = await response.json();
    render();
  } catch {
    root.textContent = 'Stats unavailable. Please try again shortly.';
  }
}
window.addEventListener('corvus-page-copy-ready', render);
document.getElementById('private-feedback').onclick=async()=>{const out=document.getElementById('feedback-list');try{const r=await fetch('/api/hack?private=1');if(!r.ok)throw Error();const d=await r.json();out.replaceChildren(...d.feedback.map(c=>element('p',c.at+' · '+c.text+(c.email?' · '+c.email:''))));if(!d.feedback.length)out.textContent='No feedback yet.';}catch{out.textContent='Sign in as Gabe to see feedback.';}};
load();
