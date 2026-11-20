# Public GitHub evidence on CV pages

`cv/github-activity.json` is a dated, reproducible sample from eleven selected public default branches. It includes Gabriel's primary-author, non-merge commits and gross additions/removals in source files, grouped by commit timestamp. Private repositories, unmerged branches and co-authored-only contributions are outside the sample. Commit time does not establish push time.

HTML, JSON, notebooks, lockfiles, binaries, dependencies, known generated files and build output are excluded. Rewrites, AI-assisted additions, and repeated changes count again; these numbers are activity, not unique lines or code quality. Earlier years use the same repositories and rules. Do not describe this sample as total lifetime GitHub activity.

Refresh full local clones of the listed repositories. Name directories `owner--repository`, then run:

```
python3 tools/cv/github-activity.py --repos-dir /path/to/clones --loading-repo /path/to/loading-website
python3 tools/cv/github-activity.py --repos-dir /path/to/clones --loading-repo /path/to/loading-website --pinned
npm run build:cv
npm run test:cv
```

The pinned check reproduces every per-repository aggregate against exact recorded refs and the snapshot cutoff. Public HTML includes the methodology, linked refs, and downloadable JSON. Snapshot reads never trigger writes to GitHub.

The LinkedIn block retains the last verified aggregate export. The owner's approximately 50% growth report on 20 November is explicitly separate; exact totals require a fresh export through the existing LinkedIn importer. Never multiply all old metrics by 1.5 or fabricate daily data.
