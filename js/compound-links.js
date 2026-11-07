// Public campaign links; the destination stays fixed on this site.
export const COMPOUND_LINKS={
 x:['x','post'],'x-bio':['x','bio'],li:['linkedin','social'],
 'li-1':['linkedin','post','post-1'],'li-2':['linkedin','post','post-2'],
 ig:['instagram','bio','gabe.maxxing'],'ig-story':['instagram','story','gabe.maxxing'],
 bjj:['instagram','bio','gabinho_bjj'],'bjj-story':['instagram','story','gabinho_bjj'],
 dm:['dm','direct'],tt:['tiktok','post'],'tt-bio':['tiktok','bio'],
 dc:['discord','community'],wa:['whatsapp','message'],hostel:['hostel','fundraiser'],
 v:['video','video'],qr:['offline','qr'],simon:['compound','partner']
};
export function compoundDestination(slug,content='',incoming={}){
 const spec=COMPOUND_LINKS[slug];if(!spec)return null;
 const p=new URLSearchParams();
 for(const [key,value]of Object.entries(incoming))if(!['compound','slug','c'].includes(key)&&typeof value==='string')p.set(key,value);
 for(const [key,value]of Object.entries({utm_source:spec[0],utm_medium:spec[1],utm_campaign:'compound-1000',utm_term:slug}))p.set(key,value);
 const c=String(content||spec[2]||'').slice(0,64);if(c)p.set('utm_content',c);
 return '/compound?'+p;
}
