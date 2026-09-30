import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {CollisionIndex,hitsObstacle,moveWithCollisions,findSurfacePath,buildSurfaceCollisions,appendMovementTrail} from '../src/world-collision.js';
import {villageHouses,homeObstacles,villageObstacles,ruinObstacles,resourceObstacle,foliageFor,box,circle,caveObstacles} from '../src/scene-layout.js';
import {createBillboardBatch,createBillboardMaterial,billboardRight,TREE_IMAGES} from '../src/foliage-billboards.js';
import {WorldRenderer,avatar} from '../src/render.js';
import {createPlayer,validateAction} from '../src/rules.js';
import {normalizePlayer,homeFor} from '../src/homes.js';
import {settlement,CHUNK,resourcesFor} from '../src/world.js';
import {generateDungeon,ruinFor} from '../src/dungeons.js';

test('rotated house footprints, thin fences and round trunks stop swept running without trapping doorsteps',()=>{
 for(const [rx,rz]of [[0,0],[-2,3],[4,-5]]){const s=settlement(rx,rz);for(const h of villageHouses(s)){const c=Math.cos(h.rotation),sn=Math.sin(h.rotation),a={x:h.x-sn*(h.depth/2+3),z:h.z-c*(h.depth/2+3)},b={x:h.x+sn*(h.depth/2+3),z:h.z+c*(h.depth/2+3)},o=villageObstacles(s).find(o=>o.id===h.id);assert.ok(hitsObstacle(a,b,o));const index=new CollisionIndex();index.replace(h.id,[o]);const moved=moveWithCollisions(a,b.x-a.x,b.z-a.z,(a,b)=>!index.blocked(a,b));assert.ok(Math.hypot(moved.x-b.x,moved.z-b.z)>h.depth/2);assert.equal(index.blocked(moved),null);}}
 const index=new CollisionIndex();index.replace('fence',[box('thin',0,0,.2,15)]);const p=moveWithCollisions({x:-4,z:-3},10,5,(a,b)=>!index.blocked(a,b));assert.ok(p.x<-.7);assert.ok(p.z>1);assert.equal(index.blocked(p),null);index.remove('fence');assert.equal(index.blocked({x:-4,z:0},{x:4,z:0}),null);
 index.replace('trunk',[circle('tree',0,0,.45)]);assert.ok(index.blocked({x:-4,z:0},{x:4,z:0}));assert.equal(index.blocked({x:-4,z:2},{x:4,z:2}),null);
 const player=normalizePlayer({id:'door-test',home:'v:0:0',name:'Ada'});for(let plot=0;plot<40;plot++){const h=homeFor(player,plot),index=new CollisionIndex();index.replace(h.id,homeObstacles(h));assert.equal(index.blocked({x:h.doorX,z:h.doorZ}),null);assert.ok(index.blocked(h));}
});
test('tap routes bend around solid houses and every segment remains collision safe when compressed for saving',()=>{
 const index=new CollisionIndex();index.replace('village',[box('house',0,0,10,8,.45),box('fence',8,1,.2,10),circle('tree',-8,-4,.45)]);const start={x:-16,z:0},end={x:18,z:0},clear=(a,b)=>!index.blocked(a,b),path=findSurfacePath(start,end,clear);assert.ok(path.length>1);const trail=[];let p=start;
 for(const q of path){while(Math.hypot(q.x-p.x,q.z-p.z)>.01){const d=Math.hypot(q.x-p.x,q.z-p.z),step=Math.min(.99,d),moved=moveWithCollisions(p,(q.x-p.x)/d*step,(q.z-p.z)/d*step,clear);assert.ok(Math.hypot(moved.x-p.x,moved.z-p.z)>0);appendMovementTrail(trail,start,moved.trail);p={x:moved.x,z:moved.z};}}
 assert.ok(trail.length<80);for(const [i,q]of trail.entries())assert.ok(clear(i?trail[i-1]:start,q));assert.ok(Math.hypot(p.x-end.x,p.z-end.z)<.01);
 const frozen=[{x:1,z:0}];appendMovementTrail(frozen,{x:0,z:0},[{x:2,z:0},{x:3,z:0}],1);assert.deepEqual(frozen,[{x:1,z:0},{x:3,z:0}]);
});
test('authoritative movement rejects crossing a cottage even when the destination is open; detours persist',()=>{
 let p=normalizePlayer({...createPlayer('collision-save','Ada'),home:'v:0:0'}),h=p.house;p.x=h.doorX;p.z=h.doorZ;const end={x:h.x-Math.sin(h.rotation)*9,z:h.z-Math.cos(h.rotation)*9},index=buildSurfaceCollisions([p,end],{homes:[h]}),clear=(a,b)=>!index.blocked(a,b),path=findSurfacePath(p,end,clear);assert.ok(path?.length>1);
 assert.throws(()=>validateAction(p,{type:'move',...end}),/solid obstacle/);const result=validateAction(p,{type:'move',...end,trail:path.slice(0,-1)},{now:p.updatedAt+10000});assert.ok(result.player.distance>18);assert.equal(result.player.x,end.x);assert.deepEqual(result.player.house,h);
 // A neighbor's cottage participates in the same shared validation.
 const other=homeFor({...p,id:'neighbor'},1),n={...p,x:other.doorX,z:other.doorZ},across={x:other.x-Math.sin(other.rotation)*9,z:other.z-Math.cos(other.rotation)*9};assert.throws(()=>validateAction(n,{type:'move',...across},{homes:[h,other]}),/solid obstacle/);
});
function fixture(){globalThis.document={createElement:()=>({style:{},remove(){},textContent:''}),querySelector:()=>null};const p=normalizePlayer({...createPlayer('trees-test','Ada'),home:'v:0:0'}),world=Object.create(WorldRenderer.prototype);Object.assign(world,{scene:new T.Scene(),temp:new T.Object3D(),homes:new Map(),ruins:new Map(),nodes:new Map(),chunks:new Map(),depleted:new Set(),labelContainer:{append(){}},player:p,cave:null});world.addHome(p.house);world.addChunk(Math.floor(p.house.x/CHUNK),Math.floor(p.house.z/CHUNK));return world;}
test('collectible and decorative foliage use billboards; depleted tree/rock blockers disappear and chunk removal releases memory',()=>{
 const world=fixture(),chunk=[...world.chunks.values()][0],tree=[...world.nodes.values()].find(n=>n.kind==='wood'&&!n.occupied),rock=[...world.nodes.values()].find(n=>n.kind==='stone'&&!n.occupied);assert.ok(tree&&rock);assert.ok(tree.instances[0][0].userData.billboard);assert.ok(chunk.decorBatches.length>=6);assert.ok(chunk.group.children.filter(o=>o.isInstancedMesh).every(o=>o.userData.billboard));
 assert.ok(world.collision.blocked(tree));assert.ok(world.collision.blocked(rock));world.setDepleted([tree.id,rock.id]);assert.ok(!world.collision.candidates(tree,tree).has(resourceObstacle(tree)));const treeShape=[...world.collision.candidates(tree,tree)].find(o=>o.id===tree.id);assert.equal(treeShape,undefined);assert.equal([...world.collision.candidates(rock,rock)].find(o=>o.id===rock.id),undefined);
 const matrix=new T.Matrix4();tree.instances[0][0].getMatrixAt(tree.instances[0][1],matrix);assert.equal(matrix.elements[0],0);world.setDepleted([]);tree.instances[0][0].getMatrixAt(tree.instances[0][1],matrix);assert.ok(matrix.elements[0]>0);world.collision.remove(`chunk:${chunk.cx}:${chunk.cz}`);assert.equal(world.collision.groups.has(`chunk:${chunk.cx}:${chunk.cz}`),false);
 // A newly allocated home clears both sprites and collision inside its plot.
 const neighbor=homeFor({...world.player,id:'neighbor'},1);world.setHomes([world.player.house,neighbor]);for(const n of world.nodes.values())if(Math.hypot(n.x-neighbor.x,n.z-neighbor.z)<12){assert.equal(n.occupied,true);assert.equal([...world.collision.candidates(n,n)].find(o=>o.id===n.id),undefined);}
 for(const d of chunk.disposable)d.dispose();
});
test('painted tree billboards preserve source alpha, face the camera horizontally, and never pitch or move their roots',()=>{
 const center={x:22,y:17,z:-8};for(let yaw=0;yaw<Math.PI*2;yaw+=.17)for(const height of [1,80,1000]){const camera={x:center.x+Math.sin(yaw)*100,y:height,z:center.z+Math.cos(yaw)*100},right=billboardRight(camera,center);assert.equal(right.y,0);assert.ok(Math.abs(Math.hypot(right.x,right.z)-1)<1e-9);assert.ok(Math.abs(right.x*(camera.x-center.x)+right.z*(camera.z-center.z))<1e-8);}
 const material=createBillboardMaterial(new T.Texture()),shader={vertexShader:T.ShaderLib.basic.vertexShader};material.onBeforeCompile(shader);assert.match(shader.vertexShader,/instanceMatrix \* billboardCenter/);assert.match(shader.vertexShader,/cameraPosition.xz/);assert.match(shader.vertexShader,/modelMatrix\[2\]/);assert.equal(material.alphaTest,.38);assert.equal(material.transparent,false);assert.equal(material.side,T.DoubleSide);assert.equal(material.toneMapped,false);
 const {batch}=createBillboardBatch(material,[{x:22,y:17,z:-8,width:10,height:12}]),m=new T.Matrix4();batch.getMatrixAt(0,m);const root=new T.Vector3(0,0,0).applyMatrix4(m);assert.ok(Math.abs(root.y-16.96)<.00001);assert.equal(root.x,22);assert.equal(root.z,-8);assert.equal(m.elements[5],12);assert.equal(m.elements[0],m.elements[10]);assert.equal(batch.geometry.attributes.position.count,4);
 for(const name of ['tree-broad.png','tree-tall.png']){const png=readFileSync(new URL('../assets/foliage/'+name,import.meta.url));assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);assert.equal(png[25],6);}assert.ok(TREE_IMAGES.every(path=>path.endsWith('.png')));
});
test('dungeon props block their rendered footprints while entry stairs stay reachable',()=>{
 for(let rx=-4;rx<=4;rx++)for(let rz=-4;rz<=4;rz++){const r=ruinFor(rx,rz),index=new CollisionIndex();index.replace(r.id,ruinObstacles(r));assert.equal(index.blocked({x:r.x,z:r.z+9}),null,'returning from a dungeon must not put the player inside rubble');}
 for(const [rx,rz]of [[0,0],[1,2],[-2,3]]){const d=generateDungeon(rx,rz),index=new CollisionIndex();index.replace(d.id,caveObstacles(d));assert.equal(index.blocked(d.spawn),null);const room=d.rooms[1],pillar=caveObstacles(d).find(o=>o.id===`${d.id}:pillar:${room.id}`);assert.ok(index.blocked(pillar));const node=d.nodes.find(n=>n.kind==='wood');if(node){assert.ok(index.blocked(node));index.replace(d.id,caveObstacles(d,new Set([node.id])));assert.equal([...index.candidates(node,node)].find(o=>o.id===node.id),undefined);}}
});
