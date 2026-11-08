// Edit availability here; this is a manual weekly allocation, not a live calendar.
export const CONFIG={spotsThisWeek:5,weeklyCapacity:5,coffeeUSD:5};
export const CALL_TIERS={quick:{label:'⚡ 5 MIN · FREE',short:'5 min',paid:false},coffee:{label:'☕ 15 MIN · 1 COFFEE ($5)',short:'15 min',paid:true},meet:{label:'🤝 MEET IN SF · 1 COFFEE',short:'meet in SF',paid:true}};
export const BMC_URL='https://buymeacoffee.com/gabe.maxxing';
export const LINKEDIN_PROFILE_URL='https://www.linkedin.com/in/francisco-gabriel-van-langenhove/';
export const SUPPORT_LINKS=Object.fromEntries(['call','bmc','dinner','roll'].flatMap(kind=>['li','x'].map(platform=>[kind+'-'+platform,{kind,source:platform==='li'?'linkedin':'x',label:kind+' · '+(platform==='li'?'LinkedIn':'X')}])));
export const SUPPORT_STEPS={'call-coffee':'Call · Buy Me a Coffee','request-quick':'Requests · 5 min free','request-coffee':'Requests · 15 min coffee','request-meet':'Requests · meet in SF','dinner-linkedin':'Dinner · LinkedIn DM','dinner-instagram':'Dinner · Instagram DM','dinner-x':'Dinner · X DM','roll-instagram':'Roll / surf · Instagram DM','roll-x':'Roll / surf · X DM'};
