# Application CV profiles

`cv/profiles.json` holds verified background information, experience, projects and the eleven profile-specific introductions. `lib/cv/page.mjs` is the shared renderer; `tools/cv/build.mjs` compiles the static pages before site discovery. The general site chrome skips these pages to keep the reading layout and explicit CV navigation intact.

University routes:
- `/cv/studies/stanford`: Social Media Manager at Stanford GSB (the supplied LinkedIn role 4440338133), **not** a study or employment claim.
- `/cv/studies/berkeley` and `/cv/studies/harvard`: exploratory study profiles. No programme, admission, supervisor or eligibility is asserted.
- `/cv/studies/kul`: alias to the existing Dutch philosophy page. Existing NL/EN and seven-language CV URLs remain unchanged.

Work routes:
- `/cv/tech/`, `/cv/social-media/`: general editions.
- `/cv/work/google`, `/cv/work/apple`, `/cv/work/openai`, `/cv/work/anthropic`, `/cv/work/amazon`, `/cv/work/mistral`: research/social-media application profiles, based on the candidate's stated interests. They do not claim a specific vacancy or employment relationship.

All profiles are English application editions. Philosophy translations remain separate. Each page links to the CV hub and has a canonical URL and its own PDF download. The hub retains separate web/PDF actions and now links to every profile.

Evidence is dated: LinkedIn statistics are compiled from `stats/linkedin/data.json`, including the export period; they are not described as live. Research is described as course research rather than peer-reviewed publication. Pidgy/Alkmist is previous experience (October 2026), and the discontinued master's is distinct from the completed bachelor's.

## Build and validation

- `npm run build:cv`: compile web pages.
- `python3 tools/cv/build-pdfs.py`: regenerate PDFs with reportlab/pypdf installed. The generated PDFs are committed and copied from `output/pdf/` into their deployed `cv/` locations; Vercel does not need Python PDF dependencies.
- `npm run build`, `npm run lint`, `npm run test:cv`, `npm run test:philosophy`.
- Render regenerated PDFs with Poppler and visually inspect before committing.

The existing `/cv/tech/download` analytics API still serves `cv/gabe.pdf`; `/cv/socials/download` still serves `cv/social-media.pdf`. Profile-specific download rewrites return the matching PDF with attachment headers. No job application is submitted automatically.

The hub now has separate Studies, Work and Research section links. Employer profiles appear under Research; Tech/Social Media remain under Work. The Compound sample uses Simon Lorenzo’s existing portrait with contain sizing. To regenerate only one PDF: `python3 tools/cv/build-pdfs.py --only amazon`.

Mistral AI has its own research-oriented profile, explicitly expressing Paris/London location preferences. No employment or vacancy eligibility is asserted.

Location relevance: the generic European-options line is removed everywhere. Only the general Tech and Social Media editions show the broad summer-2027 US/China preference. Targeted institutional and company profiles omit that global travel list; role-specific location text (for example Mistral Paris/London) remains in its own introduction.

## Download integrity

The PDF generator writes `cv/pdf-manifest.json` with source and generator hashes, PDF byte hashes, and page counts. `npm run build:cv` refuses stale or modified downloads before compiling the HTML, so editing candidate copy cannot silently publish a website with an old PDF. Run `python3 tools/cv/build-pdfs.py` before building after content changes. `npm run check:cv-pdfs` checks the existing assets without regenerating them. Card images and employer ordering are presentation-only and do not invalidate the PDFs.

PDF generation is deterministic (`invariant=1`), and the author's identity and location come from the shared data. Each output must be exactly one page. The technical edition now includes the course research papers and a concise earlier-experience line; detailed experience remains on the website.

The technical PDF API serves the file before optional analytics completes. Aggregate counters use the existing Redis pipeline in Vercel `waitUntil` background work. HEAD and bots do not increment counters; unsupported methods receive 405. A counter outage cannot delay the PDF response.

Proper names, company marks, identity headings, social handles and original paper titles use `translate="no"`. Targeted catalog corrections preserve the exact company and candidate names, and the research CTA has authored translations.
