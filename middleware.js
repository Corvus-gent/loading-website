// - stats.corvus.gent serves the stats pages at clean URLs; corvus.gent/stats redirects there
// - curl / wget / scripts get counted, and curling the homepage gets a little reply
import { rewrite, next, waitUntil } from "@vercel/functions";

export const config = { matcher: ["/((?!api/|js/|img/|cv/|papers/|.*\\.(?:css|js|png|jpg|svg|pdf|json|ico)$).*)"] };

const CLI = [[/^curl/i, "curl"], [/^wget/i, "wget"], [/httpie/i, "httpie"], [/python|aiohttp/i, "python"], [/^go-http/i, "go"], [/node-fetch|undici|axios/i, "node"], [/postman/i, "postman"], [/insomnia/i, "insomnia"], [/powershell/i, "powershell"]];

const CURL_REPLY = `
   corvus.gent
   -----------
   you curled me. respect.

   the crow died. the domain didn't.
   still looking for an honest man.

   gabe  -> https://corvus.gent/gabe
   links -> https://corvus.gent/links/gabe
   stats -> https://stats.corvus.gent

   psst: try it in a browser and press any key.
`;

export default function middleware(request) {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";
  const hit = CLI.find(([re]) => re.test(ua));

  if (hit) {
    waitUntil(fetch(new URL("/api/hit", url), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: hit[1] }),
    }).catch(() => {}));
    if (url.pathname === "/" && url.hostname !== "stats.corvus.gent") {
      return new Response(CURL_REPLY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  }

  if (url.hostname === "stats.corvus.gent") {
    if (url.pathname === "/") return rewrite(new URL("/stats/", url));
    if (/^\/(pidgy|games|map|music|hunt)\/?$/.test(url.pathname)) return rewrite(new URL(`/stats/${url.pathname.split("/")[1]}/`, url));
    if (url.pathname.startsWith("/private")) return rewrite(new URL("/stats/private/", url));
    if (/^\/stats(?:\/|$)/.test(url.pathname)) return Response.redirect(new URL((url.pathname.replace(/^\/stats/, "") || "/") + url.search, url), 308);
    return next();
  }
  if (/^\/stats(?:\/|$)/.test(url.pathname)) {
    const rest = url.pathname.replace(/^\/stats\/?/, "");
    return Response.redirect(`https://stats.corvus.gent/${rest}${url.search}`, 308);
  }
  return next();
}
