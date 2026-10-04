import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {salvageHut} from '../src/salvage-huts.js';
import {villageHouses,villageObstacles,homeObstacles} from '../src/scene-layout.js';
import {settlement} from '../src/world.js';
import {createPlayer} from '../src/rules.js';

test('colony houses use three distinct recovered craft hulls with usable old footprints',()=>{
 const s=settlement(0,0),houses=villageHouses(s),obstacles=villageObstacles(s);
 assert.equal(houses.length,7);
 assert.equal(new Set(houses.map((h,i)=>salvageHut(h.width,h.depth,i).userData.hullType)).size,3);
 for(const [i,h] of houses.entries()){
  const model=salvageHut(h.width,h.depth,i),names=new Set(model.children.map(m=>m.name));
  assert.ok(model.children.some(m=>m.name.includes('booster')||m.name.includes('capsule')));
  for(const item of ['recovered pressure hatch','external electronics cabinet','working circuit board','salvaged solar array','exposed power umbilical','communications antenna'])assert.ok(names.has(item),`${model.userData.hullType}: ${item}`);
  assert.ok(!names.has('podHull')&&!names.has('habitatFrame'));
  assert.ok(model.userData.detailMeshes.length>15);
  assert.ok(model.userData.detailMeshes.length<model.children.length-8);
  assert.equal(obstacles.find(o=>o.id===h.id)?.width,h.width);
  const vestibule=model.children.find(m=>m.name==='welded pressure-lock vestibule');
  assert.ok(vestibule.position.z+vestibule.scale.z/2<=h.depth/2+.1);
  const body=model.children.find(m=>/booster hull|booster tank|cargo capsule/.test(m.name));
  assert.ok(body.geometry instanceof T.CylinderGeometry);
  const cabinet=model.children.find(m=>m.name==='external electronics cabinet');
  assert.ok(Math.abs(cabinet.position.x)+cabinet.scale.x/2<h.width/2);
 }
});
test('the owned pod has a separate spent booster and keeps the saved home collider',()=>{
 const p=createPlayer('salvage-owner','Ada'),model=salvageHut(9,8,0,true),names=model.children.map(m=>m.name);
 assert.equal(model.userData.hullType,'freighter-booster');assert.ok(names.includes('auxiliary spent booster'));
 assert.equal(homeObstacles(p.house)[0].id,p.house.id);assert.equal(homeObstacles(p.house)[0].width,9);
 assert.ok(names.includes('recovered boarding ramp'));
});
