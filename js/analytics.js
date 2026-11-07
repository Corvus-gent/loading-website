// Default cookieless counting with an explicit payload allowlist; no form/DOM capture.
(async () => {
  const {arrivalSearch,clearTrackingURL,sidequestsPage}=await import('/js/arrival.js');
  const {setXCampaigns,xContext} = await import('./x-attribution.js');
  const {privacyEvent, sourceCategory, pathCategory, safeURL} = await import('/js/analytics-policy.js?v=20261107-squads1');
  import('/js/performance.js').catch(()=>{});
  import('/js/outbound.js').catch(()=>{});
  if (/^\/links(?:\/|$)/.test(location.pathname)) {
    const {linkContext} = await import('./link-context.js');
    window.__phProps = linkContext(location.pathname, arrivalSearch);
  }
  const {questTags,deferHomeClick,takeHomeClick}=await import('/js/quest-attribution.js');
  const {analyticsAllowed,consentChoice,privacySignal}=await import('/js/analytics-consent.js');
  let started=false,stopped=false,transport,pageviewSent=false,bareSent=false,pendingOK=false;
  const privatePage = /^\/army\/access(?:\/|$)/.test(location.pathname) || /^\/(?:stats\/)?private(?:\/|$)/.test(location.pathname) || /^\/music\/admin(?:\/|$)/.test(location.pathname);
  if (privatePage) {clearTrackingURL();return;}
  let pendingCleanup, questClient;
  const pendingActions=[];
  if(sidequestsPage) window.addEventListener('quest-action',({detail})=>{
    if (!analyticsAllowed() || !['sidequests_cta_click','sidequests_share'].includes(detail?.event)) return;
    if (detail.leavingForHome && deferHomeClick()) return;
    if (questClient) questClient.capture(detail.event,detail.props);
    else if (pendingActions.length<12) pendingActions.push(detail);
  });
  function bareHit(){
    if(bareSent||pageviewSent)return;
    bareSent=true;
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(new Date());
    fetch('/api/hit',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({page:pathCategory(location.pathname),day})}).catch(()=>{});
  }
  window.addEventListener('notice-ok',()=>{
    if(!analyticsAllowed())return;
    if(questClient)questClient.capture('notice_ok');else pendingOK=true;
  });
  function sync(){
    clearTimeout(pendingCleanup);
    if(!analyticsAllowed()){
      pendingActions.length=0; pendingOK=false; questClient=null; questTags(); bareHit();
      if (sidequestsPage && !consentChoice() && !privacySignal()) pendingCleanup=setTimeout(clearTrackingURL,5500);
      else clearTrackingURL();
      if(started){stopped=true;transport.abort();window.posthog?.set_config?.({before_send:()=>null});window.posthog?.shutdown?.();}
      return;
    }
    if(stopped){location.reload();return;}
    if(started)return;
    started=true;transport=new AbortController();
    start();
  }
  function start(){
  const attribution=questTags();
  const x=xContext(location.pathname,arrivalSearch);
  const catalog=x?fetch('/api/x-stats?catalog=1',{signal:AbortSignal.timeout(3000),credentials:'omit'}).then(r=>r.ok?r.json():null).catch(()=>null):Promise.resolve(null);
  const country = fetch('/api/geo?country=1', {cache:'no-store',signal:AbortSignal.timeout(2000)})
    .then(r=>r.ok?r.json():null).catch(()=>null);
  const cleanupTimer=setTimeout(clearTrackingURL,5000);
  const s=document.createElement('script');
  s.onerror=()=>{clearTimeout(cleanupTimer);clearTrackingURL();bareHit();};
  s.src='/js/vendor/posthog-1.445.3.min.js'; s.async=true;
  s.onload=async()=>{
    const [geo,allowed]=await Promise.all([country,catalog]);
    setXCampaigns(allowed?.campaigns);
    if(!analyticsAllowed()||stopped){clearTimeout(cleanupTimer);clearTrackingURL();return;}
    if(!window.posthog?.init){clearTimeout(cleanupTimer);clearTrackingURL();return;}
    window.posthog.init('phc_tqJYxREMXWjzQusx6xNPuEa2fNCzKmVpAURSHKnVbpro', {
      api_host:'https://eu.i.posthog.com', cookieless_mode:'always', person_profiles:'never',
      persistence:'memory', disable_persistence:true, ip:false, respect_dnt:true, debug:false,
      autocapture:false, capture_pageview:false, capture_pageleave:false,
      capture_heatmaps:false, capture_performance:false, capture_dead_clicks:false, rageclick:false,
      disable_session_recording:true, session_recording:{maskAllInputs:true,maskTextSelector:'*'},
      mask_all_text:true, mask_all_element_attributes:true, mask_personal_data_properties:true,
      disableDeviceModel:true, disable_surveys:true, disable_conversations:true, disable_product_tours:true,
      disable_web_experiments:true, disable_external_dependency_loading:true,
      advanced_disable_flags:true, advanced_disable_feature_flags:true, enable_recording_console_log:false,
      capture_exceptions:false, save_campaign_params:false, save_referrer:false,
      // Always mode ignores SDK opt_out. Gate capture ourselves and abort the
      // fetch transport on withdrawal, including queued retries. No beacon fallback.
      request_batching:false, disable_compression:true, api_transport:'fetch', disable_beacon:true,
      fetch_options:{signal:transport.signal,credentials:'omit',keepalive:sidequestsPage,referrerPolicy:'no-referrer'},
      before_send:event=>analyticsAllowed()?privacyEvent(event):null,
      loaded:ph=>{
        const props={...attribution,...window.__phProps};
        const query=new URLSearchParams(arrivalSearch);
        if(query.has('utm_source')) props.utm_source=sourceCategory(query.get('utm_source'));
        if(query.has('utm_campaign')) props.utm_campaign=query.get('utm_campaign');
        if(query.has('utm_content'))props.utm_content=query.get('utm_content');
        if(x?.content)props.utm_content=x.content;
        if(query.has('utm_medium')) props.utm_medium=query.get('utm_medium');
        if(/^[A-Z]{2}$/.test(geo?.countryCode||'')) props.corvus_country_code=geo.countryCode;
        if(sidequestsPage && attribution.utm_source) Object.assign(props,attribution);
        ph.register(props);
        ph.capture('$pageview');pageviewSent=true;
        if(pendingOK){ph.capture('notice_ok');pendingOK=false;}
        if (location.pathname==='/' && takeHomeClick()) ph.capture('sidequests_cta_click',{
          button:'home',$pathname:'/sidequests/',$current_url:'https://corvus.gent/sidequests',
        });
        questClient=ph;
        for (const action of pendingActions) ph.capture(action.event,action.props);
        pendingActions.length=0;
        clearTimeout(cleanupTimer);
        clearTrackingURL();
      },
    });
  };
  document.head.appendChild(s);
  }
  window.addEventListener('analytics-consent-change',sync);
  sync();
  document.addEventListener('click', e=>{
    const a=e.target.closest('a');
    if (a&&analyticsAllowed()) window.posthog?.capture('link_click',{link_href:safeURL(a.href),page:pathCategory(location.pathname)});
  });
})().catch(()=>{ /* Optional analytics may be blocked. */ });
