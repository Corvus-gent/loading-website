// Opt-in laboratory treatment. Never imported by the production build.
// The landing page retains its tested lightweight JS; subsequent pages use Rust.
// This is a hybrid architecture experiment, not a completed all-Rust migration.
import {browserProfileHtml} from './browser-profiles.mjs';
export const LIGHT_PREFIX='/__corvus_light__/js/';
export const NEXT_PAGES=['/daily/','/gabe/','/map/','/languages/','/privacy/'];
export const CORE_ASSETS=['/rust/browser/pkg/core/corvus_browser.js','/rust/browser/pkg/core/corvus_browser_bg.wasm'];
export const PREDICTIVE_POLICY={pages:NEXT_PAGES,assets:CORE_ASSETS,maxDocuments:2,maxAssetBytes:800000,settleMs:800,visibleMs:1000};
export const progressiveAssetPath=pathname=>pathname.startsWith(LIGHT_PREFIX)?'/js/'+pathname.slice(LIGHT_PREFIX.length):pathname;
export function progressiveHtml(html,pathname,{predictive=true}={}){
 const route=new URL(pathname,'https://corvus.gent').pathname;
 if(route!=='/'&&route!=='/index.html')return browserProfileHtml(html,pathname);
 if(/<script\b[^>]*type=["']importmap/i.test(html))throw Error('An existing import map needs explicit integration');
 const map=JSON.stringify({imports:{'/js/':LIGHT_PREFIX}});
 html=html.replace(/(<script\b[^>]*\bsrc=["'])\/js\//gi,'$1'+LIGHT_PREFIX)
  .replace(/<head(?:\s[^>]*)?>/i,head=>head+`<script type="importmap" data-corvus-delivery="light-home">${map}</script>`);
 if(predictive)html=html.replace('</body>',`<script type="application/json" id="corvus-predictive-policy">${JSON.stringify(PREDICTIVE_POLICY)}</script><script type="module" src="/tools/rust/predictive-client.mjs"></script></body>`);
 return html;
}
