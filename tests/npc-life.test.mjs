import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_EPOCH,DAY_MS,npcAt,locateNpc,roadPeopleFor,peopleNear,advanceNpcLife,witnessAction,rememberObservation,meetNpc} from '../src/npc-life.js';
import {settlement,npcsFor,REGION} from '../src/world.js';
import {villageObstacles} from '../src/scene-layout.js';
import {hitsObstacle} from '../src/world-collision.js';
import {Store} from '../src/storage.js';
import {createPlayer,validateAction,npcReply} from '../src/rules.js';
import {alienPlantGeometry,PLANT_FAMILIES} from '../src/alien-vegetation.js';
import * as T from '../vendor/three.module.js';

test('town routines walk, stop and avoid every hut, shuttle, recycler and forge',()=>{
 for(const [rx,rz] of [[0,0],[1,-2],[-3,4]]){
  const s=settlement(rx,rz),obstacles=villageObstacles(s);
  for(const n of npcsFor(s)){
   const positions=new Set(),activities=new Set();let walking=false,resting=false,previous;
   for(let t=0;t<600;t+=.5){const at=npcAt(n,WORLD_EPOCH+t*1000);positions.add(`${at.x.toFixed(1)}:${at.z.toFixed(1)}`);activities.add(at.activity);walking||=at.moving;resting||=!at.moving;
    assert.ok(!obstacles.some(o=>hitsObstacle(at,at,o,.5)),`${n.id} inside ${at.activity}`);
    if(previous)assert.ok(!obstacles.some(o=>hitsObstacle(previous,at,o,.5)),`${n.id} crossed an obstacle`);previous=at;
   }
   assert.ok(walking&&resting);assert.ok(positions.size>15&&activities.size>=3);
  }
 }
});
test('freight runners move on continuous service roads and resolve beyond loaded towns',()=>{
 const runners=roadPeopleFor(0,0);assert.equal(new Set(runners.map(n=>n.id)).size,2);
 for(const n of runners){let previous=npcAt(n,WORLD_EPOCH),maximum=0;for(let t=1;t<1800;t++){
  const at=npcAt(n,WORLD_EPOCH+t*1000);assert.ok(Math.hypot(at.x-previous.x,at.z-previous.z)<=1.901);maximum=Math.max(maximum,Math.hypot(at.x-settlement(0,0).x,at.z-settlement(0,0).z));assert.deepEqual(locateNpc(n.id,WORLD_EPOCH+t*1000),at);previous=at;
 }assert.ok(maximum>REGION*.6);}
 assert.equal(locateNpc('not-a-person'),null);assert.equal(locateNpc('v:999999:0:runner:0'),null);
});
test('conversation pauses are persisted and resume at the same route position without a jump',()=>{
 const n=roadPeopleFor(0,0)[0],now=WORLD_EPOCH+230000,at=npcAt(n,now),life=meetNpc(n,advanceNpcLife(n,{},now),now),saved=JSON.parse(JSON.stringify(life));
 assert.equal(npcAt(n,now+100000,saved).x,at.x);assert.equal(npcAt(n,now+100000,saved).moving,false);
 const resumed=npcAt(n,now+120001,saved);assert.ok(Math.hypot(resumed.x-at.x,resumed.z-at.z)<.002);
 assert.deepEqual(npcAt(n,now+DAY_MS,saved),npcAt(n,now+DAY_MS,life));
});
test('routine catchup and witnessed actions retain identity, deduplicate and remain available to dialogue',()=>{
 const n=npcsFor(settlement(0,0))[0],now=WORLD_EPOCH+300000;let life=advanceNpcLife(n,{},now);life=advanceNpcLife(n,life,now+DAY_MS*3);assert.ok(life.observations.length>3&&life.observations.length<15);
 const person=npcAt(n,now),p={...createPlayer('observer-player','Ada'),x:person.x,z:person.z,dungeon:null},witnesses=witnessAction(p,{type:'jump'},now,{}),o=witnesses.find(w=>w.npc===n.id).observation;
 life=rememberObservation(life,o);life=rememberObservation(life,o);assert.equal(life.observations.filter(v=>v.id===o.id).length,1);
 assert.match(npcReply(person,p,'What have you seen?',[],[o]),/Ada jump/);assert.match(npcReply(person,p,'What is your schedule?',[],[]),/usual circuit/);
 assert.equal(witnessAction({...p,dungeon:{id:'d:0:0'}},{type:'jump'},now).length,0);
 const far={...p,x:p.x+400,z:p.z+400};assert.ok(!witnessAction(far,{type:'jump'},now).some(w=>w.npc===n.id));
 assert.throws(()=>validateAction(far,{type:'talk',target:n.id,message:'hello'},{now}),/closer/);
 const result=validateAction(p,{type:'talk',target:n.id,message:'What have you noticed?'},{now,npcLife:{[n.id]:life}});assert.match(result.extra.response,/Ada jump/);
});
test('NPC observations, schedule pauses and spoken memories survive browser reload and save export',async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};let store=new Store();await store.init();
 const n=locateNpc(npcsFor(settlement(0,0))[0].id);Object.assign(store.local.player,{x:n.x,z:n.z,dungeon:null});store.saveLocal();
 await store.request('memory',{npc:n.id,personal:true});const result=await store.action({type:'talk',target:n.id,message:'My shuttle is named Roundabout.'},store.local.player);
 const observations=store.local.npcLife[n.id].observations,meeting=store.local.npcLife[n.id].meeting;assert.ok(observations.some(o=>o.kind==='witness'));assert.ok(meeting.until>Date.now());
 const raw=store.exportLocal();store=new Store();await store.init();assert.deepEqual(store.local.npcLife[n.id].observations,observations);assert.deepEqual(store.local.npcLife[n.id].meeting,meeting);store.importLocal(raw);
 const recalled=await store.action({type:'talk',target:n.id,message:'Do you remember my shuttle?'},result.player);assert.match(recalled.extra.response,/Roundabout/);
});
test('bulky species have broad closed crowns and ground masses within modest budgets',()=>{
 const widths=new Map();for(const i of [0,2,5,8,9]){const g=alienPlantGeometry(i),box=new T.Box3().setFromBufferAttribute(g.attributes.position);widths.set(i,box.max.x-box.min.x);assert.ok(g.attributes.position.count/3<=(PLANT_FAMILIES[i].canopy?300:64));}
 assert.ok(widths.get(2)>9);assert.ok(widths.get(5)>4);assert.ok(widths.get(8)>2);assert.ok(widths.get(9)>2);
});

test('the renderer streams freight runners separately and advances their actual actor positions',async()=>{
 const {WorldRenderer}=await import('../src/render.js');globalThis.document={createElement:()=>({style:{},remove(){}})};
 const s=settlement(0,0),world=Object.create(WorldRenderer.prototype);Object.assign(world,{player:{x:s.x,z:s.z},npcs:new Map(),npcLife:{},serverOffset:0,scene:new T.Scene(),labelContainer:{append(){}},cave:null});
 world.syncRoadPeople();assert.ok([...world.npcs.values()].some(n=>n.road));world.updateNpcs(.016);
 const n=[...world.npcs.values()][0];world.serverOffset+=10000;world.updateNpcs(.016);assert.deepEqual(n.object.position.toArray(),[n.x,n.y,n.z]);
 world.player={x:100000,z:100000};world.syncRoadPeople();assert.equal(world.npcs.size,0);
});
