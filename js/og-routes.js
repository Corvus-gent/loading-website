import {LANGUAGES,HOOKS,parseSlug} from '../compound/v2/config.js';
export function ogRoute(path,query=new URLSearchParams()){
 path=path.replace(/\/$/,'');
 if(path==='/live')return{kind:'live'};
 if(path==='/hack/3'){const n=query.get('interview');return /^[1-9]\d{0,3}$/.test(n||'')?{kind:'interview',n}: {kind:'hack3'};}
 const m=/^\/compound\/v2(?:\/([a-z]{2})(?:\/([a-z]+)(?:\/([1-9]\d{0,3}))?)?)?$/.exec(path);
 if(!m||(m[1]&&!Object.hasOwn(LANGUAGES,m[1]))||(m[2]&&!Object.hasOwn(HOOKS,m[2])))return null;
 const result={kind:'compound'};for(const[k,v]of [['lang',m[1]],['hook',m[2]],['n',m[3]]])if(v)result[k]=v;
 const slug=query.get('video')||query.get('utm_content'),v=parseSlug(slug);if(v&&v.lang===m[1]&&v.hook===m[2]&&v.n===Number(m[3]))result.video=slug;return result;
}
