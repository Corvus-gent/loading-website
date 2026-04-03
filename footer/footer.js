// Load footer component
fetch("/footer/footer.html")
  .then(r => r.text())
  .then(html => {
    const container = document.getElementById("footer-container");
    if (container) {
      container.innerHTML = html;
      // Update year after loading
      const yearSpan = document.getElementById("y");
      if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
      }
    }
  });
