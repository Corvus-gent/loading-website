#!/usr/bin/env python3
"""Builds search-index.json: every page's visible text (English), so any phrase is searchable.
Run after content changes:  python3 tools/build-search.py"""
import glob, html, json, re

EN = json.loads(open("js/locales/en.js", encoding="utf-8").read().removeprefix("export default ").rstrip(";\n"))
people = json.load(open("people/people.json", encoding="utf-8"))["members"][0]

TITLES = {"/": "home", "/gabe": "gabe · about me"}
# Explicit publication boundary: never crawl reports, traces or new internal dirs.
PUBLIC_ROOTS = {"gabinho-rolls","plethora","hackathons","index.html", "call", "games", "languages", "links", "music", "now", "people", "privacy", "sf", "realm", "sidequests", "stats", "support", "wiki"}
pages = []
for f in sorted(glob.glob("**/index.html", recursive=True)):
    if f.split("/", 1)[0] not in PUBLIC_ROOTS: continue
    if f.startswith(("clients/", "go/", "gabe/", "node_modules/", "music/admin/", "call/admin/", "plethora/admin/", "402/", "stats/private/", "stats/hunt/")): continue
    url = "/" + f[:-len("index.html")]
    if url == "/people/": url_title = "army · join the people"
    src = open(f, encoding="utf-8").read()
    body = src.split("<body", 1)[-1]
    body = re.sub(r"<!-- secret-start -->.*?<!-- secret-end -->", "", body, flags=re.S)
    body = re.sub(r"<!-- PLETHORA_[A-Z]+ -->.*?<!-- /PLETHORA_[A-Z]+ -->", "", body, flags=re.S)
    keys = re.findall(r'data-i18n="([\w.]+)"', body)
    body = re.sub(r"<script.*?</script>|<style.*?</style>", " ", body, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", body))
    text += " " + " ".join(EN.get(k, "") for k in keys)
    title = re.search(r"<title>(.*?)</title>", src)
    title = (title.group(1).split("|")[0].strip() if title else url).lower()
    if url.startswith("/stats/"): url = "https://stats.corvus.gent/" + url[len("/stats/"): ]
    if url == "/people/":
        pages.append({"title": "gabe · about me", "url": "/gabe", "text": re.sub(r"<[^>]+>", " ", people["about"]["en"]) + " " + " ".join(EN.get(k, "") for k in ["profile.languages"]) + " " + " ".join(r["text"] for r in people.get("research", []))})
        title = "army · join the people"
    pages.append({"title": TITLES.get(url, title), "url": url, "text": text})
for track in json.load(open("music.json", encoding="utf-8"))["tracks"]:
    pages.append({"title": track["title"] + " · " + track.get("artist", ""), "url": "/music/#track=" + track["id"], "text": " ".join([track["title"], track.get("artist", ""), track.get("genre", ""), track.get("note", "")])})
for p in pages:
    p["text"] = re.sub(r"\s+", " ", p["text"]).strip().lower()[:6000]
json.dump(pages, open("search-index.json", "w", encoding="utf-8"), ensure_ascii=False)
print(len(pages), "pages indexed")
