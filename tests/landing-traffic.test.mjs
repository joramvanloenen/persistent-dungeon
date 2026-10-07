import test from 'node:test';import assert from 'node:assert/strict';
import {settlement} from '../src/world.js';
import {shipVisitor,landingBay,parkedShipObstacles,resolvePortPerson} from '../src/landing-port.js';
import {npcAt,locateNpc,portShipAt,advanceNpcLife,meetNpc,WORLD_EPOCH,peopleNear} from '../src/npc-life.js';
import {villageObstacles} from '../src/scene-layout.js';
import {hitsObstacle} from '../src/world-collision.js';
import {buildSkiff,buildLandingBay,updateSkiff} from '../src/port-render.js';
import {Store} from '../src/storage.js';
import {validateAction,createPlayer,npcReply} from '../src/rules.js';
import {WorldRenderer} from '../src/render.js';import * as T from '../vendor/three.module.js';

function phaseTime(n,phase,extra=()=>true){for(let t=0;t<2400000;t+=1000){const at=npcAt(n,WORLD_EPOCH+t);if(at.phase===phase&&extra(at))return WORLD_EPOCH+t;}throw Error(`missing ${phase}`);}
test('a persistent pilot completes all objectives, short stays, boarding and flight with one owned ship',()=>{
 for(const [rx,rz]of [[0,0],[1,-2],[-3,4]]){const s=settlement(rx,rz),n=shipVisitor(s),objectives=new Set(),phases=new Set(),stays=new Set(),obstacles=[...villageObstacles(s),...parkedShipObstacles({...landingBay(s),id:n.shipId,parked:true})];let previous;
 for(let t=0;t<2400;t+=.5){const now=WORLD_EPOCH+t*1000,at=npcAt(n,now),ship=portShipAt(s,now),available=at.available;phases.add(at.phase);objectives.add(at.objective);stays.add(at.stay);assert.equal(ship.pilot,n.id);assert.equal(ship.id,n.shipId);assert.equal(ship.visit,at.visit);
 if(available){assert.ok(ship.parked,'pilot cannot walk while their ship is flying');assert.ok(!obstacles.some(o=>hitsObstacle(at,at,o,.5)),`${s.id} ${at.phase} in obstacle`);if(previous?.available)assert.ok(!obstacles.some(o=>hitsObstacle(previous,at,o,.5)),'visitor crossed a solid object');assert.deepEqual(locateNpc(n.id,now),at);}else assert.equal(locateNpc(n.id,now),null);
 if(previous?.available&&available)assert.ok(Math.hypot(at.x-previous.x,at.z-previous.z)<=.726,'continuous walking');previous=at;
 }assert.equal(objectives.size,3);assert.deepEqual(stays,new Set([true,false]));for(const phase of ['landing','disembarking','objective','lodging','boarding','takeoff','away'])assert.ok(phases.has(phase));}
 assert.equal(resolvePortPerson('v:999999:0:pilot'),null);
});
test('talking holds the pilot AND ship, then both resume without resetting the visit',()=>{
 const s=settlement(0,0),n=shipVisitor(s),now=phaseTime(n,'returning'),original=npcAt(n,now),life=meetNpc(n,advanceNpcLife(n,{},now),now),saved=JSON.parse(JSON.stringify(life));
 for(const elapsed of [1,40000,110000]){const at=npcAt(n,now+elapsed,saved),ship=portShipAt(s,now+elapsed,{[n.id]:saved});assert.equal(at.x,original.x);assert.equal(at.visit,original.visit);assert.ok(ship.parked);assert.equal(ship.phase,original.phase);}
 assert.ok(Math.hypot(npcAt(n,now+120001,saved).x-original.x,npcAt(n,now+120001,saved).z-original.z)<.002);
});
test('completed visits and observed actions are remembered through browser reload; pilots recall spoken details',async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};const realNow=Date.now,n=shipVisitor(settlement(0,0)),now=phaseTime(n,'finished',a=>a.objective==='supplies');Date.now=()=>now;
 try{let store=new Store();await store.init();const at=npcAt(n,now);Object.assign(store.local.player,{x:at.x,z:at.z,dungeon:null});store.saveLocal();store.local.npcLife[n.id]=advanceNpcLife(n,{},now-180000);store.local.npcLife[n.id]=advanceNpcLife(n,store.local.npcLife[n.id],now);
 assert.ok(store.local.npcLife[n.id].observations.some(o=>/bought nutrient/.test(o.summary)));assert.equal(store.local.npcLife[n.id].visit.cargo.nutrientPods,3);await store.request('memory',{npc:n.id});await store.action({type:'talk',target:n.id,message:'My ship is called Blue Lantern.'},store.local.player);const raw=store.exportLocal();store=new Store();await store.init();assert.equal(store.local.npcLife[n.id].visit.objective,'supplies');store.importLocal(raw);
 const reply=await store.action({type:'talk',target:n.id,message:'Remember my ship?'},store.local.player);assert.match(reply.extra.response,/Blue Lantern/);assert.ok(store.local.npcLife[n.id].observations.some(o=>o.kind==='witness'));
 }finally{Date.now=realNow;}
});
test('visits never reset on unload, offline catchup deduplicates completed checkpoints, hidden pilots cannot talk',()=>{
 const s=settlement(0,0),n=shipVisitor(s),now=phaseTime(n,'away');let life=advanceNpcLife(n,{},now-1600000);life=advanceNpcLife(n,life,now);const reloaded=JSON.parse(JSON.stringify(life));assert.deepEqual(npcAt(n,now+170000,reloaded),npcAt(n,now+170000,life));assert.equal(advanceNpcLife(n,life,now).observations.length,life.observations.length);
 assert.ok(life.observations.some(o=>/departed/.test(o.summary)));assert.ok(life.observations.some(o=>/rented a crew pod/.test(o.summary)));const p={...createPlayer('pilot-observer','Ada'),x:n.x,z:n.z};assert.throws(()=>validateAction(p,{type:'talk',target:n.id,message:'Hello'},{now,npcLife:{[n.id]:life}}),/does not exist/);
 const meetingTime=phaseTime(n,'objective',a=>a.objective==='meeting'),people=peopleNear(s,meetingTime,{},60),broker=people.find(a=>a.broker),pilot=people.find(a=>a.visitor);assert.ok(Math.hypot(broker.x-pilot.x,broker.z-pilot.z)<2);assert.match(broker.activity,/exchanging road reports/);assert.match(npcReply(pilot,p,'Why are you here?',[],[]),/road reports/);
});
test('actual renderer animates ships and only offers pilots who are outside; models remain inexpensive',()=>{
 globalThis.document={createElement:()=>({style:{},remove(){}})};const s=settlement(0,0),n=shipVisitor(s),world=Object.create(WorldRenderer.prototype);Object.assign(world,{scene:new T.Scene(),villages:new Map(),npcs:new Map(),ruins:new Map(),nodes:new Map(),labelContainer:{append(){}},player:null,cave:null,npcLife:{},opponents:new Map()});world.addVillage(s);const v=world.villages.get(s.id);assert.ok(v.ship);let triangles=0;v.ship.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});assert.ok(triangles<900);
 for(const phase of ['landing','walking','lodging','takeoff','away']){const now=phaseTime(n,phase);world.serverOffset=now-Date.now();world.updateNpcs(0);const at=npcAt(n,now),ship=portShipAt(s,now);assert.equal(world.npcs.get(n.id).object.visible,at.available);assert.equal(v.ship.visible,ship.visible);assert.ok(Math.abs(v.ship.position.y-ship.y)<.02);world.player={x:at.x,z:at.z};if(!at.available)assert.notEqual(world.closest()?.id,n.id);}
 const g=buildSkiff(),bay=buildLandingBay(s);assert.ok(bay.children.length>10);updateSkiff(g,{...portShipAt(s,phaseTime(n,'walking')),hatchOpen:true});assert.ok(g.userData.ramp.visible);assert.ok(!g.userData.hatch.visible);
});
