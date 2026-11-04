// Searchable choices with the same touch and keyboard behavior in every browser.
export function createGamePicker(root) {
  const input = root.querySelector('input');
  const toggle = root.querySelector('.guess-picker-toggle');
  const list = root.querySelector('[role="listbox"]');
  const empty = root.querySelector('.guess-picker-empty');
  const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let choices = [], matches = [], active = -1;

  function position() {
    if (list.hidden) return;
    const rect = root.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0;
    const below = top + (viewport?.height || innerHeight) - rect.bottom - 8;
    const above = rect.top - top - 8;
    const upward = below < Math.min(240, Math.max(44, matches.length * 44)) && above > below;
    root.classList.toggle('opens-above', upward);
    list.style.maxHeight = `${Math.max(44, Math.min(240, upward ? above : below))}px`;
  }

  function close() {
    list.hidden = true;
    empty.hidden = true;
    if (input.getAttribute('role') === 'combobox') input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function highlight(index) {
    active = index;
    [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    const option = list.children[active];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      // Scroll only the options panel, without shifting the page or mobile keyboard.
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
      }
    } else input.removeAttribute('aria-activedescendant');
  }

  function open() {
    if (!choices.length) return;
    const query = fold(input.value.trim());
    matches = choices.filter(value => fold(value).includes(query))
      .sort((a, b) => Number(fold(b).startsWith(query)) - Number(fold(a).startsWith(query)));
    list.replaceChildren(...matches.map((value, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.tabIndex = -1;
      option.id = `${list.id}-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.index = String(index);
      option.textContent = value;
      return option;
    }));
    list.hidden = false;
    list.scrollTop = 0;
    empty.hidden = matches.length > 0;
    input.setAttribute('aria-expanded', 'true');
    position();
    highlight(-1);
  }

  function choose(index) {
    if (!matches[index]) return;
    input.value = matches[index];
    input.focus({preventScroll: true});
    close();
  }

  input.addEventListener('focus', open);
  input.addEventListener('click', () => { if (list.hidden) open(); });
  input.addEventListener('input', open);
  input.addEventListener('keydown', event => {
    if (!choices.length || event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) open();
      if (matches.length) highlight(active < 0
        ? (event.key === 'ArrowDown' ? 0 : matches.length - 1)
        : (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
    } else if (event.key === 'Enter' && !list.hidden && matches.length) {
      event.preventDefault();
      choose(active < 0 ? 0 : active);
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') close();
  });
  toggle.addEventListener('click', () => {
    const opening = list.hidden;
    input.focus({preventScroll: true});
    if (opening) open(); else close();
  });
  list.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') event.preventDefault();
  });
  list.addEventListener('click', event => {
    const option = event.target.closest('[role="option"]');
    if (option) choose(Number(option.dataset.index));
  });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) close();
  });
  document.addEventListener('pointerdown', event => {
    if (!root.contains(event.target)) close();
  });
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);

  return {
    close,
    setOptions(values) {
      choices = [...values];
      close();
      toggle.hidden = !choices.length;
      root.classList.toggle('has-choices', choices.length > 0);
      if (choices.length) {
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', list.id);
        input.setAttribute('aria-haspopup', 'listbox');
      } else {
        for (const name of ['role', 'aria-autocomplete', 'aria-controls', 'aria-haspopup', 'aria-expanded']) input.removeAttribute(name);
      }
    },
    setLabels(labels) {
      toggle.setAttribute('aria-label', labels.toggle);
      list.setAttribute('aria-label', labels.list);
      empty.textContent = labels.empty;
    },
  };
}
