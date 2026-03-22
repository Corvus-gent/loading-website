/**
 * Landing page (index.html) entry point
 */

import { setFooterYear } from "./utils.js";
import { getPeopleCount } from "./peopleData.js";

async function init() {
  setFooterYear();

  const count = await getPeopleCount();
  const link = document.getElementById("people-link");
  if (link) {
    link.textContent = `people: ${count}`;
  }
}

init();
