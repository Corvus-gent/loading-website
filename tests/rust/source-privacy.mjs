import assert from 'node:assert/strict';
import middleware from '../../middleware.js';
for(const path of ['/rust/server/config.rs','/rust/migration/inventory.json','/Cargo.toml','/Cargo.lock','/rust-toolchain.toml','/rust//core/src/lib.rs','/rust/%73erver/config.rs']){
 const response=middleware(new Request('https://corvus.gent'+path));assert.equal(response.status,404,path);assert.equal(response.headers.get('cache-control'),'no-store');
}
console.log('PASS: Rust source, fixtures, Cargo manifests and toolchain are not public website routes.');
