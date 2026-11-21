// Public aggregate boundary: no free-form billing evidence or raw telemetry.
const fields=['status','started','through','window_closed_at','responses','duplicates_skipped','models','tokens','uncached_input_tokens','credits','usd','billing_evidence','method','limitations'];
const tokenFields=['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','total_tokens'];
const publicMethod='Unique per-response token_usage_record entries in the root chat, from the explicit Rust request to the report request. Cumulative/event copies are excluded. Cached input is a subset of input; reasoning is a subset of output, never added twice.';
const publicLimitations=[
 'Local root-chat telemetry, not an invoice or guaranteed complete account usage.',
 'Model metadata is recorded; billing service tier and plan allocation are unavailable.',
 'Earlier site/video tasks and this article-page build are excluded. Child-chat/provider usage, if any, is not included.',
 'Repeated context counts again as input; most was cached. These are not unique words or source-code lines.'
];
const exactFields=(value,keys,label)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw Error('Unreviewed '+label+' fields');
};
const count=(value,label)=>{
 if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid '+label+' counter');
};
const stamp=(value,label)=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))throw Error('Invalid '+label+' timestamp');
 const milliseconds=Date.parse(value);
 if(!Number.isFinite(milliseconds)||new Date(milliseconds).toISOString().replace('.000Z','Z')!==value.replace('.000Z','Z'))throw Error('Invalid '+label+' timestamp');
 return milliseconds;
};
export function publicUsage(value){
 exactFields(value,fields,'usage');
 exactFields(value.tokens,tokenFields,'token');
 if(value.status!=='observed-local')throw Error('Unsupported usage source');
 if(value.credits!==null||value.usd!==null||value.billing_evidence!==null)throw Error('Billing needs a separate reviewed import');
 const start=stamp(value.started,'start'),through=stamp(value.through,'last response'),end=stamp(value.window_closed_at,'closed window');
 if(start>through||through>end)throw Error('Usage lies outside the reviewed window');
 count(value.responses,'response');count(value.duplicates_skipped,'duplicate');count(value.uncached_input_tokens,'uncached input');
 if(!value.responses)throw Error('No recorded responses');
 for(const key of tokenFields)count(value.tokens[key],key);
 const t=value.tokens;
 if(t.cached_input_tokens>t.input_tokens||t.reasoning_output_tokens>t.output_tokens||t.total_tokens!==t.input_tokens+t.output_tokens||value.uncached_input_tokens!==t.input_tokens-t.cached_input_tokens)throw Error('Usage counters do not reconcile');
 // Review newly observed models before publishing metadata from another source.
 if(!Array.isArray(value.models)||value.models.length!==1||value.models[0]!=='gpt-6-astra')throw Error('Unreviewed model metadata');
 return {...value,tokens:{...t},models:[...value.models],method:publicMethod,limitations:[...publicLimitations]};
}
