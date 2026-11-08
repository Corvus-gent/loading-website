// Country/city aggregates share a scope and count each visitor once per country.
import { hogql, REAL } from './_posthog.js';
import { cityArea, regionFor, AREA_POLICY } from './_geo-areas.js';
import { countryCategory } from '../js/analytics-policy.js';
// Country label points: Natural Earth 1:110m countries (public domain), rounded to 0.1°.
// https://www.naturalearthdata.com/about/terms-of-use/
const centroids = new Map([["FJ",[-17.8,178.0]],["TZ",[-6.1,35.0]],["EH",[24.0,-12.6]],["CA",[60.3,-101.9]],["US",[39.5,-97.5]],["KZ",[49.1,68.7]],["UZ",[41.7,64.0]],["PG",[-5.7,143.9]],["ID",[-1.0,101.9]],["AR",[-33.5,-64.2]],["CL",[-38.2,-72.3]],["CD",[-1.9,23.5]],["SO",[3.6,45.2]],["KE",[0.5,37.9]],["SD",[16.3,29.3]],["TD",[15.1,18.6]],["HT",[19.3,-72.2]],["DO",[19.1,-70.7]],["RU",[58.2,44.7]],["BS",[26.4,-77.1]],["FK",[-51.6,-58.7]],["NO",[61.4,9.7]],["GL",[74.3,-39.3]],["TF",[-49.3,69.1]],["TL",[-8.8,125.9]],["ZA",[-29.7,23.7]],["LS",[-29.5,28.2]],["MX",[23.9,-102.3]],["UY",[-33.0,-56.0]],["BR",[-12.1,-49.6]],["BO",[-16.7,-64.6]],["PE",[-13.0,-72.9]],["CO",[3.4,-73.2]],["PA",[8.7,-80.4]],["CR",[10.1,-84.1]],["NI",[12.7,-85.1]],["HN",[14.8,-86.9]],["SV",[13.7,-88.9]],["GT",[15.0,-90.5]],["BZ",[17.2,-88.7]],["VE",[7.2,-64.6]],["GY",[5.1,-58.9]],["SR",[4.1,-55.9]],["FR",[46.7,2.6]],["EC",[-1.3,-78.2]],["PR",[18.2,-66.5]],["JM",[18.1,-77.3]],["CU",[21.3,-78.0]],["ZW",[-18.9,29.9]],["BW",[-22.1,24.2]],["NA",[-20.6,17.1]],["SN",[15.1,-14.8]],["ML",[18.7,-2.0]],["MR",[19.6,-9.7]],["BJ",[10.3,2.4]],["NE",[17.4,9.5]],["NG",[9.4,7.5]],["CM",[4.6,12.5]],["TG",[8.8,1.1]],["GH",[7.7,-1.0]],["CI",[7.5,-5.6]],["GN",[10.6,-10.0]],["GW",[12.2,-14.5]],["LR",[6.4,-9.5]],["SL",[8.6,-11.8]],["BF",[12.7,-1.4]],["CF",[7.0,20.9]],["CG",[0.1,15.9]],["GA",[-0.4,11.8]],["GQ",[2.3,9.0]],["ZM",[-14.7,26.4]],["MW",[-13.4,33.6]],["MZ",[-13.9,37.8]],["SZ",[-26.5,31.5]],["AO",[-12.2,18.0]],["BI",[-3.3,29.9]],["IL",[30.9,34.8]],["LB",[34.1,36.0]],["MG",[-18.6,46.7]],["PS",[32.0,35.3]],["GM",[13.6,-15.0]],["TN",[33.7,9.0]],["DZ",[27.4,2.8]],["JO",[30.8,36.4]],["AE",[23.5,54.5]],["QA",[25.2,51.1]],["KW",[29.4,47.3]],["IQ",[33.1,43.3]],["OM",[22.1,57.3]],["VU",[-15.4,166.9]],["KH",[12.6,104.5]],["TH",[15.5,101.1]],["LA",[19.4,102.5]],["MM",[21.6,95.8]],["VN",[21.7,105.4]],["KP",[39.9,126.4]],["KR",[36.4,128.1]],["MN",[46.0,104.2]],["IN",[22.7,79.4]],["BD",[24.2,89.7]],["BT",[27.5,90.0]],["NP",[28.3,83.6]],["PK",[29.3,68.5]],["AF",[34.2,66.5]],["TJ",[38.2,72.6]],["KG",[41.7,74.5]],["TM",[39.9,58.7]],["IR",[32.2,54.9]],["SY",[35.0,38.3]],["AM",[40.5,44.8]],["SE",[65.9,19.0]],["BY",[53.8,28.4]],["UA",[49.7,32.1]],["PL",[52.0,19.5]],["AT",[47.5,14.1]],["HU",[47.1,19.4]],["MD",[47.4,28.5]],["RO",[45.7,25.0]],["LT",[55.1,24.1]],["LV",[57.1,25.5]],["EE",[58.7,25.9]],["DE",[51.0,9.7]],["BG",[42.5,25.2]],["GR",[39.5,21.7]],["TR",[39.3,34.5]],["AL",[40.7,20.1]],["HR",[45.8,16.4]],["CH",[46.7,7.5]],["LU",[49.7,6.1]],["BE",[50.8,4.8]],["NL",[52.4,5.6]],["PT",[39.6,-8.3]],["ES",[40.1,-3.5]],["IE",[53.1,-7.8]],["NC",[-21.1,165.1]],["SB",[-8.0,159.2]],["NZ",[-39.8,172.8]],["AU",[-24.1,134.0]],["LK",[7.6,80.7]],["CN",[32.5,106.3]],["TW",[23.7,120.9]],["IT",[44.7,11.1]],["DK",[56.0,9.0]],["GB",[54.4,-2.1]],["IS",[64.8,-18.7]],["AZ",[40.4,47.2]],["GE",[41.9,43.7]],["PH",[11.2,122.5]],["MY",[2.5,113.8]],["BN",[4.4,114.6]],["SI",[46.1,14.9]],["FI",[63.3,27.3]],["SK",[48.7,19.0]],["CZ",[49.9,15.4]],["ER",[15.8,38.3]],["JP",[36.1,138.4]],["PY",[-21.7,-60.1]],["YE",[15.3,45.9]],["SA",[23.8,44.7]],["AQ",[-79.8,35.9]],["CY",[34.9,33.1]],["MA",[31.7,-7.2]],["EG",[26.2,29.4]],["LY",[26.6,18.0]],["ET",[8.0,39.1]],["DJ",[12.0,42.5]],["UG",[2.0,32.9]],["RW",[-1.9,30.1]],["BA",[44.1,18.1]],["MK",[41.6,21.6]],["RS",[44.2,20.8]],["ME",[42.8,19.1]],["XK",[42.6,20.9]],["TT",[11.0,-60.9]],["SS",[7.2,30.4]]]);
// Small territories omitted from the game's polygon dataset.
for (const [code, coords] of Object.entries({US:[39.8,-98.6],MY:[4.2,101.9],PK:[30.4,69.3],HK:[22.3,114.2],SG:[1.4,103.8],TW:[23.7,121],MO:[22.2,113.5],MT:[35.9,14.4],MC:[43.7,7.4],VA:[41.9,12.5],AD:[42.5,1.5],LI:[47.2,9.6],SM:[43.9,12.5],BH:[26.1,50.6],MV:[3.2,73.2],BB:[13.2,-59.5],AW:[12.5,-70],CW:[12.2,-69],BM:[32.3,-64.8],GI:[36.1,-5.4],JE:[49.2,-2.1],GG:[49.5,-2.6],IM:[54.2,-4.5],RE:[-21.1,55.5],GP:[16.3,-61.6],MQ:[14.6,-61],YT:[-12.8,45.2],FO:[62,-6.9],AX:[60.2,20],KY:[19.3,-81.3],VG:[18.4,-64.6],VI:[18.3,-64.9],PF:[-17.7,-149.4],GU:[13.4,144.8],MP:[15.2,145.8],AS:[-14.3,-170.7],WS:[-13.8,-172.1],TO:[-21.2,-175.2],FM:[7.4,150.6],MH:[7.1,171.2],PW:[7.5,134.6],NR:[-0.5,166.9],TV:[-8.5,179.2],KI:[1.9,-157.4],ST:[0.2,6.6],SC:[-4.7,55.5],MU:[-20.2,57.5],CV:[16,-24],KM:[-11.9,43.9],GD:[12.1,-61.7],LC:[13.9,-61],VC:[13.3,-61.2],DM:[15.4,-61.4],AG:[17.1,-61.8],KN:[17.3,-62.7]})) centroids.set(code,coords);
const regions = new Intl.DisplayNames(['en'], {type:'region'});
export const COUNTRY_SQL = "coalesce(nullIf(properties.corvus_country_code, ''), nullIf(properties.$geoip_country_code, ''), nullIf(properties.$geoip_country_name, ''), '?')";
export function geoQuery(day) {
  if (day !== 'all' && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('invalid day');
  const scope = day === 'all' ? '' : ` AND toDate(toTimeZone(timestamp, 'Europe/Brussels')) = toDate('${day}')`;
  // Prefer the last known city, retaining an older valid location if a later
  // pageview has only a country. IDs stay inside the database query.
  const city = "toString(coalesce(nullIf(properties.corvus_city, ''), properties.$geoip_city_name, ''))";
  const region = "toString(coalesce(nullIf(properties.corvus_region, ''), properties.$geoip_subdivision_1_name, ''))";
  const lat = "toString(coalesce(properties.corvus_latitude, properties.$geoip_latitude, ''))";
  const lng = "toString(coalesce(properties.corvus_longitude, properties.$geoip_longitude, ''))";
  return `SELECT country, tupleElement(place,1), tupleElement(place,2), tupleElement(place,3), tupleElement(place,4), count()
FROM (SELECT toString(${COUNTRY_SQL}) country, distinct_id,
argMax(tuple(${region},${city},${lat},${lng}), tuple(multiIf(${city} != '' AND ${lat} != '' AND ${lng} != '', 2, ${region} != '', 1, 0), timestamp)) place
FROM events WHERE event = '$pageview' AND ${REAL}${scope} GROUP BY country, distinct_id)
GROUP BY country, place LIMIT 10000`;
}
const clean = value => typeof value === 'string' && !/[@<>\r\n]/.test(value) ? value.trim().slice(0,100) : '';
export function geoRows(rows) {
  if(rows.length>=10000)throw Error('geo result limit reached');
  const countries=new Map(),groups=new Map(),unknown=new Map();
  const addUnknown=(code,n)=>unknown.set(code,(unknown.get(code)||0)+n);
  const add=(point,n)=>{const key=JSON.stringify([point.countryCode,point.precision,point.region,point.city]);const g=groups.get(key)||{...point,visitors:0};g.visitors+=n;groups.set(key,g);};
  for(const [rawCountry,rawRegion,rawCity,rawLat,rawLng,count] of rows){
    const n=Number(count);if(!Number.isSafeInteger(n)||n<1)continue;
    const code=countryCategory(rawCountry),region=clean(rawRegion),city=clean(rawCity);
    const lat=rawLat==null||rawLat===''?NaN:Number(rawLat),lng=rawLng==null||rawLng===''?NaN:Number(rawLng);
    countries.set(code,(countries.get(code)||0)+n);
    const shared={countryCode:code,country:code==='?'?'unknown location':regions.of(code),unknown:false};
    const area=cityArea(code,region,city,lat,lng),state=regionFor(code,region);
    if(area)add({...shared,...area},n);
    else if(city&&Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180)add({...shared,region:state?.region||region,city,lat:Math.round(lat*10)/10,lng:Math.round(lng*10)/10,precision:'city'},n);
    else if(state)add({...shared,...state,city:'',precision:'region',approximate:true},n);
    else addUnknown(code,n);
  }
  const cities=[],regional=new Map();
  for(const g of groups.values()){
    if(g.precision!=='region'&&g.visitors>=AREA_POLICY.minVisitors){cities.push(g);continue;}
    const state=regionFor(g.countryCode,g.region);
    if(!state){addUnknown(g.countryCode,g.visitors);continue;}
    const key=g.countryCode+':'+state.region;
    const r=regional.get(key)||{...g,...state,city:'',visitors:0,precision:'region',approximate:true};r.visitors+=g.visitors;regional.set(key,r);
  }
  for(const g of regional.values())if(g.visitors>=AREA_POLICY.minVisitors)cities.push(g);else addUnknown(g.countryCode,g.visitors);
  let unlocated=0;
  for(const [code,n]of unknown){const coords=centroids.get(code);if(!coords){unlocated+=n;continue;}cities.push({countryCode:code,country:regions.of(code),region:'',city:'',lat:coords[0],lng:coords[1],visitors:n,unknown:true,precision:'country'});}
  const list=[...countries].map(([c,n])=>({c,n})).sort((a,b)=>b.n-a.n||a.c.localeCompare(b.c));
  const total=list.reduce((n,c)=>n+c.n,0),mapped=cities.reduce((n,c)=>n+c.visitors,0);
  for(const c of list){const plotted=cities.filter(p=>p.countryCode===c.c).reduce((n,p)=>n+p.visitors,0);if(c.c!=='?'&&plotted!==c.n)console.warn('geo count mismatch',c.c,c.n,plotted);}
  return {geoVersion:6,countries:list,cities,total,mapped,unlocated,located:cities.filter(c=>!c.unknown).reduce((n,c)=>n+c.visitors,0)};
}
export async function geoData(day, query=hogql){
  const detailed=geoQuery(day); // validates before SQL interpolation
  const scope=day==='all'?'':` AND toDate(toTimeZone(timestamp,'Europe/Brussels'))=toDate('${day}')`;
  const [counts,locations]=await Promise.allSettled([
    query(`SELECT ${COUNTRY_SQL} c, count(DISTINCT distinct_id) n FROM events WHERE event='$pageview' AND ${REAL}${scope} GROUP BY c ORDER BY n DESC, c ASC LIMIT 300`),
    query(detailed)
  ]);
  if(counts.status!=='fulfilled')throw Error('country source unavailable');
  const base=geoRows(counts.value.map(([c,n])=>[c,'','',null,null,n]));
  if(locations.status!=='fulfilled'){console.warn('geo details unavailable',String(locations.reason?.message).slice(0,100));return {...base,cityUnavailable:true};}
  const located=geoRows(locations.value), cities=[];
  for(const {c,n} of base.countries){
    const points=located.cities.filter(p=>p.countryCode===c), sum=points.reduce((v,p)=>v+p.visitors,0);
    if(sum===n)cities.push(...points);
    else { if(c!=='?')console.warn('geo count mismatch',day,c,n,sum);cities.push(...base.cities.filter(p=>p.countryCode===c)); }
  }
  return {...base,cities,mapped:cities.reduce((n,c)=>n+c.visitors,0),located:cities.filter(c=>!c.unknown).reduce((n,c)=>n+c.visitors,0),cityUnavailable:false};
}
