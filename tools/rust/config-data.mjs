// Compile existing configuration as data, without changing the authoritative files.
import {readFileSync,writeFileSync} from 'node:fs';
import {LIVE,STREAM_ID} from '../../live.config.js';
import {LIVE_MODE_UNTIL} from '../../hack/live-mode-config.js';
import {PLETHORA_PLACEMENTS,PLETHORA_ALIASES,PLETHORA_CATEGORIES} from '../../js/plethora-config.js';
import {SOCIALS} from '../../live/socials.js';
const output=JSON.stringify({live:LIVE,stream:STREAM_ID,until:LIVE_MODE_UNTIL,socials:SOCIALS},null,2)+'\n';
const file=new URL('../../rust/migration/live-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==output)throw Error('Rust live config is stale; run node tools/rust/config-data.mjs.');}else writeFileSync(file,output);

const plethora=JSON.stringify({placements:PLETHORA_PLACEMENTS,aliases:PLETHORA_ALIASES,categories:PLETHORA_CATEGORIES},null,2)+"\n";
const file2=new URL("../../rust/migration/plethora-config.json",import.meta.url);
if(process.argv.includes("--check")){if(readFileSync(file2,"utf8")!==plethora)throw Error("Rust Plethora config is stale");}else writeFileSync(file2,plethora);

const {CONFIG,CALL_TIERS,BMC_URL,LINKEDIN_PROFILE_URL,SUPPORT_LINKS,SUPPORT_STEPS}=await import('../../js/support-config.js');
const support=JSON.stringify({config:CONFIG,tiers:CALL_TIERS,bmcURL:BMC_URL,linkedinURL:LINKEDIN_PROFILE_URL,links:Object.entries(SUPPORT_LINKS),steps:Object.entries(SUPPORT_STEPS)},null,2)+'\n';
const file3=new URL('../../rust/migration/support-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file3,'utf8')!==support)throw Error('Rust support config is stale');}else writeFileSync(file3,support);

const {PRIVACY_VERSION,strings}=await import('../../js/privacy-strings.js');
const {STREAM_NOTICE,STREAM_PRIVACY}=await import('../../js/privacy-stream.js');
const {ARMY_PRIVACY}=await import('../../js/army/privacy-copy.js');
const privacyPages={};for(const lang of Object.keys(strings))privacyPages[lang]=(await import(`../../js/privacy-locales/${lang}.js`)).default;
const privacy=JSON.stringify({version:PRIVACY_VERSION,strings,streamNotice:STREAM_NOTICE,streamPrivacy:STREAM_PRIVACY,army:ARMY_PRIVACY,pages:privacyPages},null,2)+'\n';
const file4=new URL('../../rust/migration/privacy-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file4,'utf8')!==privacy)throw Error('Rust privacy copy is stale');}else writeFileSync(file4,privacy);

const compoundModule=await import('../../compound/v2/config.js');
const compound=JSON.stringify({deadline:compoundModule.DEADLINE,seeds:compoundModule.SEED_VIDEOS,platforms:compoundModule.PLATFORMS,accounts:compoundModule.ACCOUNTS,languages:compoundModule.LANGUAGES,hooks:compoundModule.HOOKS,mediums:compoundModule.MEDIUMS},null,2)+'\n';
const file5=new URL('../../rust/migration/compound-v2-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file5,'utf8')!==compound)throw Error('Rust Compound v2 config is stale');}else writeFileSync(file5,compound);

const {ACCOUNTS}=await import('../../compound/impact/accounts.js');
const {WEIGHTS,SUPPORTED,LABELS}=await import('../../compound/impact/metrics.js');
const impact=JSON.stringify({accounts:ACCOUNTS,weights:WEIGHTS,supported:SUPPORTED,labels:LABELS},null,2)+'\n';
const file6=new URL('../../rust/migration/impact-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file6,'utf8')!==impact)throw Error('Rust Impact config is stale');}else writeFileSync(file6,impact);

// Preserve the existing owner's static form markup verbatim. No user data enters this template.
const adminSource=readFileSync(new URL('../../compound/impact/admin.js',import.meta.url),'utf8');
const template=adminSource.match(/section\.innerHTML=(`[^]*?`);\n const anchor/);if(!template)throw Error('Impact admin template changed; review the Rust form migration.');
const {runInNewContext}=await import('node:vm');
const adminHTML=runInNewContext(template[1],{ACCOUNTS,fields:Object.keys(WEIGHTS)},{timeout:1000})+'\n';
const file7=new URL('../../rust/migration/impact-admin.html',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file7,'utf8')!==adminHTML)throw Error('Rust Impact admin markup is stale');}else writeFileSync(file7,adminHTML);

const {SHARE_CONFIG}=await import('../../compound/v2/share-config.js');
const share=JSON.stringify(SHARE_CONFIG,null,2)+'\n';
const file8=new URL('../../rust/migration/compound-share-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file8,'utf8')!==share)throw Error('Rust Compound share config is stale');}else writeFileSync(file8,share);

const {COMPOUND_LINKS}=await import('../../js/compound-links.js');
const editor=JSON.stringify(COMPOUND_LINKS,null,2)+'\n';
const file9=new URL('../../rust/migration/compound-links.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file9,'utf8')!==editor)throw Error('Rust original Compound links are stale');}else writeFileSync(file9,editor);

const legionConfig=await import('../../js/site/legion-config.js');
const {SIMON}=await import('../../api/_legion/senate.js');
const legion=JSON.stringify({ranks:legionConfig.LEGION_RANKS,meanings:legionConfig.RANK_MEANING,partners:legionConfig.PARTNERS,simon:SIMON},null,2)+'\n';
const file10=new URL('../../rust/migration/legion-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file10,'utf8')!==legion)throw Error('Rust Legion configuration is stale');}else writeFileSync(file10,legion);

const armyConfig=await import('../../js/army/domain.js');
const army=JSON.stringify(Object.fromEntries(['LANGUAGES','RANKS','WEIGHTS','FEATHERS','RETENTION','DAY','TIERS','LIFETIME','CONSUL_SEATS'].map(k=>[k,armyConfig[k]])),null,2)+'\n';
const file11=new URL('../../rust/migration/army-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file11,'utf8')!==army)throw Error('Rust Army configuration is stale');}else writeFileSync(file11,army);

const armyLocales={};for(const feature of ['army','mail']){armyLocales[feature]={};for(const lang of armyConfig.LANGUAGES)armyLocales[feature][lang]=JSON.parse(readFileSync(new URL(`../../js/i18n/${feature}.${lang}.json`,import.meta.url),'utf8'));}
const armyCopy=JSON.stringify(armyLocales)+'\n',file12=new URL('../../rust/migration/army-locales.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file12,'utf8')!==armyCopy)throw Error('Rust Army locale copy is stale');}else writeFileSync(file12,armyCopy);

// Frozen markup only: the runtime fills escaped data and encodes QR bytes in Rust.
const art=await import('../../js/army/art.js');const artTemplates={crow:art.crow,lamp:art.lamp};
for(const poster of[false,true])for(const kind of['plain','tier','lifetime']){
 const s={username:'__RUST_NAME__',serial:'__RUST_SERIAL__',created:'__RUST_CREATED__',rank:'__RUST_RANK__',tier:kind==='plain'?null:kind==='lifetime'?'senator':'__RUST_TIER__'};
 const labels={rankLabel:'__RUST_RANKLABEL__',tierLabel:'__RUST_TIERLABEL__',supporterLifetime:'__RUST_LIFETIME__'};
 let svg=art.tagSVG(s,'__RUST_CODE__',{poster,labels});
 const qr=art.qrMarkup('https://corvus.gent/r/__RUST_CODE__',poster?790:825,poster?1025:330,poster?212:136);
 if(!svg.includes(qr))throw Error('Army QR template changed');svg=svg.replace(qr,'__RUST_QR__');
 const username=svg.match(/<text[^>]+>__RUST_NAME__(?: enlisted\.)?<\/text>/);if(!username)throw Error('Army name template changed');svg=svg.replace(username[0],username[0].replace(/font-size="[^"]+"/,'font-size="__RUST_FONTSIZE__"'));
 if(kind==='lifetime')svg=svg.replace('senator','__RUST_TIER__');artTemplates[(poster?'poster':'tag')+'-'+kind]=svg;
}
const armyArt=JSON.stringify(artTemplates)+'\n',file13=new URL('../../rust/migration/army-art.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file13,'utf8')!==armyArt)throw Error('Rust Army art markup is stale');}else writeFileSync(file13,armyArt);

const {CURRENCIES}=await import('../../js/army/countries.js');
const armyCountries=JSON.stringify(CURRENCIES)+'\n',file14=new URL('../../rust/migration/army-countries.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file14,'utf8')!==armyCountries)throw Error('Rust Army countries are stale');}else writeFileSync(file14,armyCountries);

const {INSPIRATIONS}=await import('../../js/inspiration-data.js');
const inspiration=JSON.stringify(INSPIRATIONS,null,2)+'\n';
const inspirationFile=new URL('../../rust/migration/inspiration.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(inspirationFile,'utf8')!==inspiration)throw Error('Rust inspiration data is stale');}else writeFileSync(inspirationFile,inspiration);
const shellSource=readFileSync(new URL('../../js/site/shell.js',import.meta.url),'utf8');
for(const [name,pattern]of [['search',/dialog\.innerHTML='([^]*?)';document\.body/],['cardneto',/card\.innerHTML='([^]*?)';document\.body/]]){
 const text=shellSource.match(pattern)?.[1];if(!text)throw Error('Shell template changed: '+name);
 const target=new URL('../../rust/browser/site-'+name+'.html',import.meta.url),output=text+'\n';
 if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==output)throw Error('Rust shell template stale: '+name);}else writeFileSync(target,output);
}

const terminalSource=readFileSync(new URL('../../js/terminal.js',import.meta.url),'utf8');
const terminalHTML=terminalSource.match(/overlay\.innerHTML = `([^]*?)`;/)?.[1];
if(!terminalHTML)throw Error('Terminal template changed');
const terminalFile=new URL('../../rust/browser/site-terminal.html',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(terminalFile,'utf8')!==terminalHTML+'\n')throw Error('Rust terminal template stale');}else writeFileSync(terminalFile,terminalHTML+'\n');

const searchSource=readFileSync(new URL('../../js/search.js',import.meta.url),'utf8');
const searchMatch=searchSource.match(/const INDEX = (\[[^]*?\n\]);/);if(!searchMatch)throw Error('Search index changed');
const searchIndex=JSON.stringify((await import('node:vm')).runInNewContext('('+searchMatch[1]+')'),null,2)+'\n';
const searchFile=new URL('../../rust/migration/search-index.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(searchFile,'utf8')!==searchIndex)throw Error('Rust legacy search data stale');}else writeFileSync(searchFile,searchIndex);

const policy=await import('../../js/analytics-policy.js');
const policySource=readFileSync(new URL('../../js/analytics-policy.js',import.meta.url),'utf8');
const vm=await import('node:vm');
const policyData=Object.fromEntries(['SOURCES','CAMPAIGNS','COMMANDS','GAME_TYPES','GENRES','BROWSERS'].map(k=>[k,policy[k]]));
policyData.EVENTS=[...policy.EVENTS];
for(const key of ['HOSTS','EXTERNAL','ROUTES']){const source=policySource.match(new RegExp('const '+key+' = (?:new Set\\()?('+String.raw`\[[^]*?\]`+')\\)?;'))?.[1];if(!source)throw Error('Policy list changed: '+key);policyData[key]=vm.runInNewContext('('+source+')');}
const display=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'});policyData.countries={};
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name&&!['ZZ','QO','XA','XB'].includes(code)){policyData.countries[code]=code;policyData.countries[name]=code;}}
const policyFile=new URL('../../rust/migration/analytics-policy.json',import.meta.url),policyJSON=JSON.stringify(policyData,null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync(policyFile,'utf8')!==policyJSON)throw Error('Rust analytics policy stale');}else writeFileSync(policyFile,policyJSON);

const {cityCatalog}=await import('../../js/data/geo-cities.generated.js');
const {regionCatalog}=await import('../../api/_geo-regions.generated.js');
const geoSource=readFileSync(new URL('../../api/_geo-data.js',import.meta.url),'utf8');
const centroidData=geoSource.match(/const centroids = new Map\(([^]*?)\);/),overrides=geoSource.match(/Object\.entries\((\{[^]*?\})\)\) centroids\.set/);
if(!centroidData||!overrides)throw Error('Geo centroid data changed; review migration.');
const centroids=Object.fromEntries(vm.runInNewContext('('+centroidData[1]+')'));Object.assign(centroids,vm.runInNewContext('('+overrides[1]+')'));
const regionNames=new Intl.DisplayNames(['en'],{type:'region'}),names={};for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b);names[code]=regionNames.of(code);}
const geoFile=new URL('../../rust/migration/geo-config.json',import.meta.url),geoJSON=JSON.stringify({cities:cityCatalog,regions:regionCatalog,centroids,names})+'\n';
if(process.argv.includes('--check')){if(readFileSync(geoFile,'utf8')!==geoJSON)throw Error('Rust geo configuration stale');}else writeFileSync(geoFile,geoJSON);

// Public copy is fetched as existing JSON; only the cache version is compiled.
const pageCopySource=readFileSync(new URL('../../js/i18n/page-copy.js',import.meta.url),'utf8');
const copyVersion=pageCopySource.match(/const catalogVersion = '([^']+)';/)?.[1];
if(!copyVersion)throw Error('Page-copy version changed; review Rust catalog loader');
const copyConfig=JSON.stringify({version:copyVersion})+'\n',copyFile=new URL('../../rust/migration/page-copy-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(copyFile,'utf8')!==copyConfig)throw Error('Rust page-copy catalog version stale');}else writeFileSync(copyFile,copyConfig);

// Freeze analytics SQL as data. Legacy task projections are compared separately.
// The VM receives only synthetic query/Redis boundaries, never env credentials or I/O.
const {dailyTasks}=await import('../../api/_stats-daily.js');
const statsDay='__CORVUS_STATS_DAY__',statsQueries={daily:{},sections:{},private:{}};
let captured=[];const capture=async sql=>{captured.push(sql);return [[0,0,0,0,0,0]];};
const real=(await import('../../api/_posthog.js')).REAL;
for(const [key,task]of Object.entries(dailyTasks(statsDay,capture))){captured=[];await task();if(captured.length!==1)throw Error('Daily query boundary changed: '+key);statsQueries.daily[key]=captured[0];}
const sectionsSource=readFileSync(new URL('../../api/_stats-sections.js',import.meta.url),'utf8');
const sectionFunction=sectionsSource.slice(sectionsSource.indexOf('export function sectionTasks'),sectionsSource.indexOf('export default')).replace(/^export /,'');
const sectionFactory=runInNewContext(sectionFunction+';sectionTasks',{hogql:capture,REAL:real,day:()=>statsDay,hostCategory:x=>x,category:x=>x,GENRES:[],Date,signups:()=>{throw Error('No provider calls in query extraction');},pipeline:()=>{throw Error('No Redis in query extraction');},redis:()=>{throw Error('No Redis in query extraction');}},{timeout:1000});
for(const section of ['pidgy','outbound','music']){statsQueries.sections[section]={};for(const [key,task]of Object.entries(sectionFactory(section,statsDay))){if(key==='signups')continue;captured=[];await task();if(captured.length!==1)throw Error('Section query boundary changed: '+section+':'+key);statsQueries.sections[section][key]=captured[0];}}
const privateSource=readFileSync(new URL('../../api/private-stats.js',import.meta.url),'utf8');
const privateFunction=privateSource.slice(privateSource.indexOf('export const privateTasks='),privateSource.indexOf('async function compute')).replace(/^export /,'');
const privateFactory=runInNewContext(privateFunction+';privateTasks',{hogql:capture,REAL:real},{timeout:1000});
for(const [key,task]of Object.entries(privateFactory())){captured=[];await task();if(captured.length!==1)throw Error('Private query boundary changed: '+key);statsQueries.private[key]=captured[0];}
const statsText=JSON.stringify(statsQueries,null,2)+'\n',statsFile=new URL('../../rust/migration/stats-queries.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(statsFile,'utf8')!==statsText)throw Error('Rust stats SQL stale');}else writeFileSync(statsFile,statsText);

// Preserve the atomic health ledger protocol while projecting its data in Rust.
const healthSource=readFileSync(new URL('../../api/_health-history.js',import.meta.url),'utf8');
const healthIngest=healthSource.match(/const ingest = `([^]*?)`;/)?.[1];
if(!healthIngest)throw Error('Health ingestion script changed');
const healthLuaFile=new URL('../../rust/migration/health-ingest.lua',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(healthLuaFile,'utf8')!==healthIngest)throw Error('Rust health ledger protocol stale');}else writeFileSync(healthLuaFile,healthIngest);
