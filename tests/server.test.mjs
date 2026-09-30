import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {DatabaseSync} from 'node:sqlite';import {settlement,npcsFor,resourcesFor} from '../src/world.js';
import {smithFor} from '../src/world.js';import {forgeSpot} from '../src/action-game.js';
test('persistent server preserves sessions and memory across restart, shares node claims, and rejects stale revisions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'evermere-test-')),database=join(dir,'world.sqlite'),port=19478,base=`http://localhost:${port}`;let process;
 const start=()=>new Promise((resolve,reject)=>{process=spawn(globalThis.process.execPath,['backend/server.mjs'],{env:{...globalThis.process.env,PORT:String(port),GAME_DATABASE:database,GAME_ORIGIN:base},stdio:['ignore','pipe','pipe']});process.stdout.on('data',()=>resolve());process.on('error',reject);process.on('exit',code=>reject(Error('Server exited '+code)));process.stderr.on('data',d=>{if(String(d).includes('Error:'))reject(Error(String(d)));});});
 const stop=()=>new Promise(resolve=>{process.once('exit',resolve);process.kill();});
 const request=async(path,body,token)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,...await r.json()};};
 try{
 await start();const auth=await request('/api/auth',{email:'test@example.com',password:'test-password-long',signup:true});assert.equal(auth.status,200);
 let state=await request('/api/world',{path:'state'},auth.token);const npc=npcsFor(settlement(0,0))[0];
 const db=new DatabaseSync(database);let p=state.player;p.x=npc.x;p.z=npc.z;db.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(p),p.id);
 let talk=await request('/api/world',{path:'action',revision:p.revision,action:{type:'talk',target:npc.id,message:'The gold locket is buried by the willow.'}},auth.token);assert.equal(talk.status,200);
 const stale=await request('/api/world',{path:'action',revision:p.revision,action:{type:'rename',name:'Stale'}},auth.token);assert.equal(stale.status,409);
 const node=resourcesFor(2,1)[0];p=talk.player;p.x=node.x;p.z=node.z;db.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(p),p.id);
 const auth2=await request('/api/auth',{email:'second@example.com',password:'test-password-long',signup:true});const state2=await request('/api/world',{path:'state'},auth2.token);const p2=state2.player;p2.x=node.x;p2.z=node.z;db.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(p2),p2.id);
 const claim=await request('/api/world',{path:'action',revision:p.revision,action:{type:'gather',target:node.id}},auth.token);assert.equal(claim.status,200);
 const second=await request('/api/world',{path:'action',revision:p2.revision,action:{type:'gather',target:node.id}},auth2.token);assert.match(second.error,/already/);
 const smith=Array.from({length:20},(_,i)=>smithFor(settlement(i-10,0))).find(Boolean);p=claim.player;p.x=smith.x;p.z=smith.z;p.inventory.iron=5;p.inventory.wood=Math.max(3,p.inventory.wood);db.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(p),p.id);
 const paid=await request('/api/world',{path:'action',revision:p.revision,action:{type:'forge-start',target:smith.id,recipe:'dagger'}},auth.token);assert.equal(paid.status,200);db.close();
 await stop();await start();state=await request('/api/world',{path:'state'},auth.token);assert.equal(state.player.inventory[node.kind],paid.player.inventory[node.kind]);assert.deepEqual(state.player.forge,paid.player.forge);
 const edit=new DatabaseSync(database);p=state.player;p.forge.startedAt=Date.now()-7000;edit.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(p),p.id);
 let forged=await request('/api/world',{path:'action',revision:p.revision,action:{type:'forge-transfer'}},auth.token);assert.equal(forged.status,200);for(let i=0;i<10;i++){forged=await request('/api/world',{path:'action',revision:forged.player.revision,action:{type:'forge-strike',step:forged.player.forge.step,spot:forgeSpot(forged.player.forge)}},auth.token);assert.equal(forged.status,200);}assert.equal(forged.player.weapons.length,1);p=forged.player;p.x=npc.x;p.z=npc.z;edit.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(p),p.id);edit.close();await stop();await start();state=await request('/api/world',{path:'state'},auth.token);assert.equal(state.player.equipped,forged.player.equipped);assert.equal(state.player.forge,null);
 const recall=await request('/api/world',{path:'action',revision:state.player.revision,action:{type:'talk',target:npc.id,message:'Do you remember the gold locket?'}},auth.token);assert.match(recall.extra.response,/gold locket is buried/);
 const unauthorized=await request('/api/world',{path:'state'});assert.equal(unauthorized.status,401);
 const secret=await fetch(base+'/evermere.sqlite');assert.equal(secret.status,404);
 }finally{if(process&&!process.killed)await stop();await rm(dir,{recursive:true,force:true});}
});
