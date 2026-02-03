// People page functionality
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const crumbIdWrap = document.getElementById("crumb-id-wrap");
const listView = document.getElementById("people-list-view");
const personView = document.getElementById("person-view");

fetch("/people/people.json")
  .then(r => r.json())
  .then(data => {
    if (!id) {
      // LIST VIEW (/people)
      const list = document.getElementById("people-list");
      data.members.forEach(m => {
        const li = document.createElement("li");
        li.className = "people-item";
        li.innerHTML = `
          <a href="/people?id=${m.id}">
            <span class="people-name">${m.name}</span> -
            <span class="people-position">${m.position}</span>
          </a>
        `;
        list.appendChild(li);
      });
    } else {
      // DETAIL VIEW (/people?id=gabriel)
      const member = data.members.find(m => m.id === id);

      crumbIdWrap.textContent = " / " + id;

      if (!member) {
        personView.style.display = "block";
        listView.style.display = "none";
        personView.innerHTML = "<p class='sub'>Person not found.</p>";
        return;
      }

      listView.style.display = "none";
      personView.style.display = "block";

      document.getElementById("person-name").textContent = member.name;
      document.getElementById("person-about").textContent = member.about;

      const linksUl = document.getElementById("person-links");
      if (member.links && member.links.length) {
        member.links.forEach(l => {
          const li = document.createElement("li");
          li.innerHTML = `
            <a href="${l.href}" target="_blank" rel="noreferrer">
              ${l.text}
            </a>
          `;
          linksUl.appendChild(li);
        });
      } else {
        linksUl.innerHTML = "<li><span class='sub'>No links yet.</span></li>";
      }
    }
  });
