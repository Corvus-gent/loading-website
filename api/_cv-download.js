// Public PDF delivery must not wait for optional analytics infrastructure.
const BOTS = /bot|crawl|spider|preview|slurp|facebookexternalhit|linkedinbot|whatsapp|telegram|discord|curl|wget/i;
export function createCvDownloadHandler({readPdf,count,ready=()=>true,schedule=()=>{},now=()=>new Date()}) {
  return function handler(req,res) {
    const method=req.method||'GET';
    if(!['GET','HEAD'].includes(method)) {
      res.setHeader('Allow','GET, HEAD');
      return res.status(405).end();
    }
    let file;
    try {file=readPdf();}
    catch {res.setHeader('Cache-Control','no-store');return res.status(503).send('The CV download is temporarily unavailable. Please try the web CV at /cv/tech/.');}
    const download=req.query?.dl==='1';
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Length',String(file.length));
    res.setHeader('Content-Disposition',`${download?'attachment':'inline'}; filename="Gabriel-Van-Langenhove-Technical-CV.pdf"`);
    res.setHeader('Cache-Control','no-store');
    if(method==='HEAD')return res.status(200).end();
    if(ready()&&!BOTS.test(req.headers?.['user-agent']||'')) {
      const kind=download?'download':'open';
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(now());
      const work=Promise.resolve().then(()=>count([['INCR',`cv:${kind}`],['INCR',`cv:${kind}:${day}`]])).catch(()=>{});
      try {schedule(work);}catch {/* Analytics scheduling must never block the PDF. */}
    }
    return res.status(200).send(file);
  };
}
