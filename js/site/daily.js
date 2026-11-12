function revealSection(hash){
 for(let node=document.getElementById(hash.slice(1));node;node=node.parentElement){
  if(node.tagName==='DETAILS')node.open=true;
 }
}
for(const link of document.querySelectorAll('a[href^="#"]'))link.addEventListener('click',()=>revealSection(link.hash));
window.addEventListener('hashchange',()=>revealSection(location.hash));
revealSection(location.hash);
