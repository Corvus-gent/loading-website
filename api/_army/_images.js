import fs from 'node:fs/promises';
import {armyCopy} from './_copy.js';
import {tagSVG,esc} from '../../js/army/art.js';
export async function serveImage(res,soldier,code,poster=false){
 const {default:sharp}=await import('sharp');
 const png=await sharp(Buffer.from(tagSVG(soldier,code,{poster,labels:await armyCopy('en')}))).png().toBuffer();
 res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','private, no-store');
 return res.status(200).send(png);
}
export async function serveProfile(res,soldier){
 let html=await fs.readFile(new URL('../../soldier/index.html',import.meta.url),'utf8');
 const copy=await armyCopy('en');
 const title=soldier.username+' · '+copy.rankLabel+' '+soldier.rank+(soldier.tier&&soldier.tier!=='imperator'?' · '+copy.tierLabel+' '+soldier.tier:'')+' | corvus',url='https://corvus.gent/soldier/'+encodeURIComponent(soldier.username);
 html=html.replaceAll('%%TITLE%%',esc(title)).replaceAll('%%NAME%%',esc(soldier.username)).replaceAll('%%URL%%',esc(url)).replaceAll('%%DESCRIPTION%%',esc(`${soldier.username} enlisted. ${soldier.recruits} recruits. one soldier at a time.`));
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','private, no-store');
 return res.status(200).send(html);
}
