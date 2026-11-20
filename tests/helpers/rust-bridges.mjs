// Temporary adapters expose the same module exports while the old app is migrated.
// These contain only module wiring; all replacement behavior lives in Rust/WASM.
const wasm='/rust/browser/pkg/corvus_browser.js';
const bridges={
 '/js/i18n/language.js':`import init,* as m from '${wasm}';await init();m.start_languages();export const LANGS=m.language_codes(),getLang=m.get_language,t=m.translate,pick=m.pick_language,applyI18n=m.apply_language,renderSwitcher=m.render_language_switcher;`,
 '/js/i18n/bar.js':`import './language.js';import {start_language_bar} from '${wasm}';start_language_bar();`,
 '/js/live-banner.js':`import init,{start_live_banner} from '${wasm}';await init();start_live_banner();`,
 '/js/portal.js':`import init,{start_portal} from '${wasm}';await init();start_portal();`,
 '/js/arrival.js':`import init,* as m from '${wasm}';const {search,pathname}=location;await init();m.start_arrival(search,pathname);export const arrivalSearch=m.arrival_search(),sidequestsPage=m.sidequests_page(),clearTrackingURL=m.clear_tracking_url;`,
 '/js/support.js':`import '/js/arrival.js';import init,{start_support} from '${wasm}';await init();start_support();`,
 '/call/admin/admin.js':`import init,{start_support_admin} from '${wasm}';await init();start_support_admin();`,
};
export const wasmBridge=path=>bridges[path]||null;
