import {normalizedHandle} from '../../compound/impact/accounts.js';
const numeric=v=>v!==null&&v!==''&&v!==undefined&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):undefined;
export function extractPosts(payloads,platform,account){
 const rows=new Map();
 function walk(v){if(!v||typeof v!=='object')return;
 if(platform==='tt'&&v.id&&v.author&&v.video&&v.stats){const handle=v.author.uniqueId||v.author.unique_id;if(normalizedHandle(handle)===normalizedHandle(account)){
 const media=v.imagePost?'image':v.video.duration||v.video.playAddr?'video':'unknown';const row={post_url:'https://www.tiktok.com/@'+handle+'/video/'+v.id,account:handle,label:v.desc||'TikTok video',media_type:media,post_type:v.isRepost?'repost':'original',original_by_gabe:true,native_video:media==='video',thumbnail_url:v.video.cover||v.video.originCover};if(numeric(v.createTime)!==undefined)row.posted_at=new Date(Number(v.createTime)*1000).toISOString();for(const [ours,key]of Object.entries({views:'playCount',likes:'diggCount',comments:'commentCount',shares:'shareCount',saves:'collectCount'})){const n=numeric(v.stats[key]);if(n!==undefined)row[ours]=n}rows.set(row.post_url,{...rows.get(row.post_url),...row});}}
 if(platform==='ig'&&(v.code||v.shortcode)&&(v.media_type||v.__typename||v.is_video!==undefined)){
 const owner=v.user?.username||v.owner?.username;if(normalizedHandle(owner)===normalizedHandle(account)){
 const code=v.code||v.shortcode,media=v.media_type===8||/Sidecar/.test(v.__typename||'')?'carousel':v.media_type===2||v.is_video===true||/VideoMedia/.test(v.__typename||'')?'video':v.media_type===1||/Image/.test(v.__typename||'')?'image':'unknown';
 const row={post_url:'https://www.instagram.com/'+(media==='video'?'reel':'p')+'/'+code+'/',account:owner,label:v.caption?.text||v.edge_media_to_caption?.edges?.[0]?.node?.text||'Instagram post',media_type:media,post_type:v.is_reshare||v.is_repost?'repost':'original',original_by_gabe:true,native_video:media==='video'};
 const thumb=v.display_uri||v.display_url||v.image_versions2?.candidates?.[0]?.url;if(thumb)row.thumbnail_url=thumb;
 const ts=v.taken_at||v.taken_at_timestamp;if(numeric(ts)!==undefined)row.posted_at=new Date(Number(ts)*1000).toISOString();
 for(const [key,values]of Object.entries({views:[v.play_count,v.video_play_count,v.video_view_count],likes:[v.like_count,v.edge_media_preview_like?.count,v.edge_liked_by?.count],comments:[v.comment_count,v.edge_media_to_parent_comment?.count,v.edge_media_to_comment?.count],shares:[v.reshare_count,v.share_count],saves:[v.save_count]})){const n=values.map(numeric).find(n=>n!==undefined);if(n!==undefined)row[key]=n;}
 rows.set(row.post_url,{...rows.get(row.post_url),...row});}}
 for(const child of Object.values(v))if(child&&typeof child==='object')walk(child);
 }for(const p of payloads)walk(p);return [...rows.values()].sort((a,b)=>(Date.parse(b.posted_at)||0)-(Date.parse(a.posted_at)||0)).slice(0,30);
}
export async function scrapeProfile(browser,platform,account){
 const context=await browser.newContext(),page=await context.newPage(),payloads=[],errors=[];let blocked=false;
 page.on('response',async r=>{if(/(graphql|item_list|web_profile_info)/.test(r.url())){if([401,403,429].includes(r.status())){errors.push('Public profile endpoint HTTP '+r.status());blocked=true;}if(r.ok())try{payloads.push(await r.json())}catch{}}});
 const scripts=async()=>{for(const text of await page.locator('script[type="application/json"],script#__UNIVERSAL_DATA_FOR_REHYDRATION__,script#SIGI_STATE').allTextContents())try{payloads.push(JSON.parse(text))}catch{}};
 try{
 const url=platform==='tt'?'https://www.tiktok.com/@'+account:'https://www.instagram.com/'+account+'/';const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 if(!response?.ok())throw Error('Public profile HTTP '+response?.status());await page.waitForTimeout(3500);await scripts();
 const body=await page.locator('body').innerText();if(/confirm you.re human|verify to continue|enter the code|security check|challenge_required/i.test(body))throw Error('Public profile requires verification. No bypass attempted.');
 for(let i=0;i<3&&!blocked;i++){await page.mouse.wheel(0,900);await page.waitForTimeout(1200);await scripts();}
 let rows=extractPosts(payloads,platform,account);
 const detailURLs=rows.filter(r=>r.media_type==='video').map(r=>r.post_url);
 if(platform==='tt'&&!rows.length){for(const href of await page.locator('a[href*="/video/"]').evaluateAll(a=>a.map(e=>e.href)))if(href.startsWith('https://www.tiktok.com/@'+account+'/video/'))detailURLs.push(href);}
 for(const url of [...new Set(detailURLs)].slice(0,30)){
 if(blocked)break;await page.waitForTimeout(1100);
 try{const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});if([401,403,429].includes(r?.status())){blocked=true;errors.push('Public video HTTP '+r.status());break}await page.waitForTimeout(1200);await scripts();}catch(e){errors.push('Video details unavailable: '+e.name);}
 }
 rows=extractPosts(payloads,platform,account);return {posts:rows,mode:rows.length?'public-browser':'blocked',note:rows.length?'Public profile and native post data; missing metrics remain unknown.':'Public profile loaded, but no verifiable post data was supplied.',error:errors[0]||(!rows.length?'No public video list returned. Existing data kept.':null)};
 }catch(e){return{posts:extractPosts(payloads,platform,account),mode:'error',note:'Existing posts and metrics kept.',error:e.message.slice(0,300)}}finally{await context.close()}
}
