// Load people count and update link
fetch("/people/people.json")
  .then(r => r.json())
  .then(data => {
    const count = data.members.length;
    const link = document.getElementById("people-link");
    if (link) {
      link.textContent = `people: ${count}`;
    }
  });
