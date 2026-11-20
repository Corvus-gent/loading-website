// The same component used by the homepage, including all seven languages and stats.
import './i18n/bar.js';
const select=document.getElementById('reading-theme');
const setTheme=theme=>{document.documentElement.dataset.theme=theme;select.value=theme;};
try{const saved=localStorage.getItem('corvus.philosophy.theme');if(['system','light','dark'].includes(saved))setTheme(saved);}catch{}
select.addEventListener('change',()=>{setTheme(select.value);try{localStorage.setItem('corvus.philosophy.theme',select.value);}catch{}});
