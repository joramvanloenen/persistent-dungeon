import {locateNpc} from '../src/npc-life.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer,validateAction,npcReply} from '../src/rules.js';
import {normalizePlayer} from '../src/homes.js';
import {allPlanets,landingColony,planetAt,planetContains,canLaunch,PLANET_SPAN} from '../src/planets.js';
import {buildSurfaceCollisions,waterPathClear} from '../src/world-collision.js';
import {npcsFor,settlement,smithFor,resourcesFor} from '../src/world.js';
import {containsPowerball} from '../src/fringe-lore.js';
import {Store} from '../src/storage.js';
const starter=()=>createPlayer('drifter-test','Ada');
test('all nine planetary beacons land on open, dry ground inside a reachable colony',()=>{
 assert.equal(new Set(allPlanets().map(p=>p.id)).size,9);
 for(const planet of allPlanets()){const colony=landingColony(planet),point={x:colony.x+9,z:colony.z+15};assert.ok(planetContains(planet.id,point.x,point.z));assert.equal(planetAt(point.x,point.z).id,planet.id);assert.ok(!buildSurfaceCollisions([point]).blocked(point,point));assert.ok(waterPathClear(point,point));assert.ok(canLaunch({...starter(),...point}));}
});
test('transit uses one arrival voucher, then charges exactly the selected fare and keeps cargo, memories, home and facility progress',()=>{
 const p=starter();p.inventory.powerballs=2;p.caves['d:1:2']={entered:true,rooms:[0,1],gathered:['ore']};p.weapons=[{id:'old-tool',recipe:'sword',name:'Short sword',damage:18,reach:5.5}];p.equipped='old-tool';
 let q=validateAction(p,{type:'travel-planet',target:'planet:1:1'}).player;assert.equal(q.arrivalVoucher,0);assert.equal(q.coins,p.coins);assert.equal(q.inventory.powerballs,2);assert.equal(q.planet,'planet:1:1');assert.deepEqual(q.house,p.house);assert.deepEqual(q.caves,p.caves);assert.equal(q.weapons[0].id,'old-tool');assert.equal(q.weapons[0].name,'Arc blade');assert.equal(q.equipped,p.equipped);
 q=validateAction(q,{type:'travel-planet',target:'planet:-1:1',payment:'credits'}).player;assert.equal(q.coins,p.coins-4);assert.equal(q.inventory.powerballs,2);
 q=validateAction(q,{type:'travel-planet',target:p.planet,payment:'powerball'}).player;assert.equal(q.coins,p.coins-4);assert.equal(q.inventory.powerballs,1);assert.equal(q.visitedPlanets.length,3);assert.ok(q.landing.at);assert.equal(q.landing.planet,p.planet);
 const home=validateAction(q,{type:'return-home'}).player;assert.equal(home.x,p.house.doorX);assert.equal(home.z,p.house.doorZ);assert.deepEqual(home.visitedPlanets,q.visitedPlanets);
});
test('transit rejects invalid beacons, same planet, insufficient payment, caves, unfinished jobs and remote ground',()=>{
 const p=starter(),flight={type:'travel-planet',target:'planet:1:0'};
 assert.throws(()=>validateAction(p,{...flight,target:'planet:7:0'}),/beacon/);assert.throws(()=>validateAction(p,{...flight,target:p.planet}),/already/);
 assert.throws(()=>validateAction({...p,arrivalVoucher:0,coins:0},flight),/credits/);assert.throws(()=>validateAction({...p,arrivalVoucher:0}, {...flight,payment:'powerball'}),/credits/);assert.throws(()=>validateAction(p,{...flight,payment:'free'}),/Choose/);
 assert.throws(()=>validateAction({...p,dungeon:{id:'d:1:2',x:0,z:0}},flight),/colony/);assert.throws(()=>validateAction({...p,forge:{phase:'heat'}},flight),/fabrication/);
 let remote;for(let x=100;x<1500;x+=100){const candidate={...p,x,z:150};if(!canLaunch(candidate)){remote=candidate;break;}}assert.ok(remote);assert.throws(()=>validateAction(remote,flight),/colony/);
 const edge={...p,x:PLANET_SPAN/2-10,z:0};assert.throws(()=>validateAction(edge,{type:'move',x:edge.x+5,z:0}),/Book transit/);
});
test('old saves acquire planetary fields and rename legacy weapons without discarding existing progress',()=>{
 const p=starter();delete p.planet;delete p.arrivalVoucher;delete p.visitedPlanets;delete p.inventory.powerballs;const house=structuredClone(p.house),cargo=structuredClone(p.inventory);p.weapons=[{id:'saved',recipe:'axe',name:'Iron axe',damage:24,reach:4.8}];p.equipped='saved';p.coins=0;const q=normalizePlayer(p);assert.equal(q.arrivalVoucher,1);assert.equal(q.inventory.powerballs,0);assert.equal(q.coins,0);assert.deepEqual(q.house,house);for(const [key,value]of Object.entries(cargo))assert.equal(q.inventory[key],value);assert.equal(q.weapons[0].name,'Breacher axe');assert.equal(q.equipped,'saved');
});
test('a session return to the original pod cannot trap the player behind a remote paid fabrication job',()=>{
 const p=starter();p.forge={smith:'v:18:16:npc:3',recipe:'dagger',phase:'heat',startedAt:100000,step:0};const before=structuredClone(p.inventory),coins=p.coins;
 const q=validateAction(p,{type:'forge-abandon'}).player;assert.equal(q.forge,null);assert.deepEqual(q.inventory,before);assert.equal(q.coins,coins);assert.equal(validateAction(q,{type:'travel-planet',target:'planet:1:1'}).player.planet,'planet:1:1');assert.throws(()=>validateAction(q,{type:'forge-abandon'}),/no paid/);
});
test('Powerballs can be recovered, refined and traded only with validated resources and proximity',()=>{
 let node;for(let i=0;i<20&&!node;i++)node=resourcesFor(i,0).find(containsPowerball);assert.ok(node);let p={...starter(),x:node.x,z:node.z},q=validateAction(p,{type:'gather',target:node.id}).player;assert.equal(q.inventory.powerballs,1);assert.throws(()=>validateAction(q,{type:'gather',target:node.id},{depleted:true}),/already/);
 const smith=Array.from({length:20},(_,i)=>smithFor(settlement(i,0))).find(Boolean);q.x=smith.x;q.z=smith.z;const before=structuredClone(q);q=validateAction(q,{type:'refine-powerball',target:smith.id}).player;assert.equal(q.inventory.powerballs,2);assert.equal(q.inventory.stone,before.inventory.stone-2);assert.equal(q.inventory.iron,before.inventory.iron-1);
 const sold=validateAction(q,{type:'smith-sell',target:smith.id,kind:'powerballs'}).player;assert.equal(sold.inventory.powerballs,1);assert.equal(sold.coins,q.coins+12);assert.throws(()=>validateAction({...q,x:smith.x+100},{type:'refine-powerball',target:smith.id}),/closer/);assert.throws(()=>validateAction({...q,inventory:{...q.inventory,stone:0}},{type:'refine-powerball',target:smith.id}),/Refining/);
});
test('Drifters explain canon while recalling exact personal and other player information',()=>{
 const p=starter(),npc=locateNpc(npcsFor(settlement(0,0))[0].id),memory=[{playerId:p.id,message:'My ship is called Little Lantern.'},{playerId:'other',playerName:'Jo',message:'I hid a silver antenna under the recycler.'}];
 assert.match(npcReply(npc,p,'What do you know about the Freight Wars?',memory),/Dugall/);assert.match(npcReply(npc,p,'Who was Klem Earlie?',memory),/disbanded/);assert.match(npcReply(npc,p,'Tell me about the Feigngull Massacre',memory),/Maven/);assert.match(npcReply(npc,p,'Do you remember my ship?',memory),/My ship is called Little Lantern/);assert.match(npcReply(npc,p,'What do you know about my ship?',memory),/My ship is called Little Lantern/);assert.match(npcReply(npc,p,'What did Klem Earlie do?',memory),/disbanded/);assert.match(npcReply(npc,p,'Remember the silver antenna?',memory),/Jo spoke/);
});
test('planet travel, voucher use, NPC memory and discoveries survive local reload and return to the original pod',async()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 let store=new Store();await store.init();const npc=locateNpc(npcsFor(settlement(0,0))[0].id);store.local.player={...starter(),x:npc.x,z:npc.z};store.saveLocal();await store.action({type:'talk',target:npc.id,message:'My ship is called Little Lantern.'},store.local.player);await store.action({type:'travel-planet',target:'planet:1:-1'},store.local.player);
 store=new Store();await store.init();assert.equal(store.local.player.planet,'planet:1:-1');assert.equal(store.local.player.arrivalVoucher,0);assert.equal(store.local.memories[0].message,'My ship is called Little Lantern.');const visited=structuredClone(store.local.player.visitedPlanets);const result=await store.action({type:'return-home'},store.local.player);assert.equal(result.player.x,result.player.house.doorX);assert.deepEqual(result.player.visitedPlanets,visited);assert.equal(result.player.arrivalVoucher,0);
});
