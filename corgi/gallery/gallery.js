const dialog = document.querySelector('dialog');
const links = [...document.querySelectorAll('figure a')];
if (dialog?.showModal && links.length) {
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('[data-viewer-caption]');
  const date = dialog.querySelector('time');
  const count = dialog.querySelector('[data-viewer-count]');
  const preload = new Image();
  preload.fetchPriority = 'low';
  let index = 0;
  let origin;
  let pointerStart;
  function show(nextIndex) {
    index = (nextIndex + links.length) % links.length;
    const link = links[index];
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    const figure = link.parentElement;
    const captureDate = figure.querySelector('time');
    caption.textContent = figure.querySelector('figcaption').firstChild.textContent;
    date.dateTime = captureDate.dateTime;
    date.textContent = captureDate.textContent;
    count.textContent = `${index + 1} / ${links.length}`;
    const next = links[(index + 1) % links.length];
    preload.src = next.href;
  }
  links.forEach((link, i) => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    origin = link;
    show(i);
    dialog.showModal();
  }));
  dialog.querySelectorAll('[data-step]').forEach(button => {
    button.addEventListener('click', () => show(index + Number(button.dataset.step)));
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  image.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') {
      pointerStart = event.clientX;
      image.setPointerCapture(event.pointerId);
    }
  });
  image.addEventListener('pointerup', event => {
    if (pointerStart === undefined) return;
    const distance = event.clientX - pointerStart;
    pointerStart = undefined;
    if (Math.abs(distance) > 40) show(index + (distance > 0 ? -1 : 1));
  });
  image.addEventListener('pointercancel', () => { pointerStart = undefined; });
  dialog.addEventListener('close', () => origin?.focus());
}
