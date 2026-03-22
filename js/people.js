/**
 * People page (/people/index.html) entry point
 */

import { setFooterYear, getQueryParam, toggleViews } from "./utils.js";
import { getAllMembers, getMemberById } from "./peopleData.js";
import { createPersonListItem, createExternalLink, renderList } from "./components.js";

const elements = {
  crumbIdWrap: () => document.getElementById("crumb-id-wrap"),
  listView: () => document.getElementById("people-list-view"),
  personView: () => document.getElementById("person-view"),
  peopleList: () => document.getElementById("people-list"),
  personName: () => document.getElementById("person-name"),
  personAbout: () => document.getElementById("person-about"),
  personLinks: () => document.getElementById("person-links"),
};

async function showListView() {
  const members = await getAllMembers();
  renderList(elements.peopleList(), members, createPersonListItem);
}

async function showDetailView(id) {
  const member = await getMemberById(id);
  const { listView, personView, crumbIdWrap, personName, personAbout, personLinks } = elements;

  crumbIdWrap().textContent = ` / ${id}`;
  toggleViews(personView(), listView());

  if (!member) {
    personView().innerHTML = "<p class='sub'>Person not found.</p>";
    return;
  }

  personName().textContent = member.name;
  personAbout().textContent = member.about;

  if (member.links?.length) {
    renderList(personLinks(), member.links, createExternalLink);
  } else {
    personLinks().innerHTML = "<li><span class='sub'>No links yet.</span></li>";
  }
}

async function init() {
  setFooterYear();

  const id = getQueryParam("id");
  if (id) {
    await showDetailView(id);
  } else {
    await showListView();
  }
}

init();
