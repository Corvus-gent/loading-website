#!/usr/bin/env python3
"""Count Gabe's GitHub work per day -> week/stats.json.

Needs: gh CLI logged in as gabe-maxxing (private repos included).
Usage:  python3 scripts/week_stats.py 2026-11-23 [--user gabe-maxxing] [--out week/stats.json]
Days are bucketed in Europe/Brussels time. Counts commits authored by the user on
each repo's default branch, plus PRs authored by the user and merged that week.
"""
import argparse, json, subprocess, sys
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Brussels")


def gh(*args):
    out = subprocess.run(["gh", "api", *args], capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr.strip())
    return json.loads(out.stdout) if out.stdout.strip() else None


def gh_pages(path):
    out = subprocess.run(["gh", "api", "--paginate", "--slurp", path], capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr.strip())
    pages = json.loads(out.stdout or "[]")
    return [x for p in pages for x in (p if isinstance(p, list) else p.get("items", []))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("monday")
    ap.add_argument("--user", default="gabe-maxxing")
    ap.add_argument("--out", default="week/stats.json")
    a = ap.parse_args()

    mon = date.fromisoformat(a.monday)
    days = [mon + timedelta(i) for i in range(7)]
    start = datetime.combine(mon, datetime.min.time(), TZ).astimezone(timezone.utc)
    end = start + timedelta(days=7)
    iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ")
    stats = {d.isoformat(): {"commits": 0, "additions": 0, "deletions": 0, "prs_merged": 0, "repos": set()} for d in days}

    repos = gh_pages(f"user/repos?affiliation=owner,collaborator,organization_member&per_page=100&sort=pushed")
    for r in repos:
        if r.get("pushed_at") and r["pushed_at"] < iso(start):
            continue
        name = r["full_name"]
        try:
            commits = gh_pages(f"repos/{name}/commits?author={a.user}&since={iso(start)}&until={iso(end)}&per_page=100")
        except RuntimeError as e:
            print(f"skip {name}: {e}", file=sys.stderr)
            continue
        for c in commits:
            when = datetime.fromisoformat(c["commit"]["author"]["date"].replace("Z", "+00:00")).astimezone(TZ).date().isoformat()
            if when not in stats:
                continue
            detail = gh(f"repos/{name}/commits/{c['sha']}")
            s = stats[when]
            s["commits"] += 1
            s["additions"] += detail["stats"]["additions"]
            s["deletions"] += detail["stats"]["deletions"]
            s["repos"].add(name)

    q = f"author:{a.user} is:pr is:merged merged:{days[0]}..{days[-1]}"
    for pr in gh_pages(f"search/issues?q={q.replace(' ', '+')}&per_page=100"):
        merged = (pr.get("pull_request") or {}).get("merged_at")
        if not merged:
            continue
        when = datetime.fromisoformat(merged.replace("Z", "+00:00")).astimezone(TZ).date().isoformat()
        if when in stats:
            stats[when]["prs_merged"] += 1
            stats[when]["repos"].add(pr["repository_url"].split("/repos/")[1])

    all_repos = set().union(*(s["repos"] for s in stats.values()))
    out = {
        "week": f"{mon.isocalendar().year}-W{mon.isocalendar().week:02d}",
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "user": a.user,
        "totals": {
            "commits": sum(s["commits"] for s in stats.values()),
            "additions": sum(s["additions"] for s in stats.values()),
            "deletions": sum(s["deletions"] for s in stats.values()),
            "prs_merged": sum(s["prs_merged"] for s in stats.values()),
            "repos": len(all_repos),
        },
        # repo names stay out of the public file (private repos): only counts per day
        "days": {d: {**{k: v for k, v in s.items() if k != "repos"}, "repo_count": len(s["repos"])} for d, s in stats.items()},
    }
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2)
    print(json.dumps(out["totals"]))


if __name__ == "__main__":
    main()
