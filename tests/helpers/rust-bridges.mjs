// Temporary adapters expose the same module exports while the old app is migrated.
// These contain only module wiring; all replacement behavior lives in Rust/WASM.
const wasm='/rust/browser/pkg/corvus_browser.js';
const bridges={
 '/compound/app.js':`import '/compound/client.js';import init,{start_compound_editor} from '${wasm}';await init();start_compound_editor();`,
 '/compound/clock.js':`import('${wasm}').then(async m=>{await m.default();m.start_compound_clock();});`,
 '/compound/cuts.js':`// Cut rendering and playback now live in the Rust module.`,
 '/compound/admin.js':`import '/compound/client.js';import init,{start_compound_editor_admin} from '${wasm}';await init();start_compound_editor_admin();`,
 '/compound/stats.js':`import '/compound/client.js';import init,{start_compound_editor_stats} from '${wasm}';await init();start_compound_editor_stats();`,
 '/compound/v2/admin.js':`import '/compound/client.js';import init,{start_compound_admin} from '${wasm}';await init();start_compound_admin();`,
 '/compound/v2/app.js':`import '/compound/client.js';import init,{start_compound_v2} from '${wasm}';await init();start_compound_v2();`,
 '/js/social-attribution.js':`import init,{inferred_source} from '${wasm}';await init();export const inferredSource=({search='',userAgent='',referrer=''}={})=>inferred_source(search,userAgent,referrer);`,
 '/compound/client.js':`import '/js/arrival.js';import '/js/analytics-consent.js';import init,* as m from '${wasm}';await init();m.start_compound_client();export const tags=m.compound_tags,deepAllowed=m.compound_deep_allowed,setDeep=m.compound_set_deep,node=m.compound_node,beacon=m.compound_beacon;export const api=(body,query='')=>m.compound_api(body,query);export const handlePreference={get:m.compound_handle,set:m.compound_set_handle};`,
 '/compound/impact/admin.js':`import init,{mount_impact_admin} from '${wasm}';await init();export const mountImpact=mount_impact_admin;`,
 '/compound/impact/app.js':`import init,{start_impact} from '${wasm}';await init();start_impact();`,
 '/hack/3/add/app.js':`import init,{start_interviews_admin} from '${wasm}';await init();start_interviews_admin();`,
 '/hack/3/interviews.js':`import init,{start_interviews} from '${wasm}';await init();start_interviews();`,
 '/js/privacy-page.js':`import {initI18n} from '/js/i18n.js?v=20261108live1';import init,{start_privacy_page,render_privacy_page} from '${wasm}';await init();start_privacy_page();initI18n(render_privacy_page);`,
 '/js/analytics-consent.js':`import init,* as m from '${wasm}';await init();m.start_consent();export const privacySignal=m.privacy_signal,consentChoice=m.consent_choice,analyticsAllowed=m.analytics_allowed,noticeDismissed=m.notice_dismissed,chooseAnalytics=m.choose_analytics;`,
 '/js/privacy.js':`import '/js/arrival.js';import init,{start_privacy} from '${wasm}';await init();start_privacy();`,
 '/battle/admin/client.js':`import init,{start_battle_admin} from '${wasm}';await init();start_battle_admin();`, 
 '/battle/client.js':`import init,{start_battle} from '${wasm}';await init();start_battle();`, 
 '/js/i18n/language.js':`import init,* as m from '${wasm}';await init();m.start_languages();export const LANGS=m.language_codes(),getLang=m.get_language,t=m.translate,pick=m.pick_language,applyI18n=m.apply_language,renderSwitcher=m.render_language_switcher;`,
 '/js/i18n/bar.js':`import './language.js';import {start_language_bar} from '${wasm}';start_language_bar();`,
 '/js/live-banner.js':`import init,{start_live_banner} from '${wasm}';await init();start_live_banner();`,
 '/js/portal.js':`import init,{start_portal} from '${wasm}';await init();start_portal();`,
 '/js/arrival.js':`import init,* as m from '${wasm}';const {search,pathname}=location;await init();m.start_arrival(search,pathname);export const arrivalSearch=m.arrival_search(),sidequestsPage=m.sidequests_page(),clearTrackingURL=m.clear_tracking_url;`,
 '/js/support.js':`import '/js/arrival.js';import init,{start_support} from '${wasm}';await init();start_support();`,
 '/call/admin/admin.js':`import init,{start_support_admin} from '${wasm}';await init();start_support_admin();`,
};
export const wasmBridge=path=>bridges[path]||null;
