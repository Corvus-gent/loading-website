/**
 * Short links: /go/<platform>/<target>/<campaign>
 *   /go/ig            -> profile, from instagram bio
 *   /go/li/home/402   -> home page, from the LinkedIn "402" post
 *   /go/tt/pidgy      -> pidgy-ai.com, credited to Gabriel
 */

const PLATFORMS = { ig: "instagram", li: "linkedin", tt: "tiktok", x: "x", luma: "luma", wa: "whatsapp", mail: "email", qr: "qr" };

const TARGETS = {
  me: "/people/?id=gabriel", home: "/", now: "/now/", sidequests: "/sidequests/",
  support: "/support/", "402": "/402/", cv: "/cv/gabriel.pdf",
};

const EXTERNAL = { pidgy: "https://pidgy-ai.com/" };

async function siteConfig() {
  try { return await fetch("/site.json", { cache: "no-store" }).then(r => r.json()); }
  catch { return {}; }
}

export async function resolve(pathname) {
  const [, , p = "", target = "me", campaign = ""] = pathname.replace(/\/+$/, "").split("/");
  const source = PLATFORMS[p] || p || "direct";
  const medium = campaign ? "post" : "bio";

  if (EXTERNAL[target] || target === "book" || target === "coffee") {
    const cfg = await siteConfig();
    const base = EXTERNAL[target] || cfg[target === "book" ? "booking" : "coffee"] || TARGETS.me;
    const url = new URL(base, location.origin);
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", "gabriel" + (campaign ? "-" + campaign : ""));
    url.searchParams.set("utm_content", "corvus");
    if (target === "pidgy") url.searchParams.set("ref", "gabriel");
    return { url: url.toString(), source, medium, campaign, target, external: true };
  }

  const url = new URL(TARGETS[target] || TARGETS.me, location.origin);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign || "bio");
  url.searchParams.set("utm_content", target);
  return { url: url.toString(), source, medium, campaign, target, external: false };
}

export async function go() {
  const r = await resolve(location.pathname);
  // External links: log the click here, internal ones are logged by the landing page
  if (r.external) {
    const start = Date.now();
    while (!window.posthog?.capture && Date.now() - start < 1000) await new Promise(res => setTimeout(res, 100));
    if (window.posthog?.capture) window.posthog.capture("short_link_out", r);
    await new Promise(res => setTimeout(res, 200));
  }
  location.replace(r.url);
}
