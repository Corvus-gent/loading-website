// Campaigns are curated in the owner's Notion log, never accepted as arbitrary visitor labels.
let approved = new Set();
export const campaignSlug = value => {
 const slug=String(value||'').replace(/^gabe-/,'');
 return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=64?slug:'';
};
export const contentSlot = value => {
 const match=/^(eu|sf)-(\d{1,2})$/.exec(String(value||''));
 return match&&Number(match[2])<24?`${match[1]}-${Number(match[2])}`:'';
};
export function setXCampaigns(values){approved=new Set((Array.isArray(values)?values:[]).map(campaignSlug).filter(Boolean));}
export function approvedCampaign(value){const slug=campaignSlug(value);return approved.has(slug)?slug:'';}
export function xContext(pathname,search=''){
 const query=new URLSearchParams(search),links=/^\/links\/gabe\/x\/([^/]+)\/?$/.exec(pathname),go=/^\/go\/x\/pidgy\/([^/]+)\/?$/.exec(pathname);
 const source=query.get('utm_source')==='x'||links||go;
 return source?{campaign:campaignSlug(query.get('utm_campaign')||links?.[1]||go?.[1]),content:contentSlot(query.get('utm_content'))}:null;
}
