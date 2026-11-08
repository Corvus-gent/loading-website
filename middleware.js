// - stats.corvus.gent serves the stats pages at clean URLs; corvus.gent/stats redirects there
// - curl / wget / scripts get counted, and curling the homepage gets a little reply
import {COMPOUND_LINKS} from "./js/compound-links.js";
import { rewrite, next, waitUntil } from "@vercel/functions";

export const config = { matcher: ["/((?!api/|js/|img/|cv/|papers/|.*\\.(?:css|js|png|jpg|svg|pdf|json|ico)$).*)"] };

const COMPANY_LINKS = {
  "/enter": "/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=button",
  "/the-crow": "/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=website",
  "/revived": "/?utm_source=linkedin&utm_medium=company-post&utm_campaign=gabe-corvus-revival",
};

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
  const liveSlug=/^\/go\/(twitch|instagram|twitter)\/?$/.exec(url.pathname);
  if(liveSlug){const target=new URL('/api/stats',url);target.searchParams.set('live','1');target.searchParams.set('slug',liveSlug[1]);return rewrite(target);}
  const supportSlug=/^\/go\/((?:call|bmc|dinner|roll)-(?:li|x))\/?$/.exec(url.pathname);
  if(supportSlug){const target=new URL('/api/stats',url);target.search=url.search;target.searchParams.set('support','1');target.searchParams.set('slug',supportSlug[1]);return rewrite(target);}
  const plethoraSlug=/^\/go\/(plethora-[a-z0-9-]+)\/?$/.exec(url.pathname);
  if(plethoraSlug){
    const target=new URL('/api/stats',url);target.search=url.search;target.searchParams.set('plethora','1');target.searchParams.set('slug',plethoraSlug[1]);return rewrite(target);
  }
  const battleSlug=/^\/go\/((?:cx|cp|bio)-(?:tt|ig|x|li))\/?$/.exec(url.pathname);
  if(battleSlug&&url.hostname!=='stats.corvus.gent'){
    const target=new URL('/api/stats',url);target.search=url.search;target.searchParams.set('battle','1');target.searchParams.set('slug',battleSlug[1]);return rewrite(target);
  }
  if(url.hostname!=='stats.corvus.gent'&&/^\/squads\/?$/.test(url.pathname)){
    url.pathname='/hackathons/';
    for(const [key,value]of Object.entries({utm_source:'share',utm_medium:'links',utm_campaign:'hack',utm_content:'squads'}))if(!url.searchParams.has(key))url.searchParams.set(key,value);
    return Response.redirect(url,307);
  }
  const compoundSlug=url.pathname.replace(/^\/|\/$/g,'');
  if(url.hostname!=='stats.corvus.gent'&&Object.hasOwn(COMPOUND_LINKS,compoundSlug)){
    const target=new URL('/api/stats',url);target.search=url.search;target.searchParams.set('compound','1');target.searchParams.set('slug',compoundSlug);
    if(url.searchParams.has('c'))target.searchParams.set('c',url.searchParams.get('c').slice(0,64));
    return rewrite(target);
  }
  if (url.hostname !== "stats.corvus.gent" && /^\/sidequest\/?$/.test(url.pathname)) {
    url.pathname = "/sidequests";
    return Response.redirect(url, 307);
  }
  if (url.hostname === "stats.corvus.gent" && /^\/coffee-with-gabe\/?$/.test(url.pathname)) {
    return Response.redirect("https://corvus.gent/go/corvus/coffee/coffee-stats", 307);
  }
  const companyLink=COMPANY_LINKS[url.pathname.replace(/\/$/, "")];
  if(url.hostname!=="stats.corvus.gent"&&companyLink)return new Response(null,{status:307,headers:{Location:companyLink}});
  if (url.hostname !== "stats.corvus.gent" && /^\/important-call-gabe-maxxer\/?$/.test(url.pathname)) {
    return new Response(null, { status: 307, headers: { Location: "/call/?utm_source=linkedin&utm_medium=post&utm_campaign=gabe-important-call" } });
  }
  if (url.hostname !== "stats.corvus.gent" && /^\/coffee-with-gabe\/?$/.test(url.pathname)) {
    return new Response(null, { status: 307, headers: { Location: "/links/gabe/bmc/coffee-bio?utm_source=buymeacoffee&utm_medium=bio&utm_campaign=gabe-coffee-bio" } });
  }
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
    if (/^\/(pidgy|games|map|music|hunt|x|coffee|status|hack|army)\/?$/.test(url.pathname)) return rewrite(new URL(`/stats/${url.pathname.split("/")[1]}/`, url));
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
