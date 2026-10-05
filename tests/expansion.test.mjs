import {locateNpc} from '../src/npc-life.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,validateAction,npcGreeting} from '../src/rules.js';
import {normalizePlayer,homeFor} from '../src/homes.js';
import {generateDungeon,caveWalkable,caveStatus,TILE,resolveCaveResource} from '../src/dungeons.js';
import {Store} from '../src/storage.js';
import {settlement,npcsFor} from '../src/world.js';
test('each home plot is stable, distinct, dry, and new players spawn at their doorstep',()=>{
 const p=createPlayer('a','Ada'),h=homeFor(p,0);assert.equal(p.x,h.doorX);assert.equal(p.z,h.doorZ);assert.deepEqual(homeFor(p,0),h);
 const plots=Array.from({length:25},(_,i)=>homeFor(p,i));assert.equal(new Set(plots.map(h=>`${h.x}:${h.z}`)).size,25);
 const old={...p};delete old.house;delete old.caves;delete old.dungeon;old.x+=100;old.inventory.wood=42;const migrated=normalizePlayer(old);assert.equal(migrated.inventory.wood,42);assert.equal(migrated.x,old.x);assert.equal(migrated.house.owner,p.id);
 const returned=validateAction({...migrated,dungeon:{id:'d:0:0',x:10,z:10}},{type:'return-home'}).player;assert.equal(returned.x,returned.house.doorX);assert.equal(returned.dungeon,null);
});
test('procedural dungeon rooms and all resource deposits are reachable and stable',()=>{
 for(const [rx,rz]of [[0,0],[-2,3],[4,-5],[12,12]]){const d=generateDungeon(rx,rz),source=Math.floor(d.spawn.z/TILE)*d.width+Math.floor(d.spawn.x/TILE),seen=new Set([source]),queue=[source];
 for(let i=0;i<queue.length;i++){const at=queue[i],x=at%d.width,z=Math.floor(at/d.width);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=nz*d.width+nx;if(nx<0||nz<0||nx>=d.width||nz>=d.height||!d.cells[k]||seen.has(k))continue;seen.add(k);queue.push(k);}}
 assert.ok(d.rooms.length>=9);for(const r of d.rooms)assert.ok(seen.has(r.cz*d.width+r.cx));for(const r of d.nodes){assert.ok(caveWalkable(d,r.x,r.z));assert.ok(seen.has(Math.floor(r.z/TILE)*d.width+Math.floor(r.x/TILE)));assert.equal(resolveCaveResource(r.id).id,r.id);}assert.deepEqual(generateDungeon(rx,rz).cells,d.cells);
 }
});
test('dungeon entry, walls, resources, exits, and completion have independent persistent state',()=>{
 const d=generateDungeon(0,0);let p={...createPlayer('caver'),x:d.x,z:d.z};
 assert.throws(()=>validateAction({...p,x:d.x+100},{type:'enter-dungeon',target:d.id}),/closer/);
 p=validateAction(p,{type:'enter-dungeon',target:d.id}).player;assert.equal(p.dungeon.id,d.id);assert.deepEqual(p.caves[d.id].rooms,[0]);
 assert.throws(()=>validateAction(p,{type:'move',space:d.id,x:1,z:1}),/wall/);
 const r=d.nodes[0];p.dungeon.x=r.x;p.dungeon.z=r.z;const gathered=validateAction(p,{type:'gather',target:r.id});assert.equal(gathered.extra.space,d.id);assert.equal(gathered.player.inventory[r.kind],p.inventory[r.kind]+r.count);
 assert.throws(()=>validateAction(p,{type:'gather',target:r.id},{depleted:true}),/already/);
 const visited=caveStatus(d.id,gathered.player,new Set([r.id]));assert.equal(visited.entered,true);assert.equal(visited.explored,false);assert.equal(visited.cleared,false);
 gathered.player.caves[d.id].rooms=d.rooms.map(r=>r.id);const cleared=caveStatus(d.id,gathered.player,new Set(d.nodes.map(r=>r.id)));assert.equal(cleared.explored,true);assert.equal(cleared.cleared,true);
 gathered.player.dungeon.x=d.entrance.x;gathered.player.dungeon.z=d.entrance.z;const left=validateAction(gathered.player,{type:'leave-dungeon'}).player;assert.equal(left.dungeon,null);assert.equal(left.caves[d.id].gathered.length,1);
});
test('save migration keeps NPC history and cave state; journal is paginated separately',async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};const player=createPlayer('history-player','Ada');delete player.house;delete player.caves;const npc=npcsFor(settlement(0,0))[0];
 const memories=Array.from({length:230},(_,i)=>({id:String(i),npc:npc.id,playerId:player.id,playerName:'Ada',message:'Historic fact '+i,response:'Remembered '+i,createdAt:i}));
 data.set('evermere-local-v1',JSON.stringify({player,nodes:{},memories,events:[]}));const store=new Store();await store.init();assert.equal(store.local.memories.length,230);assert.equal(store.local.player.house.owner,player.id);
 const position=locateNpc(npc.id);store.local.player.x=position.x;store.local.player.z=position.z;store.saveLocal();const first=await store.request('memory',{npc:npc.id,personal:true});assert.equal(first.memories.length,200);assert.equal(first.hasMore,true);const old=await store.request('memory',{npc:npc.id,personal:true,offset:200});assert.equal(old.memories.length,30);assert.equal(old.hasMore,false);
 assert.doesNotMatch(npcGreeting(npc,player,true),/Historic fact/);
});
