import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {avatar,WorldRenderer} from '../src/render.js';
import {buildDungeon,findCavePath} from '../src/dungeon-render.js';
import {generateDungeon,caveWalkable} from '../src/dungeons.js';
import {normalizePlayer} from '../src/homes.js';
import {CHUNK} from '../src/world.js';
test('character backpack is behind the forward-facing character',()=>{const character=avatar();assert.ok(character.getObjectByName('backpack').position.z<0);assert.equal(character.userData.legs.length,2);});
test('dungeon builds floors, cutaway walls, stairs, and a render object for every collectible',()=>{
 const d=generateDungeon(1,2),model=buildDungeon(d);assert.equal(model.nodes.size,d.nodes.length);assert.ok(model.group.children.length>30);assert.ok(model.rayFloor);assert.equal(model.exit.x,d.entrance.x);
 for(const node of d.nodes){const path=findCavePath(d,d.spawn,node);assert.ok(path?.length);for(const point of path)assert.ok(caveWalkable(d,point.x,point.z));}for(const item of model.disposable)item.dispose();
});
test('surface renderer creates dense instanced foliage and an individually owned cottage',()=>{
 globalThis.document={createElement:()=>({className:'',style:{},textContent:'',remove(){}})};
 // A fixed forest village makes this density check independent of random spawn selection.
 const p=normalizePlayer({id:'render-owner',name:'Ada',home:'v:0:0'});p.x=p.house.doorX;p.z=p.house.doorZ;
 const world=Object.create(WorldRenderer.prototype);Object.assign(world,{scene:new T.Scene(),temp:new T.Object3D(),homes:new Map(),ruins:new Map(),nodes:new Map(),chunks:new Map(),depleted:new Set(),labelContainer:{append(){}},player:p,cave:null});world.addHome(p.house);
 assert.equal(world.homes.size,1);const home=world.homes.get(p.house.id);assert.match(home.label.textContent,/Your home/);assert.ok(home.group.children.some(o=>o.userData.billboard));
 world.addChunk(Math.floor(p.x/CHUNK),Math.floor(p.z/CHUNK));const chunk=[...world.chunks.values()][0],instances=chunk.group.children.filter(o=>o.isInstancedMesh);assert.ok(instances.reduce((n,o)=>n+o.count,0)>350);
 for(const item of chunk.disposable)item.dispose();
});
