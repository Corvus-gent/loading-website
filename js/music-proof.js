// Run the browser's native SHA-256 off the UI thread. Each proof is one-time and action-bound.
self.onmessage = async ({data}) => {
  const {salt,bits}=data, encoder=new TextEncoder();
  for(let nonce=0;nonce<20000000;nonce++) {
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(`${salt}:${nonce}`)));
    let zeros=0;
    for(const byte of hash) { if(!byte) zeros+=8; else {zeros+=Math.clz32(byte)-24; break;} }
    if(zeros>=bits) {self.postMessage({nonce}); return;}
  }
  self.postMessage({error:true});
};
