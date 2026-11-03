// stats.corvus.gent serves the stats pages at clean URLs;
// corvus.gent/stats redirects to the subdomain.
import { rewrite, next } from "@vercel/functions";

export const config = { matcher: ["/", "/private", "/private/", "/stats", "/stats/:path*"] };

export default function middleware(request) {
  const url = new URL(request.url);
  const host = url.hostname;

  if (host === "stats.corvus.gent") {
    if (url.pathname === "/") return rewrite(new URL("/stats/", url));
    if (url.pathname.startsWith("/private")) return rewrite(new URL("/stats/private/", url));
    if (url.pathname.startsWith("/stats")) return Response.redirect(new URL(url.pathname.replace(/^\/stats/, "") || "/", url), 308);
    return next();
  }
  if (url.pathname.startsWith("/stats")) {
    const rest = url.pathname.replace(/^\/stats\/?/, "");
    return Response.redirect(`https://stats.corvus.gent/${rest.startsWith("private") ? "private" : ""}`, 308);
  }
  return next();
}
