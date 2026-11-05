const VERSION='2025-09-03';
export class SyncError extends Error {constructor(code,details={}){super(code);this.code=code;Object.assign(this,details);}}
export const uuid=id=>/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(id||'');
export function notionClient({token=process.env.NOTION_TOKEN,fetcher=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),deadline=Infinity}={}){
 let next=now()+350;
 return async function request(path,method='GET',body){
  for(let attempt=0;attempt<4;attempt++){
   if(now()+Math.max(0,next-now())+12000>deadline)throw new SyncError('yield',{retryAt:next});
   await sleep(Math.max(0,next-now()));next=now()+350;
   let response;
   try{response=await fetcher(`https://api.notion.com/v1/${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Notion-Version':VERSION,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000),redirect:'error'});}catch{throw new SyncError('notion_unavailable');}
   if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));next=now()+Math.max(1000,Number.isFinite(seconds)?seconds*1000:1000);continue;}
   if(!response.ok)throw new SyncError([401,403,404].includes(response.status)?'notion_access':'notion_unavailable');
   return response.json();
  }
  throw new SyncError('notion_rate_limit');
 };
}
export function validateSchema(properties={}){
 const required={date:['date'],hour:['number'],region:['select'],type:['select'],voice:['select'],lane:['select'],campaign:['rich_text','title'],target_url:['url'],my_url:['url'],text:['rich_text','title'],link:['url'],link_type:['select'],clicks:['number'],clicks_pidgy:['number'],synced_at:['date'],clicks_estimated:['checkbox']};
 for(const [name,types]of Object.entries(required))if(!types.includes(properties[name]?.type))throw new SyncError('notion_schema');
}
