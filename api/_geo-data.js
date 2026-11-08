// Country/city aggregates share a scope and count each visitor once per country.
import { hogql, REAL } from './_posthog.js';
import { countryCategory } from '../js/analytics-policy.js';
// Coarse country centroids from the existing games dataset; bundled for serverless.
const centroids = new Map([["CA",[60.3,-101.9]],["US",[39.5,-97.5]],["ID",[-1.0,101.9]],["AR",[-33.5,-64.2]],["KE",[0.5,37.9]],["NO",[61.4,9.7]],["MX",[23.9,-102.3]],["BR",[-12.1,-49.6]],["FR",[46.7,2.6]],["IN",[22.7,79.4]],["SE",[65.9,19.0]],["PL",[52.0,19.5]],["DE",[51.0,9.7]],["GR",[39.5,21.7]],["TR",[39.3,34.5]],["BE",[50.8,4.8]],["NL",[52.4,5.6]],["PT",[39.6,-8.3]],["ES",[40.1,-3.5]],["AU",[-24.1,134.0]],["CN",[32.5,106.3]],["IT",[44.7,11.1]],["GB",[54.4,-2.1]],["FI",[63.3,27.3]],["JP",[36.1,138.4]],["EG",[26.2,29.4]]]);
// Small territories omitted from the game's polygon dataset.
for (const [code, coords] of Object.entries({US:[39.8,-98.6],HK:[22.3,114.2],SG:[1.4,103.8],TW:[23.7,121],MO:[22.2,113.5],MT:[35.9,14.4],MC:[43.7,7.4],VA:[41.9,12.5],AD:[42.5,1.5],LI:[47.2,9.6],SM:[43.9,12.5],BH:[26.1,50.6],MV:[3.2,73.2],BB:[13.2,-59.5],AW:[12.5,-70],CW:[12.2,-69],BM:[32.3,-64.8],GI:[36.1,-5.4],JE:[49.2,-2.1],GG:[49.5,-2.6],IM:[54.2,-4.5],RE:[-21.1,55.5],GP:[16.3,-61.6],MQ:[14.6,-61],YT:[-12.8,45.2],FO:[62,-6.9],AX:[60.2,20],KY:[19.3,-81.3],VG:[18.4,-64.6],VI:[18.3,-64.9],PF:[-17.7,-149.4],GU:[13.4,144.8],MP:[15.2,145.8],AS:[-14.3,-170.7],WS:[-13.8,-172.1],TO:[-21.2,-175.2],FM:[7.4,150.6],MH:[7.1,171.2],PW:[7.5,134.6],NR:[-0.5,166.9],TV:[-8.5,179.2],KI:[1.9,-157.4],ST:[0.2,6.6],SC:[-4.7,55.5],MU:[-20.2,57.5],CV:[16,-24],KM:[-11.9,43.9],GD:[12.1,-61.7],LC:[13.9,-61],VC:[13.3,-61.2],DM:[15.4,-61.4],AG:[17.1,-61.8],KN:[17.3,-62.7]})) centroids.set(code,coords);
const regions = new Intl.DisplayNames(['en'], {type:'region'});
export const COUNTRY_SQL = "coalesce(nullIf(properties.corvus_country_code, ''), nullIf(properties.$geoip_country_code, ''), nullIf(properties.$geoip_country_name, ''), '?')";
export function geoQuery(day) {
  if (day !== 'all' && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('invalid day');
  const scope = day === 'all' ? '' : ` AND toDate(toTimeZone(timestamp, 'Europe/Brussels')) = toDate('${day}')`;
  // Prefer the last known city, retaining an older valid location if a later
  // pageview has only a country. IDs stay inside the database query.
  const city = "coalesce(nullIf(properties.corvus_city, ''), properties.$geoip_city_name, '')";
  const region = "coalesce(nullIf(properties.corvus_region, ''), properties.$geoip_subdivision_1_name, '')";
  const lat = "coalesce(properties.corvus_latitude, properties.$geoip_latitude)";
  const lng = "coalesce(properties.corvus_longitude, properties.$geoip_longitude)";
  return `SELECT country, tupleElement(place,1), tupleElement(place,2), tupleElement(place,3), tupleElement(place,4), count()
FROM (SELECT ${COUNTRY_SQL} country, distinct_id,
argMax(tuple(${region},${city},${lat},${lng}), tuple(if(${city} != '' AND ${lat} IS NOT NULL AND ${lng} IS NOT NULL, 1, 0), timestamp)) place
FROM events WHERE event = '$pageview' AND ${REAL}${scope} GROUP BY country, distinct_id)
GROUP BY country, place LIMIT 10000`;
}
const clean = value => typeof value === 'string' && !/[@<>\r\n]/.test(value) ? value.trim().slice(0,100) : '';
export function geoRows(rows) {
  if(rows.length>=10000)throw Error('geo result limit reached');
  const countries = new Map(), groups = new Map();
  for (const [rawCountry,rawRegion,rawCity,rawLat,rawLng,count] of rows) {
    const n=Number(count); if(!Number.isSafeInteger(n)||n<1) continue;
    const code=countryCategory(rawCountry), region=clean(rawRegion), city=clean(rawCity);
    const lat=rawLat==null||rawLat===''?NaN:Number(rawLat), lng=rawLng==null||rawLng===''?NaN:Number(rawLng);
    const known=city && Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180;
    countries.set(code,(countries.get(code)||0)+n);
    const key=JSON.stringify([code,known?region:'',known?city:'']);
    const g=groups.get(key)||{countryCode:code,country:code==='?'?'unknown location':regions.of(code),region:known?region:'',city:known?city:'',visitors:0,lat:0,lng:0,unknown:!known};
    g.visitors+=n; if(known){g.lat+=lat*n;g.lng+=lng*n;} groups.set(key,g);
  }
  const cities=[], unknown=new Map();
  for(const g of groups.values()) {
    // City privacy threshold stays >=2. Suppressed cities remain in country totals.
    if(g.unknown||g.visitors<2){unknown.set(g.countryCode,(unknown.get(g.countryCode)||0)+g.visitors);continue;}
    cities.push({...g,lat:Math.round(g.lat/g.visitors*10)/10,lng:Math.round(g.lng/g.visitors*10)/10});
  }
  let unlocated=0;
  for(const [code,n] of unknown){const coords=centroids.get(code);if(!coords){unlocated+=n;continue;}cities.push({countryCode:code,country:regions.of(code),region:'',city:'',lat:coords[0],lng:coords[1],visitors:n,unknown:true});}
  const list=[...countries].map(([c,n])=>({c,n})).sort((a,b)=>b.n-a.n||a.c.localeCompare(b.c));
  const total=list.reduce((n,c)=>n+c.n,0),mapped=cities.reduce((n,c)=>n+c.visitors,0);
  for(const c of list){const plotted=cities.filter(p=>p.countryCode===c.c).reduce((n,p)=>n+p.visitors,0);if(c.c!=='?'&&centroids.has(c.c)&&plotted!==c.n)console.warn('geo count mismatch',c.c,c.n,plotted);}
  return {geoVersion:3,countries:list,cities,total,mapped,unlocated};
}
export async function geoData(day, query=hogql){return geoRows(await query(geoQuery(day)));}
