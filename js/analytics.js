(async () => {
const arrivalURL=location.href;
const {arrivalSearch,clearTrackingURL}=await import('/js/arrival.js');
/**
 * PostHog analytics (cookieless: no consent banner needed).
 * Paste the project API key of a personal PostHog project below.
 */
const POSTHOG_KEY = "phc_tqJYxREMXWjzQusx6xNPuEa2fNCzKmVpAURSHKnVbpro";
const POSTHOG_HOST = "https://eu.i.posthog.com";

if (!POSTHOG_KEY.startsWith("phc_REPLACE")) {
  // Cookieless PostHog does not enrich GeoIP; attach only Vercel's country code.
  const country = fetch('/api/geo?country=1', {cache: 'no-store', signal: AbortSignal.timeout(2000)})
    .then(response => response.ok ? response.json() : null).catch(() => null);
  const cleanupTimer=setTimeout(clearTrackingURL,5000);
  const s = document.createElement("script");
  s.onerror=()=>{clearTimeout(cleanupTimer);clearTrackingURL();};
  s.src = "https://eu-assets.i.posthog.com/static/array.js";
  s.async = true;
  s.onload = async () => {
    const geo = await country;
    if(!window.posthog?.init){clearTimeout(cleanupTimer);clearTrackingURL();return;}
    window.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      cookieless_mode: "always",
      disable_session_recording: true,
      capture_pageview: false,
      autocapture: true,
      loaded: ph => {
        const props = {...window.__phProps};
        const query=new URLSearchParams(arrivalSearch);
        for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(query.has(key))props[key]=query.get(key);
        if (/^[A-Z]{2}$/.test(geo?.countryCode || '')) props.corvus_country_code = geo.countryCode;
        ph.register(props);
        ph.capture('$pageview',{$current_url:arrivalURL});
        clearTimeout(cleanupTimer);
        clearTrackingURL();
      },
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
} else {clearTrackingURL();}

import("/js/performance.js");

import("/js/outbound.js");

})();
