/**
 * Reusable DOM rendering components
 */

export function createPersonListItem(member) {
  const li = document.createElement("li");
  li.className = "people-item";
  li.innerHTML = `
    <a href="/people?id=${member.id}">
      <span class="people-name">${member.name}</span> -
      <span class="people-position">${member.position}</span>
    </a>
  `;
  return li;
}

export function createExternalLink(link) {
  const li = document.createElement("li");
  li.innerHTML = `
    <a href="${link.href}" target="_blank" rel="noreferrer">
      ${link.text}
    </a>
  `;
  return li;
}

export function renderList(container, items, createItemFn) {
  items.forEach(item => {
    container.appendChild(createItemFn(item));
  });
}
