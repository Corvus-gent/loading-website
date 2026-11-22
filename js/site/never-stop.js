// The ring in the main hall: "never stop …", one new word a day.
// The words form a circular linked list, a ring in code as well.
export function ring(words) {
  const nodes = words.map(word => ({word, next: null}));
  nodes.forEach((node, i) => { node.next = nodes[(i + 1) % nodes.length]; });
  return nodes[0] || null;
}
// Days since 1 Jan 2026 on Ghent's calendar, so the word changes at local midnight.
export function dayNumber(now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
}
export function wordOfDay(head, n = dayNumber()) {
  let node = head, length = 1;
  for (let p = head.next; p !== head; p = p.next) length++;
  for (let i = 0; i < ((n % length) + length) % length; i++) node = node.next;
  return node;
}

const hall = document.querySelector('[data-hall]');
if (hall) {
  const cylinder = hall.querySelector('.hall-cylinder'), tilt = hall.querySelector('.hall-tilt'), today = document.querySelector('[data-hall-today]');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let powered = false, current = null;
  const render = node => {
    const panels = innerWidth < 700 ? 7 : Number(hall.dataset.panels || 10);
    const radius = Math.min(620, Math.max(250, innerWidth * 0.44));
    const width = 2 * Math.PI * radius / panels;
    hall.style.setProperty('--panel', width + 'px');
    cylinder.replaceChildren(...Array.from({length: panels}, (_, i) => {
      const panel = document.createElement('span');
      panel.className = 'hall-panel' + (i === 0 ? ' is-today' : '');
      const text = `never stop ${node.word}`;
      panel.style.fontSize = Math.min(22, width / (text.length * 0.86)) + 'px';
      panel.style.transform = `rotateY(${-i * 360 / panels}deg) translateZ(${-radius}px)`;
      // Letters power on one by one, like an LED sign warming up.
      [...text].forEach((ch, j) => {
        const l = document.createElement('i');
        l.textContent = ch === ' ' ? '\u00a0' : ch;
        if (!powered && !still) l.style.animationDelay = (0.5 + (i % panels) * 0.12 + j * 0.035 + Math.random() * 0.2).toFixed(2) + 's';
        panel.append(l);
      });
      node = node.next;
      return panel;
    }));
    if (!powered && !still) hall.classList.add('powering');
    powered = true;
  };
  fetch('/public/never-stop.json', {cache: 'no-cache'}).then(r => r.json()).then(data => {
    const head = ring((data.words || []).map(w => String(w).trim().toLowerCase()).filter(Boolean).slice(0, 365));
    if (!head) return;
    const node = wordOfDay(head);
    current = node;
    render(node);
    if (today) today.textContent = `Today the ring says: never stop ${node.word}.`;
    let w = innerWidth; addEventListener('resize', () => { if (innerWidth !== w) { w = innerWidth; render(node); } });
    if (still) hall.classList.add('is-still');
  }).catch(() => {});
  // Story mode: the ring itself tells what Corvus is, one line at a time,
  // turning each new line to the front like a rotating sign.
  const LINES = ['it is a time of noise', 'feeds full, rooms empty', 'builders ship alone', 'in the dark', 'then, in ghent', 'a banner went up', 'over an old circus', 'its name: corvus', 'build in public', 'help each other win', 'no enemies', 'only love', 'anyone may enter', 'every rank earned', 'the doors are open', 'for now'];
  let storyTimer = null;
  const setText = (panel, text, width) => { panel.textContent = text; panel.style.fontSize = Math.min(22, width / (Math.max(text.length, 12) * 0.86)) + 'px'; };
  function endStory(skipped) {
    clearInterval(storyTimer); storyTimer = null;
    hall.classList.add('story-switch');
    setTimeout(() => {
      hall.classList.remove('story', 'story-switch');
      cylinder.style.transform = ''; cylinder.style.animation = '';
      if (current) render(current);
      dispatchEvent(new CustomEvent('corvus-ring-story-end', {detail: {skipped}}));
    }, 500);
  }
  addEventListener('corvus-ring-story', () => {
    if (storyTimer || !current) return;
    const panels = [...cylinder.children], n = panels.length, step = 360 / n;
    const width = parseFloat(getComputedStyle(hall).getPropertyValue('--panel')) || 300;
    const lines = [...LINES, `never stop ${current.word}`];
    hall.classList.add('story-switch');
    setTimeout(() => {
      hall.classList.add('story'); hall.classList.remove('powering');
      cylinder.style.animation = 'none'; cylinder.style.transform = 'rotateX(-10deg) rotateY(0deg)';
      panels.forEach((p, i) => { p.classList.toggle('is-today', i === 0); setText(p, lines[i] || '', width); });
      hall.classList.remove('story-switch');
      let k = 0;
      const advance = () => {
        k++;
        if (k >= lines.length) return endStory(false);
        const ahead = k + Math.floor(n / 2);
        if (lines[ahead] !== undefined) setText(panels[ahead % n], lines[ahead], width);
        else setText(panels[ahead % n], '', width);
        panels.forEach((p, i) => p.classList.toggle('is-today', i === k % n));
        cylinder.style.transform = `rotateX(-10deg) rotateY(${k * step}deg)`;
        dispatchEvent(new CustomEvent('corvus-ring-story-line', {detail: {line: lines[k], index: k, total: lines.length}}));
      };
      storyTimer = setInterval(advance, still ? 2600 : 2300);
      dispatchEvent(new CustomEvent('corvus-ring-story-line', {detail: {line: lines[0], index: 0, total: lines.length}}));
    }, 500);
  });
  addEventListener('corvus-ring-story-skip', () => { if (storyTimer) endStory(true); });

  // Look around the hall: the ring follows the cursor a little.
  if (!still && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      tilt.style.transform = `rotateX(${(-y * 8).toFixed(2)}deg) rotateZ(${(x * 3).toFixed(2)}deg) translateX(${(-x * 30).toFixed(1)}px)`;
    }, {passive: true});
  }
}
