import fs from 'node:fs'; import test from 'node:test'; import assert from 'node:assert/strict';
const {instance:{exports:X}}=await WebAssembly.instantiate(fs.readFileSync(new URL('../../the6cube/anatomy/net.wasm', import.meta.url)),{});
function rnd(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function js(p,n,spread,rr){const r=rnd(p.seed),K=[];for(let i=0;i<n;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*p.r*spread;K.push({x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d,r:p.r*rr*(.6+r()*.8),seed:p.seed*31+i+1,act:r()})}
 const E=[];for(let i=0;i<K.length;i++){const near=K.map((k,j)=>[j,Math.hypot(k.x-K[i].x,k.y-K[i].y)]).filter(x=>x[0]!==i).sort((a,b)=>a[1]-b[1]).slice(0,3);for(const[j]of near)if(j>i)E.push([i,j])}return{K,E}}
let maxd=0,edgeDiff=0,tj=0,tc=0;
for(let t=0;t<300;t++){const p={x:(t*37)%500-250,y:(t*91)%400-200,r:40+t%20,seed:t*7919+13+(t%3)*190000};const n=t%2?46:26;
 let a=performance.now();const J=js(p,n,1.5,.12);tj+=performance.now()-a;a=performance.now();const m=X.grow(p.x,p.y,p.r,p.seed,n,1.5,.12);tc+=performance.now()-a;
 const o=new Float64Array(X.memory.buffer,X.out_ptr(),n*5),e=new Int32Array(X.memory.buffer,X.edges_ptr(),m*2);
 for(let i=0;i<n;i++){maxd=Math.max(maxd,Math.abs(o[i*5]-J.K[i].x),Math.abs(o[i*5+1]-J.K[i].y),Math.abs(o[i*5+2]-J.K[i].r),Math.abs(o[i*5+4]-J.K[i].act));}
 const ce=[];for(let i=0;i<m;i++)ce.push(e[i*2]+'-'+e[i*2+1]);if(ce.join()!==J.E.map(x=>x.join('-')).join())edgeDiff++;}
test('anatomy: C network grower equals JS', () => { assert.ok(maxd < 1e-9); assert.equal(edgeDiff, 0); });
