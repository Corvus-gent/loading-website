# Yogi Power languages

Dutch is the source language. `?lang=fr`, `?lang=en` and `?lang=es` select the other languages; a visitor's choice is also remembered in `yp-language` local storage. The code gate keeps its existing storage key and behavior.

The three static catalogs in `locales/` use Dutch presentation strings as keys. Keep `{0}`, `{1}`, etc. in translated sentences: these slots carry counts, dates, names and other dynamic content. Update all three catalogs together when adding copy. No model or external translation service runs in the visitor's browser.

`i18n.js` translates text nodes and accessible labels. It does not rewrite routes, event handlers, input values or stored booking records. Implicit option values are pinned to their Dutch values before their labels are translated. New views, dialogs and notices are translated as they are rendered.

Run `npm run test:yogipower` for catalog and rendering contracts. Verify language switching on the code screen and an unfinished form, plus the customer booking dialog, at mobile width.
