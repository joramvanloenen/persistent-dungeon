import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlayer,validateAction} from '../src/rules.js';
import {resolveNpc,CHUNK} from '../src/world.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=+(process.env.PORT||8080),origin=process.env.GAME_ORIGIN||`http://localhost:${port}`;
const db=new DatabaseSync(process.env.GAME_DATABASE||resolve(root,'evermere.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY,cx INTEGER NOT NULL,cz INTEGER NOT NULL,actor TEXT NOT NULL,depleted_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS nodes_chunk ON nodes(cx,cz);
CREATE TABLE IF NOT EXISTS memories(id INTEGER PRIMARY KEY,npc TEXT NOT NULL,player_id TEXT NOT NULL,player_name TEXT NOT NULL,message TEXT NOT NULL,response TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS memories_npc_time ON memories(npc,created_at DESC);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,type TEXT NOT NULL,summary TEXT NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_actor_time ON events(actor,created_at DESC);`);
const stateOf=id=>{const row=db.prepare('SELECT * FROM players WHERE id=?').get(id);return row?JSON.parse(row.state):null;};
function readBody(req){return new Promise((res,rej)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>12000){rej(Error('Request too large.'));req.destroy();}});req.on('end',()=>{try{res(JSON.parse(raw||'{}'));}catch{rej(Error('Invalid request.'));}});req.on('error',rej);});}
function memoryRow(m){return {id:m.id,npc:m.npc,playerId:m.player_id,playerName:m.player_name,message:m.message,response:m.response,createdAt:m.created_at};}
const rate=new Map();function limited(key,max=90){const now=Date.now(),item=rate.get(key)||{n:0,start:now};if(now-item.start>60000){item.n=0;item.start=now;}item.n++;rate.set(key,item);if(rate.size>10000)for(const [k,v]of rate)if(now-v.start>60000)rate.delete(k);return item.n>max;}
const server=http.createServer(async(req,res)=>{
 const reqOrigin=req.headers.origin;
 const cors={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const send=(data,status=200)=>{res.writeHead(status,cors);res.end(JSON.stringify(data));};
 if(req.url?.startsWith('/api/')){
  if(reqOrigin&&reqOrigin!==origin)return send({error:'This origin is not allowed.'},403);
  if(req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
  if(req.method!=='POST')return send({error:'Use POST.'},405);
  try{
   const body=await readBody(req);
   if(req.url==='/api/auth'){
    if(limited('auth:'+req.socket.remoteAddress,20))return send({error:'Too many sign-in attempts. Wait a minute.'},429);
    if(body.path==='logout'){db.prepare('DELETE FROM sessions WHERE token=?').run(String(req.headers.authorization||'').replace(/^Bearer /,''));return send({ok:true});}
    const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
    if(!/^\S+@\S+\.\S+$/.test(email)||email.length>250||password.length<8||password.length>200)return send({error:'Use a valid email and a password of 8–200 characters.'},400);
    let account=db.prepare('SELECT * FROM accounts WHERE email=?').get(email);
    if(body.signup){if(account)return send({error:'This traveler already exists. Sign in instead.'},400);const salt=randomBytes(16).toString('hex'),id=crypto.randomUUID(),hash=scryptSync(password,salt,64).toString('hex');db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(id,email,salt,hash);account={id,email,salt,password:hash};}
    if(!account){scryptSync(password,'dummy-account-timing-salt',64);return send({error:'Email or password is incorrect.'},401);}
    const computed=scryptSync(password,account.salt,64);if(!timingSafeEqual(computed,Buffer.from(account.password,'hex')))return send({error:'Email or password is incorrect.'},401);
    const token=randomBytes(48).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,account.id,Date.now()+30*86400000);db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());return send({token});
   }
   const token=String(req.headers.authorization||'').replace(/^Bearer /,''),session=db.prepare('SELECT account_id FROM sessions WHERE token=? AND expires>?').get(token,Date.now());
   if(!session)return send({error:'Sign in to your traveler.'},401);
   const actor=session.account_id;if(limited(actor,100))return send({error:'Too many actions. Wait a minute.'},429);
   let p=stateOf(actor);if(!p){p=createPlayer(actor);db.prepare('INSERT INTO players VALUES(?,?,?,?)').run(actor,JSON.stringify(p),0,Date.now());}
   if(body.path==='state'){
    const cx=Math.floor(p.x/CHUNK),cz=Math.floor(p.z/CHUNK),nodes=db.prepare('SELECT id FROM nodes WHERE cx BETWEEN ? AND ? AND cz BETWEEN ? AND ?').all(cx-3,cx+3,cz-3,cz+3);
    const players=db.prepare('SELECT id,state FROM players WHERE updated_at>? LIMIT 50').all(Date.now()-120000).map(r=>{const s=JSON.parse(r.state);return {id:r.id,name:s.name,x:s.x,z:s.z};}).filter(s=>Math.hypot(s.x-p.x,s.z-p.z)<700);
    const events=db.prepare('SELECT * FROM events WHERE actor=? ORDER BY created_at DESC LIMIT 20').all(actor).map(e=>({...e,createdAt:e.created_at}));return send({player:p,depleted:nodes.map(n=>n.id),players,events});
   }
   if(body.path==='memory'){
    const n=resolveNpc(String(body.npc));if(!n||Math.hypot(p.x-n.x,p.z-n.z)>20)return send({error:'Walk closer to this person.'},400);
    return send({memories:db.prepare('SELECT * FROM memories WHERE npc=? ORDER BY created_at DESC LIMIT 200').all(n.id).reverse().map(memoryRow)});
   }
   if(body.path==='action'){
    if(!Number.isInteger(body.revision)||body.revision!==p.revision)return send({error:'Your traveler changed in another session. Reload and try again.'},409);
    const a=body.action;if(a?.type==='talk'&&limited('talk:'+actor,20))return send({error:'Give your conversation a moment.'},429);
    db.exec('BEGIN IMMEDIATE');try{
     p=stateOf(actor);if(p.revision!==body.revision)throw Error('Your traveler changed in another session. Reload and try again.');
     const depleted=a.type==='gather'&&!!db.prepare('SELECT id FROM nodes WHERE id=?').get(String(a.target));
     const memories=a.type==='talk'?db.prepare('SELECT * FROM memories WHERE npc=? ORDER BY created_at DESC').all(String(a.target)).map(memoryRow):[];
     const result=validateAction(p,a,{depleted,memories}),now=Date.now();
     if(a.type==='gather'){const parts=a.target.split(':');db.prepare('INSERT INTO nodes VALUES(?,?,?,?,?)').run(a.target,+parts[1],+parts[2],actor,now);}
     if(a.type==='talk')db.prepare('INSERT INTO memories(npc,player_id,player_name,message,response,created_at) VALUES(?,?,?,?,?,?)').run(a.target,actor,result.player.name,result.extra.message,result.extra.response,now);
     db.prepare('UPDATE players SET state=?,revision=?,updated_at=? WHERE id=?').run(JSON.stringify(result.player),result.player.revision,now,actor);
     db.prepare('INSERT INTO events(actor,type,summary,data,created_at) VALUES(?,?,?,?,?)').run(actor,a.type,result.summary,JSON.stringify(result.extra),now);
     db.exec('COMMIT');return send(result);
    }catch(e){db.exec('ROLLBACK');throw e;}
   }
   return send({error:'Unknown world request.'},400);
  }catch(e){console.error('World request:',e.message);return send({error:e.message||'Could not save this action.'},400);}
 }
 // Optional same-origin development/static serving. Live database and backend files are never served.
 const path=decodeURIComponent((req.url||'/').split('?')[0]),file=resolve(root,'.'+(path==='/'?'/index.html':path));
 const rel=file.slice(root.length+1);
 if(!file.startsWith(root+'/')||!(/^(index\.html|style\.css|config\.js|favicon\.svg)$/.test(rel)||/^(src|vendor)\//.test(rel))||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain'})[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
server.listen(port,'0.0.0.0',()=>console.log(`Evermere server on port ${port}`));
