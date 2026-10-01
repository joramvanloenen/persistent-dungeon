import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer,validateAction,npcReply} from '../src/rules.js';
import {settlement,smithFor,resolveNpc,resourcesFor} from '../src/world.js';
import {normalizePlayer} from '../src/homes.js';
import {forgeSpot,WEAPONS,guardiansFor,dummyFor} from '../src/action-game.js';
import {advanceMotion,beginJump} from '../src/action-motion.js';
import {generateDungeon} from '../src/dungeons.js';
import {Store} from '../src/storage.js';
const smith=Array.from({length:20},(_,i)=>smithFor(settlement(i-10,0))).find(Boolean);
const kit=()=>({...createPlayer('forger','Ada'),x:smith.x,z:smith.z,inventory:{wood:15,stone:5,berries:3,fiber:5,iron:15},coins:30});
test('old saves gain action fields without replacing supplies, memories, or homes; smith identities are stable',()=>{
 const p=createPlayer('legacy','Ada');delete p.coins;delete p.weapons;delete p.combat;delete p.inventory.iron;p.caves.old={rooms:[1]};const next=normalizePlayer(p);assert.equal(next.coins,24);assert.equal(next.inventory.iron,0);assert.equal(next.inventory.wood,p.inventory.wood);assert.deepEqual(next.caves,p.caves);assert.deepEqual(next.house,p.house);assert.deepEqual(resolveNpc(smith.id),smith);assert.match(npcReply(smith,next,'Remember my moonstone?', [{playerId:next.id,message:'My moonstone is under the oak.'}]),/moonstone is under the oak/);
});
test('forge charges once, enforces heat timing, ruins overheated billets, and grants exactly one persistent weapon',()=>{
 const start=100000,p=kit(),recipe=WEAPONS[0];let q=validateAction(p,{type:'forge-start',target:smith.id,recipe:recipe.id},{now:start}).player;
 assert.equal(q.coins,p.coins-recipe.fee);assert.equal(q.inventory.iron,p.inventory.iron-recipe.iron);assert.throws(()=>validateAction(q,{type:'forge-start',target:smith.id,recipe:recipe.id}),/current blank/);
 assert.throws(()=>validateAction(q,{type:'forge-transfer'},{now:start+5000}),/cold/);q=validateAction(q,{type:'forge-transfer'},{now:start+12000}).player;assert.equal(q.forge.phase,'failed');q=validateAction(q,{type:'forge-retry'},{now:start+13000}).player;assert.equal(q.coins,p.coins-recipe.fee);
 let now=start+20000;q=validateAction(q,{type:'forge-transfer'},{now}).player;assert.equal(q.forge.phase,'hammer');
 const wrong=(forgeSpot(q.forge)+1)%9;q=validateAction(q,{type:'forge-strike',step:0,spot:wrong},{now:now+100}).player;assert.equal(q.forge.step,0);assert.equal(q.forge.mistakes,1);
 for(let i=0;i<recipe.hits;i++){now+=500;q=validateAction(q,{type:'forge-strike',step:q.forge.step,spot:forgeSpot(q.forge)},{now}).player;}
 assert.equal(q.forge,null);assert.equal(q.weapons.length,1);assert.equal(q.equipped,q.weapons[0].id);assert.throws(()=>validateAction(q,{type:'forge-strike',step:9,spot:0},{now:now+10}),/Pay the fabricator/);assert.throws(()=>validateAction({...p,x:smith.x+100},{type:'forge-start',target:smith.id,recipe:'dagger'}),/closer/);assert.throws(()=>validateAction({...p,coins:0},{type:'forge-start',target:smith.id,recipe:'dagger'}),/fee/);
});
test('hammer deadlines and stale strikes are enforced; three misses require reheating',()=>{
 let p=validateAction(kit(),{type:'forge-start',target:smith.id,recipe:'sword'},{now:100000}).player;p=validateAction(p,{type:'forge-transfer'},{now:107000}).player;p=validateAction(p,{type:'forge-strike',step:0,spot:forgeSpot(p.forge)},{now:107100}).player;assert.throws(()=>validateAction(p,{type:'forge-strike',step:0,spot:1},{now:107200}),/earlier/);
 for(let i=0;i<3;i++){p=validateAction(p,{type:'forge-strike',step:p.forge.step,spot:forgeSpot(p.forge)},{now:p.forge.deadline+1}).player;}assert.equal(p.forge.phase,'failed');assert.throws(()=>validateAction(p,{type:'forge-strike',step:0,spot:0}),/earlier/);
});
test('armed attacks validate reach, facing, space, and cooldown, reward defeated sentinels once, and allow jump evasion',()=>{
 const d=generateDungeon(1,2),foe=guardiansFor(d)[0],p=kit();p.weapons=[{id:'blade',recipe:'sword',name:'Short sword',damage:18,reach:5.5}];p.equipped='blade';p.dungeon={id:d.id,x:foe.x,z:foe.z-2};p.caves[d.id]={rooms:[0]};
 assert.throws(()=>validateAction({...p,equipped:null},{type:'attack',target:foe.id,heading:0}),/Equip/);assert.throws(()=>validateAction(p,{type:'attack',target:foe.id,heading:Math.PI}),/Face/);assert.throws(()=>validateAction({...p,dungeon:{...p.dungeon,z:foe.z-20}},{type:'attack',target:foe.id,heading:0}),/closer/);
 let q=validateAction(p,{type:'jump'},{now:100000}).player;q=validateAction(q,{type:'attack',target:foe.id,heading:0},{now:100100}).player;assert.equal(q.health,p.health);assert.equal(q.combat[foe.id].health,18);assert.throws(()=>validateAction(q,{type:'attack',target:foe.id,heading:0},{now:100200}),/recover/);q=validateAction(q,{type:'attack',target:foe.id,heading:0},{now:101300}).player;assert.equal(q.combat[foe.id].health,0);assert.equal(q.coins,p.coins+6);assert.throws(()=>validateAction(q,{type:'attack',target:foe.id,heading:0},{now:102500}),/defeated/);
 const dummy=dummyFor(settlement(0,0));assert.throws(()=>validateAction(p,{type:'attack',target:dummy.id,heading:0}),/not here/);
});
test('running drains stamina, jumping lands without floating, and exhausted travelers cannot jump',()=>{
 const m={stamina:100};assert.ok(beginJump(m));assert.equal(m.stamina,80);assert.equal(beginJump(m),false);let max=0;for(let i=0;i<120;i++){const r=advanceMotion(m,1/60,{running:true,moving:true});max=Math.max(max,r.height);}assert.ok(max>1.5&&max<2);assert.equal(m.height,0);assert.equal(m.velocity,0);assert.ok(m.stamina<40);m.stamina=0;assert.equal(beginJump(m),false);assert.equal(advanceMotion(m,1/60,{running:true,moving:true}).running,false);
});
test('paid forge jobs, completed weapons, and equipment survive local reload without duplicate crafting',async()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};const original=Date.now;let now=100000;Date.now=()=>now;
 try{let store=new Store();await store.init();store.local.player=kit();store.saveLocal();let r=await store.action({type:'forge-start',target:smith.id,recipe:'dagger'},store.local.player);store=new Store();await store.init();assert.equal(store.local.player.forge.phase,'heat');now+=7000;r=await store.action({type:'forge-transfer'},store.local.player);for(let i=0;i<10;i++){now+=200;r=await store.action({type:'forge-strike',step:r.player.forge.step,spot:forgeSpot(r.player.forge)},r.player);}const reloaded=new Store();await reloaded.init();assert.equal(reloaded.local.player.weapons.length,1);assert.equal(reloaded.local.player.equipped,r.player.equipped);assert.equal(reloaded.local.player.forge,null);assert.equal(reloaded.local.events.filter(e=>e.data?.crafted).length,1);}
 finally{Date.now=original;}
});
