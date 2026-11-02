/**
 * PostHog analytics (cookieless: no consent banner needed).
 * Paste the project API key of a personal PostHog project below.
 */
const POSTHOG_KEY = "phc_REPLACE_ME";
const POSTHOG_HOST = "https://eu.i.posthog.com";

if (!POSTHOG_KEY.startsWith("phc_REPLACE")) {
  const s = document.createElement("script");
  s.src = "https://eu-assets.i.posthog.com/static/array.js";
  s.async = true;
  s.onload = () => {
    window.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: "memory",
      disable_session_recording: true,
      capture_pageview: true,
      autocapture: true,
    });
  };
  document.head.appendChild(s);

  // One clear event per link click: easy "clicks per day" per link
  document.addEventListener("click", e => {
    const a = e.target.closest("a");
    if (!a || !window.posthog?.capture) return;
    window.posthog.capture("link_click", {
      link_text: a.textContent.trim(),
      link_href: a.getAttribute("href"),
      page: location.pathname + location.search,
    });
  });
}
