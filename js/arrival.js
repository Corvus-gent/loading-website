// Keep arrival tags only in this page's memory. A later consent choice or a
// link-hub click can still use them after the address bar has been cleaned.
export const arrivalSearch = (() => {
 const tags=new URLSearchParams();
 for(const [key,value]of new URLSearchParams(location.search))if(/^utm_/i.test(key))tags.append(key,value);
 return tags.toString()?'?'+tags.toString():'';
})();
export const sidequestsPage = /^\/sidequests\/?$/.test(location.pathname);
export function clearTrackingURL(){
 try{
  const url=new URL(location.href);let changed=false;
  if(sidequestsPage && url.pathname.endsWith('/')) { url.pathname='/sidequests'; changed=true; }
  for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||(!sidequestsPage && /^ref$/i.test(key))){url.searchParams.delete(key);changed=true;}
  if(changed)history.replaceState(history.state,'',url.pathname+url.search+url.hash);
 }catch{/* Restricted browser history must not break the page. */}
}
