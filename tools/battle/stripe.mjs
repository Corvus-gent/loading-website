import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {loadCompoundEnv} from '../compound-env.mjs';
loadCompoundEnv();const cli=path.join(os.homedir(),'.local/bin/stripe');
function run(args){const p=spawnSync(cli,[...args,'--live'],{encoding:'utf8',timeout:20000,env:{...process.env,...(process.env.STRIPE_LIVE_API_KEY?{STRIPE_API_KEY:process.env.STRIPE_LIVE_API_KEY}:{})}});let r;try{r=JSON.parse(p.stdout);}catch{throw Error('Stripe CLI unavailable or not authorized');}if(p.status||r.error)throw Error('Stripe rejected request: '+(r.error?.code||r.error?.type||'CLI error'));return r;}
const config=JSON.parse(fs.readFileSync('battle/config.json'));try{const account=run(['accounts','retrieve']);if(!account.charges_enabled)throw Error('Live payments are not enabled');const existing=run(['payment_links','list','--limit','100']).data;
for(const name of ['codex','compound']){
 if(config.tips[name]?.startsWith('https://buy.stripe.com/')){
  const link=existing.find(link=>link.url===config.tips[name]);if(!link)throw Error('Configured '+name+' payment link was not found; refusing to replace it');
  const items=run(['payment_links','list_line_items',link.id,'--limit','10']).data;
  if(items.length!==1||items[0].price.unit_amount!==300||items[0].price.currency!=='usd'||items[0].quantity!==1)throw Error('Unexpected checkout price; no changes made');
  const product=typeof items[0].price.product==='string'?items[0].price.product:items[0].price.product.id;
  run(['products','update',product,'--description',config.tipDescription,'--confirm']);
  if(run(['products','retrieve',product]).description!==config.tipDescription)throw Error('Product description verification failed');
  console.log(name+': product copy verified; existing $3 payment link unchanged');continue;
 }
const label=name==='codex'?'Back Codex 🤖':'Back Compound 🎬';const product=run(['products','create','--name',label,'--description',config.tipDescription,'--idempotency','battle-'+name+'-product-v1']);const price=run(['prices','create','--currency','usd','--unit-amount','300','--product',product.id,'--idempotency','battle-'+name+'-usd3-v1']);const link=run(['payment_links','create','-d','line_items[0][price]='+price.id,'-d','line_items[0][quantity]=1','-d','after_completion[type]=redirect','-d','after_completion[redirect][url]=https://corvus.gent/battle?thanks='+name,'-d','metadata[campaign]=battle','-d','metadata[fighter]='+name,'--idempotency','battle-'+name+'-link-v1']);config.tips[name]=link.url;console.log(name+': live $3 payment link ready');}fs.writeFileSync('battle/config.json',JSON.stringify(config,null,2)+'\n');}catch(e){console.log(e.message);process.exitCode=1;}
