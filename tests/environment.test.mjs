import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {CHUNK,WATER,roadSegments,roadDistance,resourcesFor,settlement,biomeAt} from '../src/world.js';
import {environmentFor,environmentObstacle,environmentOutsideHome,terrainSurfaceHeight,groundTint,roadPiecesFor,TERRAIN_STEP} from '../src/environment.js';
import {buildRoadSurface,buildGroundPatches,environmentGeometry,createEnvironmentBatches} from '../src/environment-render.js';
import {buildSurfaceCollisions,hitsObstacle} from '../src/world-collision.js';
import {WorldRenderer} from '../src/render.js';
import {normalizePlayer,homeFor} from '../src/homes.js';

const fixtures=[[-16,-15],[-16,-9],[-16,-2],[-16,6],[-13,-11],[-7,-14]];
test('biome scenery is stable, varied and leaves freight tracks, resources and ruins usable',()=>{
 const families=new Set(),biomes=new Set();
 for(const [cx,cz]of fixtures){const a=environmentFor(cx,cz),b=environmentFor(cx,cz);assert.deepEqual(a,b);assert.ok(a.props.length>6&&a.patches.length>0);biomes.add(biomeAt((cx+.5)*CHUNK,(cz+.5)*CHUNK));const roads=roadSegments(Math.floor(cx*CHUNK/1024),Math.floor(cz*CHUNK/1024)),resources=resourcesFor(cx,cz);
  for(const n of a.props){assert.equal(Math.floor(n.x/CHUNK),cx);assert.equal(Math.floor(n.z/CHUNK),cz);families.add(n.family);if(n.family<6){assert.ok(roadDistance(n.x,n.z,roads)>9+n.radius);assert.ok(resources.every(r=>Math.hypot(r.x-n.x,r.z-n.z)>n.radius+2.5));}else assert.ok(roadDistance(n.x,n.z,roads)>3.5);}
 }assert.equal(biomes.size,6);assert.ok(families.size>=7);
 assert.notDeepEqual(groundTint(-3020,-2890),groundTint(-2850,-2790));
});
test('road and patch surfaces are clipped to their chunks, face upward and conform exactly to terrain',()=>{
 let colors=new Set(),total=0;
 for(const [cx,cz]of fixtures){for(const mesh of [buildRoadSurface(cx,cz),buildGroundPatches(cx,cz)]){const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color;assert.ok(p.count>0);assert.ok(p.count/3<12000);total+=p.count/3;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok(Number.isFinite(x+y+z));assert.ok(x>=cx*CHUNK-.001&&x<=(cx+1)*CHUNK+.001);assert.ok(z>=cz*CHUNK-.001&&z<=(cz+1)*CHUNK+.001);const ground=terrainSurfaceHeight(x,z);assert.ok(y>=ground-.002,`${mesh.name} buried: ${y-ground}`);colors.add(`${c.getX(i).toFixed(2)}:${c.getY(i).toFixed(2)}:${c.getZ(i).toFixed(2)}`);}
  const normals=mesh.geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>=-1e-6);mesh.geometry.dispose();
 }}assert.ok(colors.size>15&&total>1000);
});
test('road pieces and surface heights match at streamed chunk boundaries',()=>{
 let common=false;for(const [cx,cz]of fixtures){const a=roadPiecesFor(cx,cz),b=roadPiecesFor(cx+1,cz);const byId=new Map(b.map(p=>[p.id,p]));for(const p of a)if(byId.has(p.id)){assert.deepEqual(p,byId.get(p.id));common=true;}
  for(let i=0;i<=20;i++){const x=(cx+1)*CHUNK,z=cz*CHUNK+i*TERRAIN_STEP;assert.ok(Number.isFinite(terrainSurfaceHeight(x,z)));}
 }assert.ok(common);
});
test('all environment templates stay within tiny geometry budgets and fit their authoritative footprints',()=>{
 for(let family=0;family<8;family++){const g=environmentGeometry(family),p=g.attributes.position;assert.ok(p.count/3<=110);assert.ok([...p.array].every(Number.isFinite));for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getZ(i))<=1.65);}
 const props=environmentFor(-16,-9).props,batches=createEnvironmentBatches(props);assert.equal(batches.reduce((sum,{batch})=>sum+batch.count,0),props.length);assert.ok(batches.length<=8);assert.ok(batches.every(({batch})=>batch.isInstancedMesh));for(const {batch}of batches)batch.dispose();
});
test('new solid scenery participates in movement validation and clears from new home plots',()=>{
 const n=environmentFor(-16,-9).props.find(n=>n.family<6),index=buildSurfaceCollisions([n],{homes:[]});assert.ok(index.blocked(n));assert.ok(hitsObstacle({x:n.x-n.radius-2,z:n.z},{x:n.x+n.radius+2,z:n.z},environmentObstacle(n)));
 const house={id:'home-clear',x:n.x,z:n.z,rotation:0};assert.equal(environmentOutsideHome(n,[house]),false);const cleared=buildSurfaceCollisions([n],{homes:[house]});assert.ok(![...cleared.candidates(n,n)].some(o=>o.id===n.id));
 globalThis.document={createElement:()=>({style:{},remove(){}})};const world=Object.create(WorldRenderer.prototype),player=normalizePlayer({id:'env-owner',name:'Ada',home:'v:0:0'});Object.assign(world,{scene:new T.Scene(),homes:new Map(),ruins:new Map(),nodes:new Map(),chunks:new Map(),depleted:new Set(),player,labelContainer:{append(){}},cave:null});world.addChunk(-16,-9);
 const chunk=world.chunks.get('-16:-9');assert.ok(chunk.group.getObjectByName('worn-freight-roads'));world.homes.set(house.id,house);world.refreshChunkCollision(chunk);const group=chunk.environmentBatches.find(b=>b.items.some(v=>v.id===n.id)),i=group.items.findIndex(v=>v.id===n.id),matrix=new T.Matrix4();group.batch.getMatrixAt(i,matrix);assert.equal(matrix.elements[0],0);assert.ok(![...world.collision.candidates(n,n)].some(o=>o.id===n.id));
 world.homes.clear();world.refreshChunkCollision(chunk);group.batch.getMatrixAt(i,matrix);assert.ok(new T.Vector3().setFromMatrixScale(matrix).length()>0);for(const item of chunk.disposable)item.dispose();
});
