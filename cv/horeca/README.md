# Wintercircus hospitality applications

One tailored web CV, one-page PDF and draft email per venue. Nothing is sent automatically.

- Shared, user-supplied experience and contact details: `../bar-bougie/content.json`.
- Venue motivations, relevant strengths and colour themes: `venues.json`.
- Web pages, hub and email drafts: `tools/cv/build-hospitality.mjs`.
- PDF generation: `tools/cv/build-hospitality-pdfs.py` (Python with ReportLab, Pillow and pypdf; Arial/Georgia on macOS).
- PDFs are checked against a SHA-256 manifest during every build. Changing shared copy requires regeneration of both the hospitality and Bar Bougie PDFs.

```sh
python3 tools/cv/build-hospitality-pdfs.py
python3 tools/cv/build-bougie-pdf.py
npm run build
```

The styles are personal interpretations of the venues' public visual identities, not official employer pages. Each page links its reference site and declares that distinction. No vacancy, professional kitchen skill, cocktail expertise or employment relationship is implied.

## Sources checked 21 November 2026

- https://www.wintercircus.be/nl/food-and-drinks — current six food/drink operators.
- https://barbassie.be/en — rooftop identity; burgundy `#a31a1a`, warm white `#f5f2ea`, dark `#1a0708` from public CSS; public jobs/contact address.
- https://tribunegent.be/ — seasonal restaurant, understated editorial direction and public contact.
- https://www.sakaswintercircusbe.eu/ — Sākas / Chef Yoshi, Japanese food and understated presentation.
- https://www.bakkerklaas.be/ — bakery, breakfast/lunch/coffee; peach `#fcd8cc`, ink `#121617` from public CSS; contact.
- https://www.studiomario.be/ — same premises, evening pizza; cream `#f4f2e3`, clay and ink public CSS; contact. Application is for service support, not their advertised full-time pizzaiolo role.
- https://www.clubwintercircus.be/ — concert/nightlife venue; separate bar/event support application.

No casino is listed in Wintercircus' official food/drink directory. No casino brand, recipient or claimed affiliation was invented. Sākas and Club email recipients remain unconfirmed in the drafts; use their official contact channels to verify.

## Scope

Bar Bougie retains its original visual design and Trudy/Corgi content. The €162.70 customer anecdote belongs only to Bar Bougie, not the other applications. A brief sentence about local hackathon partnerships is secondary to the hospitality application.
