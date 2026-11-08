// Rebuild public-domain reference geography; no visitor data is involved.
import fs from 'node:fs/promises';
const base='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
async function read(local,name){try{return JSON.parse(await fs.readFile(local));}catch{const r=await fetch(base+name);if(!r.ok)throw Error(r.status);return r.json();}}
const [places,states,countries]=await Promise.all([read('/tmp/corvus-world-cities.json','ne_10m_populated_places.geojson'),read('/tmp/corvus-world-regions.json','ne_10m_admin_1_states_provinces.geojson'),read('/tmp/map-natural-earth.json','ne_110m_admin_0_countries.geojson')]);
const norm=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const regionNames=new Map(),regionRows=[];
for(const f of states.features){const p=f.properties,c=p.iso_a2;if(!/^[A-Z]{2}$/.test(c)||!p.name||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))continue;const code=p.iso_3166_2?.startsWith(c+'-')?p.iso_3166_2.slice(3):p.name;const name=p.name_en||p.name;const aliases=[...new Set([code,p.name,name,p.gn_name,p.postal,...String(p.name_alt||'').split('|')].filter(Boolean))];const row=[c,code,name,+p.latitude.toFixed(1),+p.longitude.toFixed(1),aliases];regionRows.push(row);for(const alias of aliases)regionNames.set(c+':'+norm(alias),row);}
function area(geometry){const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;let a=0;for(const poly of polygons){let sum=0;const ring=poly[0];for(let i=0;i<ring.length;i++){const [x,y]=ring[i],[xx,yy]=ring[(i+1)%ring.length];let dx=xx-x;if(dx>180)dx-=360;if(dx< -180)dx+=360;sum+=dx*Math.PI/180*(2+Math.sin(y*Math.PI/180)+Math.sin(yy*Math.PI/180));}a+=Math.abs(sum)*6371**2/2;}return a;}
const areas=new Map(countries.features.map(f=>[f.properties.ISO_A2_EH,area(f.geometry)]));
const byCountry=new Map();
for(const f of places.features){const p=f.properties,c=p.ISO_A2;if(!/^[A-Z]{2}$/.test(c)||!Number.isFinite(p.LATITUDE)||!Number.isFinite(p.LONGITUDE))continue;const reg=regionNames.get(c+':'+norm(p.ADM1NAME));const row=[c,reg?.[1]||p.ADM1NAME||'',p.NAME_EN||p.NAME,+p.LATITUDE.toFixed(1),+p.LONGITUDE.toFixed(1),p.POP_MAX||0];if(!byCountry.has(c))byCountry.set(c,[]);byCountry.get(c).push(row);}
const selected=[];
const near=(a,b)=>{const r=Math.PI/180;return Math.hypot((a[3]-b[3])*111.2,(a[4]-b[4])*111.2*Math.cos((a[3]+b[3])/2*r))<45;};
for(const [country,points]of byCountry){
 points.sort((a,b)=>b[5]-a[5]||a[2].localeCompare(b[2]));const km=areas.get(country)||0,chosen=[];
 const add=p=>{if(chosen.some(c=>c[1]===p[1]&&near(c,p)))return false;chosen.push(p);return true;};
 const target=Math.max(4,Math.min(60,Math.ceil(Math.sqrt(km)/60)));
 for(const point of points){if(chosen.length>=target)break;add(point);}
 if(km>500000){const regions=new Map();for(const p of points){if(!p[1])continue;const g=regions.get(p[1])||[];g.push(p);regions.set(p[1],g);}for(const [region,group]of regions){for(const p of group){if(chosen.filter(c=>c[1]===region).length>=3)break;add(p);}}}
 selected.push(...chosen);
}
selected.sort((a,b)=>a[0].localeCompare(b[0])||b[5]-a[5]);
const header='// Generated from Natural Earth (public domain). Rebuild: node tools/build-geo-cities.mjs\n// https://www.naturalearthdata.com/about/terms-of-use/\n';
await fs.writeFile('js/data/geo-cities.generated.js',header+'// country, region code/name, city, latitude, longitude, reference population\nexport const cityCatalog = [\n'+selected.map(p=>JSON.stringify(p)).join(',\n')+'\n];\n');
await fs.writeFile('api/_geo-regions.generated.js',header+'// country, subdivision, label, latitude, longitude, aliases\nexport const regionCatalog = [\n'+regionRows.map(p=>JSON.stringify(p)).join(',\n')+'\n];\n');
console.log({cities:selected.length,regions:regionRows.length,countries:byCountry.size,US:selected.filter(p=>p[0]==='US').length,BE:selected.filter(p=>p[0]==='BE').map(p=>p[2])});
