import {cityCatalog} from '../js/data/geo-cities.generated.js';
import {regionCatalog} from './_geo-regions.generated.js';
export const AREA_POLICY={maxDistanceKm:200,minVisitors:2};
const norm=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const countries=new Map(),regions=new Map();
for(const [country,region,city,lat,lng]of cityCatalog){if(!countries.has(country))countries.set(country,[]);countries.get(country).push({countryCode:country,region,city,lat,lng});}
for(const [country,code,name,lat,lng,aliases]of regionCatalog){const r={countryCode:country,region:code,regionName:name,lat,lng};for(const alias of [...aliases,country+'-'+code])if(norm(alias))regions.set(country+':'+norm(alias),r);}
export const regionFor=(country,name)=>norm(name)?regions.get(country+':'+norm(name)):undefined;
export function distanceKm(a,b){const r=Math.PI/180,dy=(b.lat-a.lat)*r,dx=(b.lng-a.lng)*r;const h=Math.sin(dy/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dx/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)));}
export function cityArea(country,rawRegion,city,lat,lng){
  const region=regionFor(country,rawRegion),all=countries.get(country)||[];
  // Never move a known state/province to a city in another subdivision.
  const candidates=region?all.filter(c=>c.region===region.region):all;
  const exact=candidates.find(c=>norm(c.city)===norm(city));
  const usable=Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180;
  if(!usable)return exact?{...exact,precision:'metro',approximate:true}:null;
  if(!city)return null; // Country/state coordinates alone are not a city observation.
  let closest,km=Infinity;
  for(const candidate of candidates){const d=distanceKm({lat,lng},candidate);if(d<km){closest=candidate;km=d;}}
  return closest&&km<=AREA_POLICY.maxDistanceKm?{...closest,precision:'metro',approximate:true}:null;
}
