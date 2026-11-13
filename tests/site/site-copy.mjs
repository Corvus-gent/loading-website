import assert from 'node:assert/strict';
import {rows,siteStrings} from '../../js/i18n/site-copy.js';
const languages=['en','nl','es','fr','pt','de','zh'];
const tokens=text=>[...text.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
for(const [key,values] of Object.entries(rows)){
  assert.equal(values.length,languages.length,key+': seven translations');
  for(const [i,value] of values.entries()){
    assert.equal(typeof value,'string',key);
    assert(value.trim(),key+': nonempty '+languages[i]);
    assert(!/<\/?[a-z][^>]*>/i.test(value),key+': plain text only');
    assert.deepEqual(tokens(value),tokens(values[0]),key+': placeholders');
    assert.equal(siteStrings(languages[i])[key],value,key+': language column');
  }
}
console.log('PASS: '+Object.keys(rows).length+' site keys, seven languages, plain text and matching placeholders.');
