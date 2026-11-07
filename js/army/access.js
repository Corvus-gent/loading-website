import {renderNextBenefit} from './benefits.js?v=20261106-ranks1';
import {init,t,getLang} from './copy.js?v=20261106-ranks1';
import {$,api,wireForm,errorText,tag,countryOptions,recruitURL,copy,share,saveArt,saveBlob,rankBadges} from './client.js?v=20261106-ranks1';
let self=null;
let token=window.__armyClaimToken||new URLSearchParams(location.hash.slice(1)).get('token');delete window.__armyClaimToken;
if(token)history.replaceState(null,'',location.pathname+location.search);
init(()=>{countryOptions($('account-country'),$('account-country').value);countryOptions($('edit-country'),self?.country||'');if(self?.canManage)show(self);});
countryOptions($('account-country'));
const status=$('account-status');
async function show(user){
 self=user;$('account-forms').hidden=!!user?.canManage;$('account-settings').hidden=!user?.canManage;$('account-pending').hidden=true;
 if(!user?.canManage)return;
 renderNextBenefit($('account-next-rank'),user.tier);
 $('account-pidgy').hidden=!user.pidgyCode;
 $('account-pidgy-code').textContent=user.pidgyCode||'';
 $('account-pidgy-trials').textContent=t('pidgyTrials',{count:user.pidgyTrials||0});
 $('public-profile').href='/soldier/'+encodeURIComponent(user.username);$('public-profile').hidden=!user.username;
 let discordButton=$('account-discord');if(!discordButton){discordButton=document.createElement('button');discordButton.id='account-discord';discordButton.type='button';discordButton.textContent='discord →';$('account-ranks').after(discordButton);discordButton.onclick=async()=>{try{const result=await api({action:'discord-code'});status.textContent='/claim '+result.code;}catch(error){status.textContent=errorText(error);}};}discordButton.hidden=!user.discordReady;
 rankBadges($('account-ranks'),user);
 await tag($('account-tag'),user,user.code);$('edit-link').value=user.link||'';countryOptions($('edit-country'),user.country||'');$('profile-form').elements.hidden.checked=!!user.hidden;$('account-recruit-url').textContent=recruitURL(user.code);
}
wireForm($('register-form'),'register',async result=>{self=result.self;$('account-forms').hidden=true;$('account-pending').hidden=false;status.textContent=t(result.mail==='sent'?'verifyNote':'mailQueued');await tag($('pending-tag'),self,self.code);},status);
wireForm($('login-form'),'login',()=>{status.textContent=t('checkMail');},status);
function claimScreen(){if(token){$('claim-box').hidden=false;$('account-forms').hidden=true;$('account-pending').hidden=true;$('account-settings').hidden=true;}}
window.addEventListener('hashchange',()=>{const next=new URLSearchParams(location.hash.slice(1)).get('token');if(next){token=next;history.replaceState(null,'',location.pathname+location.search);claimScreen();}});
$('claim-button').addEventListener('click',async()=>{$('claim-button').disabled=true;status.textContent=t('working');try{const result=await api({action:'claim',token});token=null;$('claim-box').hidden=true;await show(result.self);status.textContent=t('saved');}catch(error){status.textContent=errorText(error);$('account-forms').hidden=false;}finally{$('claim-button').disabled=false;}});
if(token)claimScreen();else api().then(({self})=>{if(!token)return show(self);}).catch(error=>status.textContent=errorText(error));
$('profile-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const fields=Object.fromEntries(new FormData(e.currentTarget)),result=await api({action:'profile',...fields,hidden:e.currentTarget.elements.hidden.checked});self=result.self;status.textContent=t('saved');}catch(error){status.textContent=errorText(error);}finally{button.disabled=false;}});
$('account-copy').onclick=()=>copy(self.code,status);$('account-share').onclick=()=>share(self.code,status);$('account-save').onclick=()=>saveArt(self,self.code,false,status);$('account-poster').onclick=()=>saveArt(self,self.code,true,status);
$('account-export').onclick=async()=>{try{saveBlob(new Blob([JSON.stringify(await api({action:'export'}),null,2)],{type:'application/json'}),'corvus-my-data.json');}catch(error){status.textContent=errorText(error);}};
$('account-delete').onclick=async()=>{if(!confirm(t('deleteConfirm')))return;try{await api({action:'delete',confirm:true});self=null;$('account-settings').hidden=true;$('account-forms').hidden=true;status.textContent=t('deleted');}catch(error){status.textContent=errorText(error);}};
$('account-logout').onclick=async()=>{try{await api({action:'logout'});location.reload();}catch(error){status.textContent=errorText(error);}};

$('account-pidgy-copy').onclick=async()=>{if(!self?.canManage||!self.pidgyCode)return;try{await navigator.clipboard.writeText(self.pidgyCode);$('account-pidgy-status').textContent=t('codeCopied');}catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents($('account-pidgy-code'));selection.removeAllRanges();selection.addRange(range);$('account-pidgy-status').textContent=self.pidgyCode;}};
