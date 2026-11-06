import {initI18n, t} from './i18n.js?v=20261106-knock1';
import {loadPersonas, mountPortrait, publicSocials} from './personas.js';

const id = document.body.dataset.article;
const portrait = document.querySelector('#portrait');
const oldCorvusTopic = /^#(?:name|birds|brains|rome|roman-raven|stars|myth|namesakes|family|purpose|sources|ref-[a-z-]+)$/;
if (id === 'corvus' && oldCorvusTopic.test(location.hash)) {
  location.replace('/wiki/corvus/namesakes/' + location.search + location.hash);
}
function labels() {
  const button = portrait.querySelector('button');
  if (button) button.setAttribute('aria-label', t('wk.next'));
}
initI18n(labels);
loadPersonas().then(profiles => {
  const person = profiles[id];
  mountPortrait(portrait, person, t('wk.next'));
  const list = document.querySelector('#official-links');
  for (const social of publicSocials(person)) {
    const item = document.createElement('li');
    const a = document.createElement('a');
    a.href = social.href;
    a.textContent = social.text;
    item.append(a);
    list.append(item);
  }
}).catch(() => { /* The article, facts, and all-links button remain available. */ });
