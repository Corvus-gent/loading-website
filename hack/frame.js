const frame=document.getElementById('hack-app'),fallback=document.getElementById('app-fallback');
const waiting=setTimeout(()=>{fallback.hidden=false;},5000);
frame.addEventListener('load',()=>clearTimeout(waiting),{once:true});
frame.addEventListener('error',()=>{clearTimeout(waiting);fallback.hidden=false;},{once:true});
