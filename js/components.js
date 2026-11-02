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

function linkEl(link) {
  const a = document.createElement("a");
  a.href = link.href;
  a.textContent = link.text;
  if (!link.href.startsWith("/") && !link.href.startsWith("mailto:")) {
    a.target = "_blank";
    a.rel = "noreferrer";
  }
  return a;
}

// A link, or a dropdown when the entry has `items`
export function createExternalLink(link) {
  const li = document.createElement("li");
  if (link.items?.length) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = link.text;
    const ul = document.createElement("ul");
    ul.className = "dropdown-list";
    link.items.forEach(item => {
      const sub = document.createElement("li");
      sub.appendChild(linkEl(item));
      ul.appendChild(sub);
    });
    details.append(summary, ul);
    li.appendChild(details);
  } else {
    li.appendChild(linkEl(link));
  }
  return li;
}

export function renderList(container, items, createItemFn) {
  items.forEach(item => {
    container.appendChild(createItemFn(item));
  });
}
