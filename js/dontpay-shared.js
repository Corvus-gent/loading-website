export const SUGGESTION_LIFETIME = 90 * 86400;
export function validateSuggestion(body) {
 if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Please fill in the suggestion form.');
 if (body.website) throw Error('Leave the hidden field empty.');
 if (body.consent !== true) throw Error('Please agree to send the shop details to Gabe.');
 if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id || '')) throw Error('Please reload the page and try again.');
 const output={id:body.id.toLowerCase(),consent:true};
 for(const [key,max,required] of [['shop',100,true],['neighborhood',100,true],['link',500,false],['language',60,false],['note',500,false]]){
  const value=body[key] ?? '';
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error(`Please shorten or correct the ${key} field.`);
  output[key]=value.trim();if(required&&!output[key])throw Error(`Please enter the ${key === 'shop' ? 'shop name' : 'neighborhood / city'}.`);
 }
 if(output.link){let u;try{u=new URL(output.link);}catch{throw Error('Use a full HTTPS shop link, or leave it blank.');}
  if(u.protocol!=='https:'||!u.hostname||u.username||u.password)throw Error('Use a public HTTPS shop link without login details.');
 }
 return output;
}
