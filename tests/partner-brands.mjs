import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyPartnerBrand,partnerFor} from '../tools/site/partner-brands.mjs';
const template='<html><head></head><body><main><form data-comment><input name="text"></form><a href="/go/cardneto-demo">Demo</a></main></body></html>';
for(const file of ['friends/cardneto/index.html','plethora/index.html','compound/impact/index.html','compound/v2/index.html','hack/1/index.html','hack/2/index.html']){
 const once=applyPartnerBrand(template,file);
 assert.equal(applyPartnerBrand(once,file),once,'build must not duplicate branding');
 assert.ok(once.includes('<form data-comment><input name="text"></form>'),'preserve form hooks');
 assert.ok(once.includes('<a href="/go/cardneto-demo">Demo</a>'),'preserve attribution route');
 assert.equal((once.match(/class="partner-masthead"/g)||[]).length,1);
 assert.ok(fs.readFileSync(file,'utf8').includes(`data-partner="${partnerFor(file).id}"`));
}
for(const file of ['index.html','plethora/admin/index.html','compound/admin/index.html','legion/join/index.html'])assert.equal(partnerFor(file),null);
assert.ok(fs.readFileSync('.vercelignore','utf8').includes('!tools/site/partner-brands.mjs'),'include brand builder on Vercel');
assert.ok(fs.existsSync('friends/cardneto/assets/product.webp'));
console.log('Partner branding: repeatable build, protected admin scope, form/referral preservation and deployment inputs passed.');
