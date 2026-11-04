// Opt-in cookieless counting with an explicit payload allowlist; no form/DOM capture.
(async () => {
  const {setXCampaigns,xContext} = await import('./x-attribution.js');
  const {privacyEvent, sourceCategory, campaignCategory, pathCategory, safeURL} = await import('/js/analytics-policy.js');
  import('/js/performance.js');
  import('/js/outbound.js');
  const {analyticsAllowed}=await import('/js/analytics-consent.js');
  let started=false,stopped=false,transport;
  const privatePage = /^\/(?:stats\/)?private(?:\/|$)/.test(location.pathname) || /^\/music\/admin(?:\/|$)/.test(location.pathname);
  if (privatePage) return;
  function sync(){
    if(!analyticsAllowed()){
      if(started){stopped=true;transport.abort();window.posthog?.set_config?.({before_send:()=>null});window.posthog?.shutdown?.();}
      return;
    }
    if(stopped){location.reload();return;}
    if(started)return;
    started=true;transport=new AbortController();
    start();
  }
  function start(){
  const x=xContext(location.pathname,location.search);
  const catalog=x?fetch('/api/x-stats?catalog=1',{signal:AbortSignal.timeout(3000),credentials:'omit'}).then(r=>r.ok?r.json():null).catch(()=>null):Promise.resolve(null);
  const country = fetch('/api/geo?country=1', {cache:'no-store',signal:AbortSignal.timeout(2000)})
    .then(r=>r.ok?r.json():null).catch(()=>null);
  const s=document.createElement('script');
  s.src='/js/vendor/posthog-1.445.3.min.js'; s.async=true;
  s.onload=async()=>{
    const [geo,allowed]=await Promise.all([country,catalog]);
    setXCampaigns(allowed?.campaigns);
    if(!analyticsAllowed()||stopped)return;
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
      request_batching:false, api_transport:'fetch', disable_beacon:true,
      fetch_options:{signal:transport.signal,credentials:'omit',keepalive:false,referrerPolicy:'no-referrer'},
      before_send:event=>analyticsAllowed()?privacyEvent(event):null,
      loaded:ph=>{
        const props={...window.__phProps};
        const query=new URLSearchParams(location.search);
        if(query.has('utm_source')) props.utm_source=sourceCategory(query.get('utm_source'));
        if(query.has('utm_campaign')) props.utm_campaign=query.get('utm_campaign');
        if(x?.content)props.utm_content=x.content;
        if(query.has('utm_medium')) props.utm_medium=query.get('utm_medium');
        if(/^[A-Z]{2}$/.test(geo?.countryCode||'')) props.corvus_country_code=geo.countryCode;
        ph.register(props);
        ph.capture('$pageview');
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
})();
