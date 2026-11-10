// Brand treatment follows the featured product; Corvus remains the host.
export function partnerFor(file) {
 if(['hack/1/index.html','hack/1/the-feed/index.html','hack/the-feed/index.html'].includes(file))return {id:'hackthefeed',name:'HackTheFeed',url:'/hack/1/the-feed/',label:'Open the app'};
 if(file==='friends/cardneto/index.html')return {id:'cardneto',name:'Cardneto',url:'/go/cardneto-demo',label:'Meet the product'};
 if(file.startsWith('plethora/')&&!file.includes('/admin/'))return {id:'plethora',name:'plethora',url:'/go/plethora-bio-x',label:'Get Plethora'};
 if(file==='hack/2/index.html')return {id:'plethora',name:'plethora',url:'/go/plethora-bio-x',label:'Get Plethora'};
 if(file.startsWith('compound/')&&!file.includes('/admin/'))return {id:'compound',name:'compound',url:'/go/compound-impact',label:'Try Compound'};
 return null;
}
export function partnerMarkup(brand){return `<div class="partner-masthead"><a class="partner-wordmark" href="${brand.url}">${brand.id==='compound'?'<img src="/compound/impact/assets/compound.webp" alt="" width="32" height="32">':''}${brand.name}</a><span>featured by <a href="/">corvus ↟</a></span><a class="partner-visit" href="${brand.url}">${brand.label} ↗</a></div>`;}
export function applyPartnerBrand(s,file){
 const brand=partnerFor(file);
 s=s.replace(/<!-- PARTNER_HEAD -->[\s\S]*?<!-- \/PARTNER_HEAD -->/g,'').replace(/<!-- PARTNER_BRAND -->[\s\S]*?<!-- \/PARTNER_BRAND -->/g,'').replace(/ data-partner="[^"]*"/g,'');
 // Shared promotional cards and the hidden Cardneto business card also use their own brand.
 s=s.replace('</head>','<!-- PARTNER_HEAD --><link rel="stylesheet" href="/css/site/partners.css?v=20261109brands1"><!-- /PARTNER_HEAD --></head>');
 if(brand){s=s.replace(/<body\b/,'<body data-partner="'+brand.id+'"');s=s.replace(/(<main\b[^>]*>)/,`$1<!-- PARTNER_BRAND -->${partnerMarkup(brand)}<!-- /PARTNER_BRAND -->`);}
 return s;
}
