const frame=document.getElementById('hack-app'),fallback=document.getElementById('app-fallback'),launch=document.getElementById('launch-app');
launch?.addEventListener('click',()=>{
 document.getElementById('app-launch').hidden=true;frame.hidden=false;frame.src=frame.dataset.src;
 const waiting=setTimeout(()=>{fallback.hidden=false;},5000);
 frame.addEventListener('load',()=>{clearTimeout(waiting);frame.focus();},{once:true});
 frame.addEventListener('error',()=>{clearTimeout(waiting);fallback.hidden=false;},{once:true});
});
