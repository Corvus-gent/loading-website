export async function loadPersonas() {
  const response = await fetch('/personas.json');
  if (!response.ok) throw new Error('Could not load the profiles');
  return response.json();
}

export function publicSocials(persona) {
  return persona.socials.filter(link => link.href.trim());
}

// Keep a single image on screen. The other portraits load only as needed.
export function mountPortrait(container, persona, nextLabel) {
  const img = document.createElement('img');
  img.src = persona.photos[0];
  img.alt = persona.name;
  container.replaceChildren(img);
  if (persona.photos.length < 2) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'portrait-next';
  button.setAttribute('aria-label', nextLabel);
  container.replaceChildren(button);
  button.append(img);
  let index = 0;
  function next() {
    index = (index + 1) % persona.photos.length;
    img.src = persona.photos[index];
  }
  button.addEventListener('click', next);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  setInterval(() => { if (!document.hidden && !motion.matches && !button.matches(':focus-visible')) next(); }, 5000);
}
