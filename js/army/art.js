import qrcode from '../vendor/qrcode-2.0.4.mjs';
export const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const crow = `<path d="M13 73l24-21 9-24 14-12 19 5 13 11 25 8-27 7-9 22-18 12-21-3-23 20 7-23z" fill="#101114" stroke="#c0b9a6" stroke-width="1.4"/><path d="M43 57l24-23-7 33-24 8m30 7 4 14m-13-14-4 14m-5 0h26" fill="none" stroke="#807e77" stroke-width="1.5"/><circle cx="77" cy="31" r="2.4" fill="#ffd76a"/>`;
export const lamp = `<path d="M32 46c-21-20-29 14-6 15m9-17c10 12 29 12 46 0l22-8-8 23c-5 14-44 24-60 1z" fill="#17130c" stroke="#c9a85d" stroke-width="2"/><path d="M40 48h36M47 72h30" stroke="#8b713f" stroke-width="1.5"/><path d="M97 37c-12-8 0-18 0-27 11 15 8 21 0 27" fill="#ffd76a"/><path d="M97 34c-4-5 0-8 1-13 3 8 3 10-1 13" fill="#fff5d2"/>`;
export function insignia(name,size=40){
 const levels={tiro:0,miles:1,decanus:2,optio:3,centurio:4,tribunus:5,legatus:6,imperator:8};const n=levels[name]||0;
 let mark=n===0?'<circle cx="24" cy="24" r="3" fill="currentColor"/>':Array.from({length:Math.min(n,3)},(_,i)=>`<path d="M10 ${17+i*8}l14-8 14 8"/>`).join('');
 if(n>=4)mark=`<path d="M24 6l5 11 12 2-9 9 2 13-10-6-10 6 2-13-9-9 12-2z"/>`+(n>=5?'<circle cx="24" cy="24" r="4"/>':'')+(n>=6?'<path d="M5 8v32M43 8v32"/>':'')+(n>=7?'<path d="M10 45h28"/>':'')+(n===8?'<circle cx="24" cy="24" r="22"/>':'');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">${mark}</svg>`;
}
export function qrMarkup(url,x,y,size=160){
 const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();const n=qr.getModuleCount(),unit=size/(n+8);let path='';
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))path+=`M${(x+(c+4)*unit).toFixed(3)} ${(y+(r+4)*unit).toFixed(3)}h${unit.toFixed(3)}v${unit.toFixed(3)}h-${unit.toFixed(3)}z`;
 return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#f4e8c9"/><path d="${path}" fill="#090909"/>`;
}
export function tagSVG(s,code,{poster=false,labels={}}={}){
 const username=s.username||'unknown soldier',serial=String(s.serial||0).padStart(4,'0'),url='https://corvus.gent/r/'+code;
 const width=poster?1080:1200,height=poster?1350:630;
 const textSize=Math.min(60,650/(username.length*.62));
 const stars=Array.from({length:45},(_,i)=>`<circle cx="${(i*197+43)%width}" cy="${(i*131+29)%height}" r="${i%7===0?1.2:.6}" fill="#bfb8a4" opacity="${i%3===0?.23:.1}"/>`).join('');
 const content=poster?`
 <text x="78" y="105" fill="#8e8778" font-size="18" letter-spacing="5">CORVUS · EST. AGAIN 2026</text>
 <text x="75" y="295" font-size="142" font-weight="700" letter-spacing="-9">join the</text><text x="75" y="445" font-size="176" font-weight="700" letter-spacing="-12">army.</text>
 <path d="M78 505H1002" stroke="#51472e"/><text x="78" y="550" font-size="24" fill="#b5ad99">quality over noise. people over performance.</text>
 <g transform="translate(680 660) scale(2.25)">${crow}</g><g transform="translate(135 650) scale(2.35)">${lamp}</g>
 <text x="78" y="1020" font-size="${Math.min(44,textSize)}" fill="#ffd76a">${esc(username)} enlisted.</text>
 <text x="78" y="1070" font-size="21" fill="#9c9585">${esc(labels.rankLabel)} ${esc(s.rank||'tiro')} · #${serial} · ${esc(s.created||'')}</text>
 ${s.tier&&s.tier!=='imperator'?`<text x="78" y="1105" font-size="21" fill="#ffd76a">${esc(labels.tierLabel)} ${esc(s.tier)}${['senator','consul'].includes(s.tier)?' · '+esc(labels.supporterLifetime):''}</text>`:''}
 <text x="78" y="1160" font-size="31">you?</text><text x="78" y="1215" font-size="22" fill="#b5ad99">corvus.gent/r/${esc(code)}</text>
 ${qrMarkup(url,790,1025,212)}
 <text x="78" y="1295" font-size="17" fill="#726b5d">one soldier at a time. #jointhearmy</text>`:`
 <text x="60" y="55" font-size="14" letter-spacing="5" fill="#807866">CORVUS · ONE SOLDIER AT A TIME</text>
 <path d="M-30 345L215 345" stroke="#5a554b" stroke-width="2"/>
 <g transform="rotate(-3 600 320)"><rect x="165" y="123" width="870" height="385" rx="72" fill="url(#metal)" stroke="#7f7357" stroke-width="1.5"/><rect x="176" y="134" width="848" height="363" rx="62" fill="none" stroke="#302d24"/>
 <circle cx="224" cy="314" r="14" fill="#020202" stroke="#625844" stroke-width="3"/><text x="280" y="207" fill="#8e8778" font-size="15" letter-spacing="6">CORVUS ARMY / #${serial}</text>
 <text x="277" y="292" font-size="${textSize}" fill="#eee5d2" font-weight="700">${esc(username)}</text>
 <text x="280" y="349" font-size="23" fill="#ffd76a">${esc(labels.rankLabel)} ${esc(s.rank||'tiro')}</text>
 ${s.tier&&s.tier!=='imperator'?`<text x="280" y="380" font-size="20" fill="#c8bea6">${esc(labels.tierLabel)} ${esc(s.tier)}${['senator','consul'].includes(s.tier)?' · '+esc(labels.supporterLifetime):''}</text>`:''}<text x="280" y="412" font-size="17" fill="#8e8778">enlisted ${esc(s.created||'')}</text>
 <text x="280" y="454" font-size="16" fill="#b8ad94">corvus.gent/r/${esc(code)}</text>${qrMarkup(url,825,330,136)}</g>
 <g transform="translate(927 60) scale(.9)">${crow}</g><text x="60" y="582" font-size="26" fill="#c8bea6">i enlisted. you?</text><text x="1140" y="582" text-anchor="end" font-size="16" fill="#726b5d">#jointhearmy</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(username)} · corvus army dog tag"><defs><radialGradient id="glow"><stop stop-color="#d79b29" stop-opacity=".19"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><linearGradient id="metal" x2=".9" y2="1"><stop stop-color="#211f19"/><stop offset=".45" stop-color="#11110f"/><stop offset="1" stop-color="#242018"/></linearGradient></defs><rect width="100%" height="100%" fill="#030303"/><ellipse cx="${width*.42}" cy="${height*.48}" rx="${width*.55}" ry="${height*.68}" fill="url(#glow)"/>${stars}<g font-family="monospace" fill="#eee5d2">${content}</g></svg>`;
}
export async function downloadArt(s,code,poster=false,labels={}){
 const svg=tagSVG(s,code,{poster,labels}),object=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{const img=new Image();img.src=object;await img.decode();const canvas=document.createElement('canvas');canvas.width=poster?1080:1200;canvas.height=poster?1350:630;canvas.getContext('2d').drawImage(img,0,0);return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));}finally{URL.revokeObjectURL(object);}
}
