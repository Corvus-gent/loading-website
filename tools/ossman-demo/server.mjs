import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function serve(root=process.cwd()){
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/name-vote'){if(req.method!=='GET'){res.writeHead(405).end();return;}res.setHeader('Content-Type','application/json');res.end(await fs.readFile(path.join(root,'tests/results/ossman-demo/vote-snapshot.json')));return;}let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))throw Error();if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));return{url:'http://127.0.0.1:'+server.address().port,close:()=>server.close()};}
