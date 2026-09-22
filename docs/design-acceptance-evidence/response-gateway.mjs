import http from 'node:http';
import {readFileSync,appendFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const control='/private/tmp/design-review-gateway/profile.json';
const log='/private/tmp/design-review-gateway/events.jsonl';
if(!existsSync(control))writeFileSync(control,JSON.stringify({rules:[]}),{mode:0o600});
const record=e=>appendFileSync(log,JSON.stringify({at:new Date().toISOString(),...e})+'\n',{mode:0o600});
function profile(){try{return JSON.parse(readFileSync(control,'utf8'));}catch{return{rules:[]};}}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost:5174');
 const rule=(profile().rules||[]).find(r=>r.method===req.method&&r.pathname===url.pathname&&Object.entries(r.query||{}).every(([k,v])=>url.searchParams.get(k)===v));
 const id=randomUUID();
 const headers={...req.headers,host:'localhost:5173'};
 if(headers.origin==='http://localhost:5174')headers.origin='http://localhost:5173';
 if(headers.referer?.startsWith('http://localhost:5174'))headers.referer=headers.referer.replace('http://localhost:5174','http://localhost:5173');
 if(rule)record({id,phase:'received',method:req.method,path:url.pathname,query:url.search,delayMs:rule.delayMs||0,fixture:rule.name||'controlled-response'});
 const forward=()=>{
  if(res.destroyed)return;
  if(rule?.response){const body=JSON.stringify(rule.response.json||{error:'Temporary interruption. Please try again.'});res.writeHead(rule.response.status||503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(body);record({id,phase:'completed',status:rule.response.status||503,fixture:rule.name});return;}
  const upstream=http.request({hostname:'::1',port:5173,path:req.url,method:req.method,headers},reply=>{
   const responseHeaders={...reply.headers};
   if(responseHeaders.location?.startsWith('http://localhost:5173'))responseHeaders.location=responseHeaders.location.replace('http://localhost:5173','http://localhost:5174');
   res.writeHead(reply.statusCode,responseHeaders);reply.pipe(res);
   if(rule)reply.on('end',()=>record({id,phase:'completed',status:reply.statusCode,fixture:rule.name}));
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The local preview is unavailable.'}));if(rule)record({id,phase:'upstream-unavailable'});});
  req.pipe(upstream);
 };
 const delay=Math.min(15000,Math.max(0,Number(rule?.delayMs)||0));if(delay)setTimeout(forward,delay);else forward();
});
server.on('upgrade',(req,socket,head)=>{
 const upstream=http.request({hostname:'::1',port:5173,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5173'}});
 upstream.on('upgrade',(response,target,targetHead)=>{socket.write(`HTTP/1.1 ${response.statusCode} Switching Protocols\r\n`);for(const[k,v]of Object.entries(response.headers))socket.write(`${k}: ${v}\r\n`);socket.write('\r\n');if(head.length)target.write(head);if(targetHead.length)socket.write(targetHead);socket.pipe(target).pipe(socket);socket.on('error',()=>target.destroy());target.on('error',()=>socket.destroy());});
 upstream.on('error',()=>socket.destroy());upstream.end();
});
server.listen(5174,'::1',()=>console.log('Local design response gateway listening on http://localhost:5174; upstream localhost:5173'));
process.on('SIGINT',()=>{server.close();server.closeAllConnections();process.exit(0)});
