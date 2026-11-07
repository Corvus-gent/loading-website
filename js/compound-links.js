// Shared by the edge redirect and the server. No visitor identifiers in links.
export const COMPOUND_LINKS={
 x:['x','social'],li:['linkedin','social'],ig:['instagram','social'],
 'ig-story':['instagram','story'],tt:['tiktok','social'],dc:['discord','community'],
 wa:['whatsapp','message'],hostel:['hostel','fundraiser'],v:['video','video'],
 qr:['offline','qr'],simon:['compound','partner']
};
export function compoundDestination(slug,content=''){
 const spec=COMPOUND_LINKS[slug];if(!spec)return null;
 const p=new URLSearchParams({utm_source:spec[0],utm_medium:spec[1],utm_campaign:'compound-1000',utm_term:slug});
 const c=String(content).slice(0,64);if(c)p.set('utm_content',c);
 return '/compound?'+p;
}
