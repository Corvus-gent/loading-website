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

Career application profiles and PDFs distinguish Paris/London as European options from the preference to spend summer 2027 in the US or China, with San Francisco, New York, Shanghai, Hong Kong and Shenzhen named as cities of interest. These are preferences, not claims of work authorization or confirmed relocation.
