import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {WorldRenderer,avatar} from '../src/render.js';
import {CAMERA_LIMITS} from '../src/camera-controls.js';
import {generateDungeon,TILE} from '../src/dungeons.js';
import {createPlayer} from '../src/rules.js';
import {drawMiniMap,drawCaveMap} from '../src/map.js';

function label(){return {style:{},textContent:'',append(){},replaceChildren(){},setAttribute(){},remove(){}};}
function rendererFixture(){
 globalThis.document={createElement:()=>label()};
 const world=Object.create(WorldRenderer.prototype),scene=new T.Scene();scene.background=new T.Color(0x9aada0);scene.fog=new T.Fog(0x9aada0,440,950);
 Object.assign(world,{scene,hemi:new T.HemisphereLight(),sun:new T.DirectionalLight(),lantern:new T.PointLight(),hero:avatar(),camera:new T.PerspectiveCamera(40,1,.3,1500),cameraFocus:new T.Vector3(),projectedLabel:new T.Vector3(),cameraOrbit:{yaw:.15,pitch:.73},pitch:.73,yaw:.15,zoom:1,player:null,cave:null,caveModel:null,homes:new Map(),nodes:new Map(),chunks:new Map(),villages:new Map(),npcs:new Map(),ruins:new Map(),others:new Map(),depleted:new Set(),labelContainer:{children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;}},container:{clientWidth:1280,clientHeight:720},stream(){}});
 scene.add(world.hero,world.sun,world.hemi,world.lantern);return world;
}
test('entering a dungeon completes scene setup, uses cave coordinates, and retains depleted resources',()=>{
 const world=rendererFixture(),p=createPlayer('dungeon-render-transition','Ada'),d=generateDungeon(1,2);world.setPlayer(p);world.depleted.add(d.nodes[0].id);
 const underground={...p,dungeon:{id:d.id,...d.spawn},caves:{[d.id]:{entered:true,rooms:[0],gathered:[d.nodes[0].id]}}};
 assert.doesNotThrow(()=>world.setPlayer(underground));assert.equal(world.player.x,d.spawn.x);assert.equal(world.player.z,d.spawn.z);assert.equal(world.hero.position.y,0);assert.equal(world.terrain[0],world.caveModel.rayFloor);
 assert.equal(world.caveModel.nodes.get(d.nodes[0].id).object.visible,false);assert.equal(world.caveModel.nodes.get(d.nodes[1].id).object.visible,true);assert.equal(world.homes.get(p.house.id).group.visible,false);
 assert.ok(world.camera.position.distanceTo(world.cameraFocus)<49);assert.ok(world.hemi.intensity>1);assert.equal(world.sun.castShadow,false);
 // Check the rendered floor graph, rather than just the generator's room graph.
 const floor=world.caveModel.group.children.find(o=>o.isInstancedMesh),rendered=new Set(),matrix=new T.Matrix4(),point=new T.Vector3();
 for(let i=0;i<floor.count;i++){floor.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);rendered.add(Math.floor(point.z/TILE)*d.width+Math.floor(point.x/TILE));}
 const start=Math.floor(d.spawn.z/TILE)*d.width+Math.floor(d.spawn.x/TILE),seen=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++){const v=queue[i],x=v%d.width,z=Math.floor(v/d.width);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const n=(z+dz)*d.width+x+dx;if(rendered.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}}}
 assert.equal(seen.size,rendered.size);for(const n of d.nodes)assert.ok(seen.has(Math.floor(n.z/TILE)*d.width+Math.floor(n.x/TILE)));
 assert.doesNotThrow(()=>world.setPlayer(p));assert.equal(world.caveModel,null);assert.equal(world.homes.get(p.house.id).group.visible,true);assert.equal(world.sun.castShadow,true);
});
test('rapid orbit changes and extreme vertical drags never cross the pole or collapse camera distance',()=>{
 const world=rendererFixture();world.setPlayer(createPlayer('camera-stress','Ada'));const direction=new T.Vector3();
 for(let i=0;i<1800;i++){
  world.yaw+=(i%2?1:-1)*3.05;world.pitch=i%2?100:-100;world.zoom=.55+(i%24)/24*1.75;world.updateCamera(1/60);
  const radius=216*world.zoom,horizontal=Math.hypot(world.camera.position.x-world.cameraFocus.x,world.camera.position.z-world.cameraFocus.z);
  assert.ok(world.pitch>=CAMERA_LIMITS.minPitch&&world.pitch<=CAMERA_LIMITS.maxPitch);assert.ok(horizontal>=radius*Math.cos(CAMERA_LIMITS.maxPitch)-.001);assert.ok(Math.abs(world.camera.position.distanceTo(world.cameraFocus)-radius)<.001);
  assert.ok(world.camera.position.y>world.cameraFocus.y);world.camera.getWorldDirection(direction);assert.ok(direction.y<0);assert.equal(world.camera.up.y,1);
 }
 world.cameraOrbit={yaw:Math.PI-.01,pitch:.7};world.yaw=-Math.PI+.01;world.pitch=.7;world.updateCamera(1/60);assert.ok(Math.abs(world.cameraOrbit.yaw)>3.12);
});
function canvasFixture(){
 const ops=[],stack=[];let m=[1,0,0,1,0,0];const point=(x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
 const ctx={save(){stack.push(m.slice());},restore(){m=stack.pop();},translate(x,y){m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y;ops.push(['translate',x,y]);},rotate(a){const c=Math.cos(a),s=Math.sin(a),[aa,b,cc,d]=m;m[0]=aa*c+cc*s;m[1]=b*c+d*s;m[2]=cc*c-aa*s;m[3]=d*c-b*s;},beginPath(){},moveTo(x,y){ops.push(['tip',...point(x,y)]);},lineTo(){},closePath(){},fill(){},stroke(){},arc(x,y){ops.push(['mark',...point(x,y)]);},fillRect(...a){ops.push(['floor',...a]);},fillText(text,x,y){ops.push(['text',text,...point(x,y)]);},strokeText(){},drawImage(...a){ops.push(['crop',...a.slice(1)]);ops.push(['imageMatrix',...m]);}};
 return {width:190,height:190,ops,getContext:()=>ctx};
}
test('surface minimap tracks motion without regenerating terrain and cave maps show connected floors',()=>{
 let generated=0;globalThis.document={createElement:()=>{generated++;return canvasFixture();}};const map=canvasFixture(),p=createPlayer('map-tracking','Ada');drawMiniMap(map,p);
 const before=map.ops.findLast(x=>x[0]==='crop');drawMiniMap(map,{...p,x:p.x+10,z:p.z-6});const after=map.ops.findLast(x=>x[0]==='crop');assert.equal(generated,1);assert.ok(after[1]>before[1]);assert.ok(after[2]<before[2]);assert.equal(map.ops.findLast(x=>x[0]==='translate')[1],map.width/2);
 drawMiniMap(map,{...p,x:p.x+250});assert.equal(generated,2);
 const d=generateDungeon(-2,3),atlas=canvasFixture();atlas.width=760;atlas.height=540;drawCaveMap(atlas,d,{...p,dungeon:{id:d.id,...d.spawn},caves:{[d.id]:{rooms:[0]}}},{detailed:true});
 assert.equal(atlas.ops.filter(x=>x[0]==='floor').length,d.cells.reduce((n,v)=>n+v,0)+1);
 const local=canvasFixture();drawMiniMap(local,{...p,dungeon:{id:d.id,...d.spawn}},{cave:d});const pos=local.ops.findLast(x=>x[0]==='translate');assert.ok(Math.abs(pos[1]-95)<.001&&Math.abs(pos[2]-95)<.001);
});
test('surface and cave minimaps align camera forward with map up and retain coverage while rotating',()=>{
 const world=rendererFixture(),p=createPlayer('camera-minimap','Ada'),direction=new T.Vector3();world.setPlayer(p);
 let generated=0;globalThis.document={createElement:()=>{generated++;return canvasFixture();}};
 const map=canvasFixture(),caveMap=canvasFixture(),d=generateDungeon(-2,3);
 for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5,-Math.PI+.001]){
  world.yaw=yaw;world.updateCamera(0,true);world.camera.getWorldDirection(direction);const heading=Math.atan2(direction.x,direction.z),cameraYaw=world.cameraOrbit.yaw;
  drawMiniMap(map,p,{heading,cameraYaw});drawMiniMap(caveMap,{...p,dungeon:{id:d.id,...d.spawn}},{cave:d,heading,cameraYaw});
  for(const canvas of [map,caveMap]){const tip=canvas.ops.findLast(o=>o[0]==='tip');assert.ok(Math.abs(tip[1]-95)<1e-8);assert.ok(Math.abs(tip[2]-88)<1e-8);const north=canvas.ops.findLast(o=>o[0]==='text');assert.ok(Math.abs(north[2]-(95+Math.sin(cameraYaw)*83))<1e-8);assert.ok(Math.abs(north[3]-(95-Math.cos(cameraYaw)*83))<1e-8);}
  const crop=map.ops.findLast(o=>o[0]==='crop');assert.ok(crop[1]>=0&&crop[2]>=0&&crop[1]+crop[3]<=380&&crop[2]+crop[4]<=380);
 }
 assert.equal(generated,1,'turning in place reuses the same terrain image');
 // Move close to the old cache boundary; the diagonal crop must stay inside its terrain image.
 drawMiniMap(map,{...p,x:p.x+190,z:p.z+190},{cameraYaw:Math.PI/4});const crop=map.ops.findLast(o=>o[0]==='crop');assert.equal(generated,2);assert.ok(crop[1]>=0&&crop[2]>=0&&crop[1]+crop[3]<=380&&crop[2]+crop[4]<=380);
});
