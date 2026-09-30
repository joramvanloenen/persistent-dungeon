import test from 'node:test';
import assert from 'node:assert/strict';
import {settlement,npcsFor,resourcesFor,resolveResource,heightAt,waterDistance,CHUNK,initialPlayer} from '../src/world.js';
import {validateAction,npcReply,createPlayer} from '../src/rules.js';
import {Store} from '../src/storage.js';
test('generation has stable settlements, NPCs, resources, and finite seamless terrain',()=>{
 assert.deepEqual(settlement(-2,4),settlement(-2,4));assert.deepEqual(resourcesFor(-5,3),resourcesFor(-5,3));
 for(let x=-400;x<400;x+=17)for(let z=-200;z<200;z+=19)assert.ok(Number.isFinite(heightAt(x,z)));
 const s=settlement(-2,4);assert.ok(waterDistance(s.x,s.z)>125);assert.equal(heightAt(s.x,s.z),s.y);
 const n=npcsFor(s);assert.deepEqual(n.slice(0,3).map(n=>n.role),['gatherer','keeper','wayfarer']);assert.equal(new Set(n.map(n=>n.id)).size,n.length);
 for(const r of resourcesFor(4,-3))assert.deepEqual(resolveResource(r.id),r);
});
test('gather validates proximity and rejects already claimed nodes',()=>{
 const r=resourcesFor(2,3)[0],p={...createPlayer('x'),x:r.x,z:r.z};
 const initial=p.inventory[r.kind];const a={type:'gather',target:r.id};const result=validateAction(p,a);assert.ok(result.player.inventory[r.kind]>p.inventory[r.kind]);assert.equal(p.inventory[r.kind],initial);
 assert.throws(()=>validateAction(p,a,{depleted:true}),/already/);assert.throws(()=>validateAction({...p,x:r.x+50},a),/closer/);
});
test('movement rejects invalid coordinates, teleporting, and drains supplies only with distance',()=>{
 const p=createPlayer('x');assert.throws(()=>validateAction(p,{type:'move',x:NaN,z:0}),/outside/);
 assert.throws(()=>validateAction(p,{type:'move',x:p.x+500,z:p.z}),/too far/);
 const q=validateAction(p,{type:'move',x:p.x+1,z:p.z}).player;assert.ok(q.food<p.food);assert.ok(q.water<p.water);assert.equal(q.distance,1);
 assert.equal(validateAction(p,{type:'move',x:p.x,z:p.z},{now:Date.now()+86400000}).player.food,p.food);
});
test('NPC memory quotes exact old information and attributes other travelers',()=>{
 const s=settlement(0,0),npc=npcsFor(s)[0],p=createPlayer('myself','Yoram');
 const m={npc:npc.id,playerId:p.id,playerName:'Yoram',message:'The glass key is beneath the old oak.',response:'',createdAt:1};
 const recent=Array.from({length:250},(_,i)=>({...m,message:`Other story number ${i}`,createdAt:i+2}));
 assert.match(npcReply(npc,p,'Do you remember the glass key?',[...recent,m]),/glass key is beneath the old oak/);
 assert.match(npcReply(npc,{...p,id:'another',name:'Ada'},'What do you remember about the glass key?',[m]),/Yoram/);
 const pos={...p,x:npc.x,z:npc.z};const response=validateAction(pos,{type:'talk',target:npc.id,message:'I collect purple stones.'});assert.match(response.extra.response,/purple stones/);
 assert.throws(()=>validateAction(pos,{type:'talk',target:npc.id,message:'x'.repeat(801)}),/800/);
});
test('local preview reload keeps resources, full conversation, and traveler with failed-save rollback',async()=>{
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const a=new Store();await a.init();const npc=npcsFor(settlement(0,0))[0];a.local.player.x=npc.x;a.local.player.z=npc.z;
 const r=await a.action({type:'talk',target:npc.id,message:'My boat is named Moonfish.'},a.local.player);
 const b=new Store();await b.init();assert.equal(b.local.memories[0].message,'My boat is named Moonfish.');assert.equal(b.local.player.id,a.local.player.id);
 const before=structuredClone(b.local);globalThis.localStorage.setItem=()=>{throw Error('quota');};await assert.rejects(b.action({type:'rename',name:'Lost rename'},b.local.player),/could not save/);assert.deepEqual(b.local,before);
});
