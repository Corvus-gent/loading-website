import { DEFAULT_PIRATE, parrotSprite, normalizePirate } from './pirate.js';
import { element } from './event-data.js';
import { playBaySound } from './sound.js';

export function parrotBubble(value, reason) {
  const pirate = value || DEFAULT_PIRATE;
  const bubble = element('div', undefined, 'parrot-bubble');
  const copy = element('div');
  copy.append(element('strong', pirate.birdName || 'Your parrot'), element('p', reason));
  bubble.append(parrotSprite(pirate), copy);
  return bubble;
}

export function spyglassPilot(radar, value) {
  const pirate = value || DEFAULT_PIRATE;
  const dial = radar.querySelector('.dial');
  const masts = [...dial.querySelectorAll('.lock')];
  const marker = element('div', undefined, 'spyglass-parrot');
  marker.setAttribute('aria-hidden', 'true');
  marker.append(parrotSprite(pirate), parrotSprite(pirate, true));
  dial.append(marker);
  let timer;
  return {
    land(index, animate = true) {
      const mast = masts[index];
      if (!mast) return;
      clearTimeout(timer);
      marker.toggleAttribute('data-flying', animate && !matchMedia('(prefers-reduced-motion: reduce)').matches);
      marker.style.left = mast.style.getPropertyValue('--x');
      marker.style.top = mast.style.getPropertyValue('--y');
      for (const [i, lock] of masts.entries()) lock.toggleAttribute('data-perched', index === i);
      if (animate) timer = setTimeout(() => marker.removeAttribute('data-flying'), 520);
    },
    reset() {
      clearTimeout(timer);
      marker.removeAttribute('data-flying');
      marker.style.left = '50%';
      marker.style.top = '53%';
      for (const mast of masts) mast.removeAttribute('data-perched');
    },
    stop() { clearTimeout(timer); }
  };
}

export function flySpyglass(radar, value, captions, matches, reasons) {
  const pilot = spyglassPilot(radar, value);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let timer;
  let arrival;
  let reached = -1;
  let watching;

  function reveal(index, animate) {
    reached = index;
    pilot.land(index, animate);
    const message = matches[index].person.name + ' — ' + reasons[index];
    const settle = () => {
      captions.replaceChildren(parrotBubble(value, message));
      if (animate) playBaySound('squawk');
    };
    clearTimeout(arrival);
    if (animate) arrival = setTimeout(settle, 510);
    else settle();
  }
  function advance() {
    if (reached >= matches.length - 1) return;
    reveal(reached + 1, !motion.matches);
    if (!motion.matches) timer = setTimeout(advance, 1750);
  }

  if (motion.matches || !('IntersectionObserver' in window)) advance();
  else {
    watching = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) advance();
      else clearTimeout(timer);
    }, {threshold:.35});
    watching.observe(radar);
  }
  return {
    visit(id) {
      const index = matches.findIndex(({person}) => person.id === id);
      if (index < 0) return;
      watching?.disconnect();
      clearTimeout(timer);
      reveal(index, !motion.matches);
    },
    stop() {
      watching?.disconnect();
      clearTimeout(timer);
      clearTimeout(arrival);
      pilot.stop();
    }
  };
}

export function mutualParrots(first, second) {
  const pair = element('div', undefined, 'beak-bump');
  pair.setAttribute('aria-hidden', 'true');
  for (const [side, pirate] of [['port', normalizePirate(first || DEFAULT_PIRATE)], ['starboard', normalizePirate(second || DEFAULT_PIRATE)]]) {
    const bird = element('div', undefined, 'mutual-bird ' + side);
    bird.append(parrotSprite(pirate, true));
    pair.append(bird);
  }
  for (let i = 0; i < 11; i++) {
    const coin = element('i', undefined, 'coin-sprite');
    const angle = Math.PI * i / 10;
    coin.style.setProperty('--cx', Math.round(Math.cos(angle) * (44 + (i % 3) * 19)) + 'px');
    coin.style.setProperty('--cy', Math.round(-Math.sin(angle) * (18 + (i % 4) * 11)) + 'px');
    coin.style.setProperty('--spin', (i % 2 ? '-' : '') + (120 + i * 24) + 'deg');
    coin.style.setProperty('--coin-delay', (.67 + (i % 4) * .025) + 's');
    pair.append(coin);
  }
  return pair;
}
