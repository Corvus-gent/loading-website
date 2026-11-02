/**
 * People page (/people/index.html) entry point
 */

import { setFooterYear, getQueryParam, toggleViews } from "./utils.js";
import { getAllMembers, getMemberById } from "./peopleData.js";
import { createPersonListItem, createExternalLink, renderList } from "./components.js";
import { initI18n, pick, t } from "./i18n.js";

const $ = id => document.getElementById(id);

async function showListView() {
  const members = await getAllMembers();
  $("people-list").innerHTML = "";
  renderList($("people-list"), members, createPersonListItem);
}

function simpleLink(item) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = item.href; a.target = "_blank"; a.rel = "noreferrer"; a.textContent = item.text;
  li.appendChild(a);
  return li;
}

async function showDetailView(id) {
  const member = await getMemberById(id);
  $("crumb-id-wrap").textContent = ` / ${id}`;
  toggleViews($("person-view"), $("people-list-view"));

  if (!member) {
    $("person-view").innerHTML = "<p class='sub'>Person not found.</p>";
    return;
  }

  $("person-name").textContent = member.name;
  $("person-about").innerHTML = pick(member.about); // trusted content from people.json

  if (member.research?.length) {
    $("research-section").style.display = "block";
    const ul = $("person-research");
    ul.innerHTML = "";
    member.research.forEach(r => {
      const li = simpleLink(r);
      const note = document.createElement("span");
      note.className = "sub"; note.textContent = " (" + r.note + ")";
      li.appendChild(note);
      ul.appendChild(li);
    });
  }

  if (member.blogs?.length) {
    $("blogs-section").style.display = "block";
    const ul = $("person-blogs");
    ul.innerHTML = "";
    member.blogs.forEach(b => {
      const li = document.createElement("li");
      li.className = "sub";
      li.textContent = b.wip ? `WIP: ${t("blogs." + b.title)}` : b.title;
      ul.appendChild(li);
    });
  }

  if (member.shoutouts?.length) {
    $("shoutouts-section").style.display = "block";
    const ul = $("person-shoutouts");
    ul.innerHTML = "";
    member.shoutouts.forEach(s => ul.appendChild(simpleLink(s)));
  }

  $("person-links").innerHTML = "";
  renderList($("person-links"), member.links || [], createExternalLink);
}

async function render() {
  const id = getQueryParam("id");
  if (id) await showDetailView(id);
  else await showListView();
}

async function init() {
  setFooterYear();
  initI18n(() => render());
  await render();
}

init();
