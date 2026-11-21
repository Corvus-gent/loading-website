import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import sharp from 'sharp';
import {fields} from '../../api/_interviews/store.js';
const scripts=[...readFileSync('api/_interviews/store.js','utf8').matchAll(/\['EVAL',`([\s\S]*?)`/g)].map(m=>m[1]+'\n');for(const [i,name]of ['save','delete'].entries())assert.equal(readFileSync('rust/migration/interview-'+name+'.lua','utf8'),scripts[i]);
const input={builder:'Ada',project:'Coffee robot',description:'Delivers coffee.',consent:true};
const fixtures=[];for(const key of ['builder','project','description','x_handle','ig_handle','clip_url','consent'])for(const value of [null,false,true,0,7,[],['a'],{},'', '  ','a','@abc','@bad-url/path','x'.repeat(81),'😀'.repeat(41),'\uFEFF  A\nB\u0000\u007f ', 'https://example.test/a b?q=1#x','http://example.test','https://localhost','https://127.0.0.1','https://user:pass@example.test','https://[::1]/']){fixtures.push({...input,[key]:value});}
for(const max of [80,100,220])for(const length of [max-1,max,max+1])fixtures.push({...input,[max===80?'builder':max===100?'project':'description']:'a'.repeat(length)});
function run(rows){return new Promise((resolve,reject)=>{const p=spawn('target/debug/corvus-contract',[],{stdio:['pipe','pipe','pipe']}),lines=[];let out='',err='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(err));try{resolve(out.trim().split('\n').map(v=>JSON.parse(v)));}catch(e){reject(e);}});p.stdin.end(rows.map(v=>JSON.stringify(v)).join('\n')+'\n');});}
const actual=await run(fixtures.map(body=>({operation:'interview-fields',body})));fixtures.forEach((body,i)=>{let expected;try{expected=fields(body);}catch(e){expected={error:e.message};}assert.deepEqual(actual[i],expected,JSON.stringify(body));});
for(const [format,width,height,orientation,alpha] of [['png',1600,1000,1,false],['jpeg',1200,600,6,false],['webp',400,700,1,false],['png',320,120,1,true]]){
 const src=sharp({create:{width,height,channels:alpha?4:3,background:{r:220,g:150,b:40,alpha:alpha?0.5:1}}}).withMetadata({orientation});
 const input=await src.toFormat(format).toBuffer();const [{data,error}]=await run([{operation:'interview-photo',value:`data:image/${format};base64,`+input.toString('base64')}]);assert.equal(error,undefined);const output=Buffer.from(data,'base64');const metadata=await sharp(output).metadata(),expected=await sharp(input).rotate().resize(1400,1400,{fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();const legacy=await sharp(expected).metadata();assert.equal(metadata.width,legacy.width);assert.equal(metadata.height,legacy.height);assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);const oldPixel=await sharp(expected).resize(1,1).raw().toBuffer(),newPixel=await sharp(output).resize(1,1).raw().toBuffer();assert(oldPixel.every((p,i)=>Math.abs(p-newPixel[i])<=4),`color differs for ${format}`);
}
const huge=await sharp({create:{width:5000,height:5000,channels:3,background:'black'}}).png().toBuffer();
const rejects=await run(['data:image/gif;base64,AAAA','data:image/png;base64,AAAA','data:image/jpeg;base64,%%%','data:image/png;base64,'+huge.toString('base64')].map(value=>({operation:'interview-photo',value})));assert(rejects.every(v=>v.error));
console.log(`PASS: ${fixtures.length} interview form fixtures match legacy; JPEG/PNG/WebP orientation, max size, no enlargement, alpha background, EXIF stripping, damaged/oversized-image rejection.`);
