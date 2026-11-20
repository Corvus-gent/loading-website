# Philosophy CV

`lib/philosophy/page.mjs` is the only page component. Translation data lives in
`cv/filosofie/content.json`; `tools/philosophy/build.mjs` compiles the Dutch and
English HTML artifacts at the end of the normal site build. Edit the component or
translation data rather than editing the generated HTML pages.

- `/cv/filosofie`: Dutch, even after an English browser or saved preference.
- `/cv/philosophy`: English, even after a Dutch saved preference.
- `/filosofie` redirects permanently to the Dutch route.
- The old `/cv/filosofie/en` URL redirects permanently to the English route.
- Each rendered language declares its own production canonical and both hreflang alternatives.

The page imports the existing `js/i18n/bar.js` component and
`css/site/languages.css` stylesheet used by the homepage. Homepage markup and
styles are unchanged. The shared switcher accepts optional `data-language-routes`
on the document: NL/EN navigate to the CV routes, while the other five languages
open the corresponding homepage language rather than claiming to translate the CV.
Pages without that attribute keep the existing query-string switching behavior.

Appearance follows the system preference by default. The reading page also offers
a local light/dark/system selector; its saved preference affects only this CV.
Existing portrait and personal-copy placeholders are preserved.

Validation:

```sh
npm run build
npm run lint
npm run test:philosophy
```

`lint` runs the JavaScript syntax and locale-contract checks already used by CI,
without introducing a new linter dependency. Browser QA covers NL/EN × 375/1440 px
× light/dark, navigation through both language controls, canonical metadata, and
homepage header geometry/fonts/colors before and after the change.
