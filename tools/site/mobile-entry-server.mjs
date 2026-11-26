// HTTPS fixture: WebKit correctly rejects Secure cookies on plain HTTP.
import http from 'node:http';
import https from 'node:https';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const dir=mkdtempSync(path.join(tmpdir(),'corvus-mobile-tls-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(dir,'key.pem'),'-out',path.join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
const backendPort=Number(process.env.E2E_PORT || 4189);
const tlsPort=Number(process.env.E2E_TLS_PORT || 8443);
const backend=spawn(process.execPath,['tools/site/e2e-server.mjs'],{env:{...process.env,E2E_PORT:String(backendPort)},stdio:'inherit'});
const proxy=https.createServer({key:readFileSync(path.join(dir,'key.pem')),cert:readFileSync(path.join(dir,'cert.pem'))},(req,res)=>{
  const forward=http.request({hostname:'127.0.0.1',port:backendPort,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  forward.on('error',()=>{res.writeHead(503);res.end('Starting fixture');});req.pipe(forward);
});
proxy.listen(tlsPort);
function stop(){backend.kill();proxy.close();rmSync(dir,{recursive:true,force:true});process.exit();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
