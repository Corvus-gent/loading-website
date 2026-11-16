const palette={prompt:['#102823','#b7f6cd'],legio:['#382334','#f3d9aa'],flyer:['#f6e8c8','#b74325'],sigil:['#16293d','#95b9d9'],arcade:['#302751','#fed79f']};
const request=new URLSearchParams(location.search).get('logo');
const slug=Object.hasOwn(palette,request)?request:'prompt';
document.documentElement.style.setProperty('--proof-ground',palette[slug][0]);
document.documentElement.style.setProperty('--corvus-gold',palette[slug][1]);
document.querySelector('header img').src='/public/logo-lab/'+slug+'/wordmark.svg';
document.querySelectorAll('a').forEach(link=>link.removeAttribute('href'));
