/**
 * Shared utility functions
 */

export function setFooterYear(elementId = "y") {
  const el = document.getElementById(elementId);
  if (el) el.textContent = new Date().getFullYear();
}

export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

export function toggleViews(showEl, hideEl) {
  if (hideEl) hideEl.style.display = "none";
  if (showEl) showEl.style.display = "block";
}
