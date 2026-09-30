import * as T from '../vendor/three.module.js';
import {resolveDungeon,ruinFor,caveWalkable,caveStatus,roomAt,cavePathClear} from './dungeons.js?v=2';
import {buildDungeon,findCavePath} from './dungeon-render.js?v=3';
import {CAMERA_LIMITS,wrapAngle,clampPitch,advanceOrbit,orbitPosition} from './camera-controls.js?v=3';
import {CHUNK,REGION,WATER,BIOMES,hash,heightAt,waterDistance,biomeAt,roadSegments,roadDistance,settlement,npcsFor,resourcesFor,nearestSettlement,smithFor} from './world.js?v=6';
import {equippedWeapon,guardiansFor,dummyFor} from './action-game.js?v=6';
import {advanceMotion,beginJump} from './action-motion.js?v=6';
const materials={};const mat=(name,color)=>materials[name]||(materials[name]=new T.MeshStandardMaterial({color,roughness:1,flatShading:true}));
const geos={box:new T.BoxGeometry(1,1,1),trunk:new T.CylinderGeometry(.25,.45,1,5),pine:new T.ConeGeometry(1,1,6),rock:new T.IcosahedronGeometry(1,0),sphere:new T.IcosahedronGeometry(1,1),grass:new T.ConeGeometry(1,1,3)};
function mesh(geo,material,x,y,z,sx=1,sy=1,sz=1){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;return m;}
function roofGeo(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([
 -1,0,-1,0,1,-1,1,0,-1, -1,0,1,1,0,1,0,1,1,
 -1,0,-1,0,1,1,0,1,-1, -1,0,-1,-1,0,1,0,1,1,
 1,0,-1,0,1,1,1,0,1, 1,0,-1,0,1,-1,0,1,1
],3));g.computeVertexNormals();return g;}
const roof=roofGeo();
export function weaponModel(recipe){const g=new T.Group(),iron=mat('weaponIron',0xced6cd),grip=mat('weaponGrip',0x795437);g.add(mesh(geos.box,grip,0,.18,0,.14,.42,.16));if(recipe==='axe'){g.add(mesh(geos.box,grip,0,.9,0,.14,1.7,.14),mesh(geos.box,iron,.25,1.5,0,.7,.6,.18));}else{const length=recipe==='dagger'?.9:1.8;g.add(mesh(geos.box,iron,0,.5+length/2,0,.22,length,.08),mesh(geos.pine,iron,0,.5+length+.18,0,.2,.4,.08),mesh(geos.box,iron,0,.48,0,.6,.12,.14));}return g;}
export function avatar(color=0xd5b370){
 const g=new T.Group(),boots=mat('boots',0x433c2c),skin=mat('skin',0xcdb392),cloth=mat('cloak'+color,color);
 const left=mesh(geos.box,boots,-.22,.4,0,.3,.8,.36),right=mesh(geos.box,boots,.22,.4,0,.3,.8,.36);g.add(left,right);
 g.add(mesh(geos.pine,cloth,0,1.25,0,.68,1.4,.52),mesh(geos.sphere,skin,0,2.15,0,.34,.42,.34));
 const pack=mesh(geos.box,mat('pack',0x765437),0,1.4,-.48,.65,.8,.34);pack.name='backpack';g.add(pack);
 g.add(mesh(geos.box,mat('hair',0x51452e),0,2.46,-.05,.6,.17,.6),mesh(geos.sphere,skin,0,2.13,.36,.095,.1,.12));
 for(const x of [-.14,.14])g.add(mesh(geos.sphere,mat('eyes',0x25342e),x,2.23,.29,.045,.045,.045));
 for(const x of [-.5,.5])g.add(mesh(geos.box,cloth,x,1.4,0,.22,.65,.24),mesh(geos.sphere,skin,x,1.05,.05,.13,.14,.13));
 g.userData.legs=[left,right];return g;
}
export class WorldRenderer {
 constructor(container,{onWalk,onFrame}){
  this.container=container;this.onWalk=onWalk;this.onFrame=onFrame;this.chunks=new Map();this.nodes=new Map();this.npcs=new Map();this.villages=new Map();this.depleted=new Set();this.others=new Map();this.frame=0;this.keys={};this.player=null;this.target=null;this.yaw=.15;this.zoom=1;this.touchPoints=new Map();this.terrain=[];this.quality='balanced';this.ruins=new Map();this.homes=new Map();this.cave=null;this.caveModel=null;this.path=[];this.exploration={};
  this.pitch=CAMERA_LIMITS.defaultPitch;this.cameraOrbit={yaw:this.yaw,pitch:this.pitch};this.cameraFocus=new T.Vector3();this.projectedLabel=new T.Vector3();
  this.motion={stamina:100,height:0,velocity:0,swing:0};this.runToggled=false;this.opponents=new Map();
  this.scene=new T.Scene();this.scene.background=new T.Color(0x9aada0);this.scene.fog=new T.Fog(0x9aada0,440,950);
  this.camera=new T.PerspectiveCamera(40,1,.3,1500);
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.16;container.append(this.renderer.domElement);
  this.hemi=new T.HemisphereLight(0xe8f1da,0x536448,2.3);this.scene.add(this.hemi);this.sun=new T.DirectionalLight(0xffe5ae,3.1);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-150;this.sun.shadow.camera.right=150;this.sun.shadow.camera.top=150;this.sun.shadow.camera.bottom=-150;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=450;this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.8;this.scene.add(this.sun,this.sun.target);
  this.hero=avatar();this.scene.add(this.hero);this.lantern=new T.PointLight(0xffc979,18,24,1.5);this.lantern.visible=false;this.scene.add(this.lantern);
  this.ring=new T.Mesh(new T.RingGeometry(1.2,1.55,32),new T.MeshBasicMaterial({color:0xf4d18c,side:T.DoubleSide,transparent:true,opacity:.8}));this.ring.rotation.x=-Math.PI/2;this.scene.add(this.ring);
  this.destination=new T.Mesh(new T.RingGeometry(1.3,1.5,24),new T.MeshBasicMaterial({color:0xffe2a7,side:T.DoubleSide}));this.destination.rotation.x=-Math.PI/2;this.destination.visible=false;this.scene.add(this.destination);
  this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.temp=new T.Object3D();this.clock=new T.Clock();this.labelContainer=document.getElementById('world-labels');
  this.resize=()=>{this.camera.aspect=container.clientWidth/container.clientHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(container.clientWidth,container.clientHeight);};this.resize();window.addEventListener('resize',this.resize);
  window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;this.keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();});window.addEventListener('keyup',e=>this.keys[e.code]=false);window.addEventListener('blur',()=>this.keys={});
  const c=this.renderer.domElement;c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);if(!this.touchPoints.size)this.gestureMoved=false;this.touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});if(this.touchPoints.size===2){this.pinch=Math.max(1,this.pinchDistance());this.gestureMoved=true;}});
  c.addEventListener('pointermove',e=>{const point=this.touchPoints.get(e.pointerId);if(!point)return;const dx=e.clientX-point.x,dy=e.clientY-point.y;point.x=e.clientX;point.y=e.clientY;
   if(this.touchPoints.size===2){const d=Math.max(1,this.pinchDistance());this.zoom=Math.max(.55,Math.min(2.3,this.zoom*this.pinch/d));this.pinch=d;return;}
   if(Math.hypot(e.clientX-point.startX,e.clientY-point.startY)>9)this.gestureMoved=true;
   if(this.gestureMoved){this.yaw=wrapAngle(this.yaw-dx*.005);this.pitch=clampPitch(this.pitch+dy*.004,!!this.cave);}
  });
  c.addEventListener('pointerup',e=>{if(!this.touchPoints.has(e.pointerId))return;this.touchPoints.delete(e.pointerId);if(!this.gestureMoved&&!this.touchPoints.size&&this.player){const r=c.getBoundingClientRect();this.pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.terrain,false)[0];if(hit)this.onWalk({x:hit.point.x,z:hit.point.z});}});c.addEventListener('pointercancel',()=>{this.touchPoints.clear();this.gestureMoved=true;});
  c.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.55,Math.min(2.3,this.zoom+e.deltaY*.0007));},{passive:false});
  this.loop=()=>{this.raf=requestAnimationFrame(this.loop);const dt=Math.min(.05,this.clock.getDelta());if(this.player)this.animate(dt);};this.loop();
 }
 pinchDistance(){const a=[...this.touchPoints.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
 setPlayer(p){
  const next=p.dungeon?.id||null;if(next!==this.cave?.id)this.changeSpace(next);
  this.player={...p,x:p.dungeon?.x??p.x,z:p.dungeon?.z??p.z,dungeon:p.dungeon?{...p.dungeon}:null};this.exploration=p.caves||{};this.target=null;this.path=[];
  this.motion??={stamina:100,height:0,velocity:0,swing:0};this.motion.height=0;this.motion.velocity=0;this.syncActionState(p);
  const y=this.ground(this.player.x,this.player.z);this.hero.position.set(this.player.x,y,this.player.z);this.updateCamera(0,true);
  this.setHomes(this.homeList||[p.house]);if(!this.cave){this.cx=null;this.stream();}
 }
 changeSpace(id){
  for(const foe of this.opponents?.values()||[]){this.scene.remove(foe.object);foe.label?.remove();}this.opponents=new Map();
  if(this.caveModel){this.scene.remove(this.caveModel.group);for(const item of this.caveModel.disposable)item.dispose();this.caveModel=null;}
  this.cave=id?resolveDungeon(id):null;const outside=!this.cave;
  for(const c of this.chunks.values())c.group.visible=outside;for(const v of this.villages.values())v.group.visible=outside;for(const r of this.ruins.values())r.group.visible=outside;for(const h of this.homes.values())h.group.visible=outside;for(const o of this.others.values())o.visible=outside;
  this.hemi.intensity=outside?2.3:1.8;this.sun.intensity=outside?3.1:1.6;this.sun.castShadow=outside;this.lantern.visible=!outside;this.scene.background.setHex(outside?0x9aada0:0x25332c);this.scene.fog.color.setHex(outside?0x9aada0:0x25332c);
  if(this.cave){this.caveModel=buildDungeon(this.cave);this.scene.add(this.caveModel.group);this.terrain=[this.caveModel.rayFloor];for(const [nodeId,n]of this.caveModel.nodes)this.showNode(n,!this.depleted.has(nodeId));}else this.terrain=[...this.chunks.values()].map(c=>c.terrain);
  this.labelContainer.replaceChildren();for(const item of [...this.npcs.values(),...this.villages.values(),...this.ruins.values(),...this.homes.values()])this.labelContainer.append(item.label);
 }
 syncActionState(p){
  this.combat=p.combat||{};this.opponents??=new Map();const weapon=equippedWeapon(p);
  if(this.weaponId!==weapon?.id){if(this.heldWeapon)this.hero.remove(this.heldWeapon);this.heldWeapon=weapon?weaponModel(weapon.recipe):null;this.weaponId=weapon?.id;if(this.heldWeapon){this.heldWeapon.position.set(.65,1,.2);this.hero.add(this.heldWeapon);}}
  const wanted=this.cave?guardiansFor(this.cave):[...this.villages.values()].map(dummyFor);
  const ids=new Set(wanted.map(n=>n.id));for(const [id,n]of this.opponents)if(!ids.has(id)){this.scene.remove(n.object);n.label.remove();this.opponents.delete(id);}
  for(const n of wanted){let item=this.opponents.get(n.id);if(!item){const object=new T.Group();object.position.set(n.x,this.cave?0:n.y,n.z);const body=mat(n.dummy?'dummyBody':'sentinelBody',n.dummy?0xb59156:0x707e6d);object.add(mesh(geos.box,body,0,1.3,0,n.dummy?1:1.9,n.dummy?1.8:2.5,.9),mesh(geos.sphere,body,0,2.8,0,.6,.6,.6));if(n.dummy)object.add(mesh(geos.box,body,0,1.8,0,2.5,.2,.2));else for(const x of [-.25,.25])object.add(mesh(geos.sphere,mat('sentinelEyes',0xed7b59),x,2.9,.51,.1,.12,.1));const label=document.createElement('div');label.className='world-label';this.labelContainer.append(label);item={...n,object,label};this.opponents.set(n.id,item);this.scene.add(object);}const hp=this.combat[n.id]?.health??n.health;item.currentHealth=hp;item.object.visible=hp>0||!!n.dummy;item.object.rotation.z=n.dummy&&hp===0?Math.PI/2:0;item.label.textContent=`${n.name} · ${hp} HP`;}
 }
 jump(){this.motion??={stamina:100,height:0,velocity:0,swing:0};return beginJump(this.motion);}
 attackSwing(){if(!this.heldWeapon||this.motion.swing>0)return false;this.hero.rotation.y=wrapAngle(this.cameraOrbit.yaw+Math.PI);this.motion.swing=.65;return true;}
 attackTarget(weapon){let best=null,distance=weapon.reach;for(const foe of this.opponents.values()){if(!foe.object.visible)continue;const dx=foe.x-this.player.x,dz=foe.z-this.player.z,d=Math.hypot(dx,dz),dot=d?(dx*Math.sin(this.hero.rotation.y)+dz*Math.cos(this.hero.rotation.y))/d:1;if(d<=distance&&dot>.25&&(!this.cave||cavePathClear(this.cave,this.player,foe))){best=foe;distance=d;}}return best;}
 setHomes(homes){
  if(!homes)return;this.homeList=homes;const wanted=new Set(homes.filter(Boolean).map(h=>h.id));
  for(const [id,h]of this.homes)if(!wanted.has(id)){this.scene.remove(h.group);h.label.remove();this.homes.delete(id);}
  for(const h of homes.filter(Boolean)){if(!this.homes.has(h.id))this.addHome(h);const item=this.homes.get(h.id);item.ownerName=h.ownerName;item.label.textContent=h.owner===this.player?.id?'Your home':`${h.ownerName}'s home`;item.group.visible=!this.cave;}
 }
 setWalkTarget(pos){if(this.cave){const path=findCavePath(this.cave,this.player,pos);if(!path)return false;this.path=path;this.target=this.path.shift();}else{this.path=[];this.target=pos;}return true;}
 addHome(h){
  const g=new T.Group();g.position.set(h.x,h.y,h.z);g.rotation.y=h.rotation;const own=h.owner===this.player?.id;
  g.add(mesh(geos.box,mat('homeFoundation',0x86876d),0,.25,0,11,.5,11),mesh(geos.box,mat('homeWall',0xc4bb95),0,2.6,0,9,4.7,8),mesh(roof,mat(own?'myRoof':'otherRoof',own?0x915244:0x627866),0,5,0,5.6,3.1,5));
  g.add(mesh(geos.box,mat('door',0x534b36),0,1.5,4.05,1.8,2.5,.18),mesh(geos.box,mat('window',0x4a655a),-2.8,3,4.08,1.2,1.2,.15),mesh(geos.box,mat('window',0x4a655a),2.8,3,4.08,1.2,1.2,.15),mesh(geos.box,mat('chimney',0x77735e),2.7,6.6,-1.5,1.1,3.5,1.1));
  for(const x of [-4.7,4.7]){g.add(mesh(geos.box,mat('fence',0x887555),x,.6,6.2,.2,1.2,6));for(let i=0;i<4;i++)g.add(mesh(geos.box,mat('fence',0x887555),x,.75,4+i*1.5,.25,1.5,.25));}
  g.add(mesh(geos.box,mat('path',0xae9a69),0,.15,6,3.2,.15,4),mesh(geos.box,mat('crate',0x81674a),-5.8,.8,0,1.4,1.6,1.4));
  for(let i=0;i<7;i++){const x=5.8+(i%2)*.6,z=-2+i*.7;g.add(mesh(geos.sphere,mat('garden',0x4e7544),x,.6,z,.5,.6,.5),mesh(geos.sphere,mat('flowers',0xd6bc75),x,.98,z,.16,.2,.16));}
  const label=document.createElement('div');label.className='world-label home-label';label.textContent=own?'Your home':`${h.ownerName}'s home`;this.labelContainer.append(label);this.homes.set(h.id,{...h,group:g,label});g.visible=!this.cave;this.scene.add(g);
 }
 addRuin(r){
  const g=new T.Group(),stone=mat('ruinStone',0x777d67),dark=mat('ruinDark',0x111e19);g.position.set(r.x,r.y,r.z);
  g.add(mesh(geos.box,stone,0,.15,0,18,.3,18),mesh(geos.box,stone,-3,3,0,1.4,6,1.6),mesh(geos.box,stone,3,3,0,1.4,6,1.6),mesh(geos.box,stone,0,6,0,7.6,1.4,1.7),mesh(geos.box,dark,0,2.65,-.25,4.6,5.3,.5));
  for(let i=0;i<6;i++)g.add(mesh(geos.box,stone,0,.25-i*.1,5-i*.7,4.5,.25,.8));
  for(let i=0;i<7;i++){const angle=i*2.1,rad=8+hash(r.rx,r.rz,4700+i)*6;g.add(mesh(geos.rock,stone,Math.sin(angle)*rad,.7,Math.cos(angle)*rad,1.8,1.4,1.5));}
  for(const x of [-7,7])g.add(mesh(geos.box,stone,x,2.2,-5,1.1,4.4,1.1),mesh(geos.box,mat('ivy',0x446640),x+.25,1.7,-4.3,.9,3.4,.35));
  const label=document.createElement('div');label.className='world-label entrance-label';this.labelContainer.append(label);this.ruins.set(r.id,{...r,group:g,label});this.scene.add(g);
 }
 setDepleted(ids){this.depleted=new Set(ids);for(const [id,n]of this.nodes)this.showNode(n,!this.depleted.has(id));if(this.caveModel)for(const [id,n]of this.caveModel.nodes)n.object.visible=!this.depleted.has(id);}
 showNode(n,visible){visible=visible&&!n.occupied;if(n.instanced){for(const [m,i,matrix]of n.instances){if(visible)m.setMatrixAt(i,matrix);else{const hide=new T.Matrix4().makeScale(0,0,0);m.setMatrixAt(i,hide);}m.instanceMatrix.needsUpdate=true;}}else n.object.visible=visible;}
 setOthers(players){const live=new Set();for(const p of players){if(p.id===this.player?.id)continue;live.add(p.id);let o=this.others.get(p.id);if(!o){o=avatar(0x91b6bb);this.scene.add(o);this.others.set(p.id,o);}o.visible=(p.space||'overworld')===(this.cave?.id||'overworld');o.position.set(p.x,this.cave?0:heightAt(p.x,p.z),p.z);}for(const [id,o]of this.others)if(!live.has(id)){this.scene.remove(o);this.others.delete(id);}}
 ground(x,z){if(this.cave)return 0;if(waterDistance(x,z)<6&&roadDistance(x,z,roadSegments(Math.floor(x/REGION),Math.floor(z/REGION)))<7)return WATER+1.1;return heightAt(x,z);}
 passable(x,z){if(this.cave)return caveWalkable(this.cave,x,z);for(const h of this.homes.values())if(Math.hypot(x-h.x,z-h.z)<5.6)return false;return waterDistance(x,z)>-3||roadDistance(x,z,roadSegments(Math.floor(x/REGION),Math.floor(z/REGION)))<7;}
 updateCamera(dt,snap=false){
  const p=this.player,focus=new T.Vector3(p.x,this.ground(p.x,p.z)+2.5,p.z);this.pitch=clampPitch(this.pitch,!!this.cave);this.yaw=wrapAngle(this.yaw);
  if(snap){this.cameraFocus.copy(focus);this.cameraOrbit={yaw:this.yaw,pitch:this.pitch};}else{this.cameraFocus.lerp(focus,1-Math.exp(-dt*12));this.cameraOrbit=advanceOrbit(this.cameraOrbit,{yaw:this.yaw,pitch:this.pitch},dt,!!this.cave);}
  const radius=(this.cave?48:216)*this.zoom,pos=orbitPosition(this.cameraFocus,this.cameraOrbit,radius);this.camera.position.set(pos.x,pos.y,pos.z);this.camera.up.set(0,1,0);this.camera.lookAt(this.cameraFocus);this.camera.updateMatrixWorld(true);
  this.scene.fog.near=this.cave?radius*1.1:440*Math.max(1,this.zoom);this.scene.fog.far=this.cave?radius+190:1000*Math.max(1,this.zoom);
 }
 animate(dt){
  const p=this.player;let vx=0,vz=0;
  if(!document.querySelector('dialog[open]')){
   let ax=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0),az=(this.keys.KeyS||this.keys.ArrowDown?1:0)-(this.keys.KeyW||this.keys.ArrowUp?1:0);
   if(ax||az){this.target=null;this.path=[];const len=Math.hypot(ax,az);ax/=len;az/=len;vx=ax*Math.cos(this.yaw)+az*Math.sin(this.yaw);vz=-ax*Math.sin(this.yaw)+az*Math.cos(this.yaw);}
   else if(this.target){const d=Math.hypot(this.target.x-p.x,this.target.z-p.z);if(d<.65)this.target=this.path.shift()||null;else{vx=(this.target.x-p.x)/d;vz=(this.target.z-p.z)/d;}}
  }
  const state=advanceMotion(this.motion,dt,{running:!document.querySelector('dialog[open]')&&(this.runToggled||this.keys.ShiftLeft||this.keys.ShiftRight),moving:!!(vx||vz)}),speed=(this.cave?6.5:12)*(state.running?1.65:1),dx=vx*dt*speed,dz=vz*dt*speed;let moved=0;
  if(vx||vz){const nx=p.x+dx,nz=p.z+dz;if(this.passable(nx,nz)){p.x=nx;p.z=nz;moved=Math.hypot(dx,dz);this.hero.rotation.y=Math.atan2(vx,vz);}else if(this.passable(nx,p.z)){p.x=nx;moved=Math.abs(dx);}else if(this.passable(p.x,nz)){p.z=nz;moved=Math.abs(dz);}else this.target=null;}
  const y=this.ground(p.x,p.z);this.hero.position.set(p.x,y+state.height+Math.sin(this.clock.elapsedTime*(state.running?17:12))*Math.min(moved*1.5,.15),p.z);this.ring.position.set(p.x,y+.2,p.z);if(this.heldWeapon){const swing=this.motion.swing/ .65;this.heldWeapon.rotation.x=.2+Math.sin(swing*Math.PI)*1.8;this.heldWeapon.rotation.z=-.25+Math.sin(swing*Math.PI)*.7;}
  if(p.dungeon){p.dungeon.x=p.x;p.dungeon.z=p.z;}for(const [i,leg]of this.hero.userData.legs.entries())leg.rotation.x=Math.sin(this.clock.elapsedTime*11+i*Math.PI)*Math.min(moved*4,.5);
  this.updateCamera(dt);this.lantern.position.set(p.x,3.2,p.z);
  this.sun.position.set(p.x-85,y+175,p.z-90);this.sun.target.position.set(p.x,y,p.z);
  this.destination.visible=!!this.target;if(this.target)this.destination.position.set(this.target.x,this.ground(this.target.x,this.target.z)+.3,this.target.z);
  if(this.frame++%20===0&&!this.cave)this.stream();if(this.caveModel)for(const f of this.caveModel.torches)f.scale.y=.65+Math.sin(this.clock.elapsedTime*5+f.position.x)*.08;this.labels();for(const foe of this.opponents.values()){const visible=foe.object.visible&&Math.hypot(p.x-foe.x,p.z-foe.z)<45;foe.label.style.display=visible?'block':'none';if(visible){const v=this.projectedLabel.set(foe.x,(this.cave?0:foe.y)+4,foe.z).project(this.camera);foe.label.style.left=`${(v.x*.5+.5)*this.container.clientWidth}px`;foe.label.style.top=`${(-v.y*.5+.5)*this.container.clientHeight}px`;}}
  this.onFrame({x:p.x,z:p.z,moved,dt,running:state.running,stamina:state.stamina});this.renderer.render(this.scene,this.camera);
 }
 stream(){if(this.cave)return;const cx=Math.floor(this.player.x/CHUNK),cz=Math.floor(this.player.z/CHUNK),r=Math.min(4,Math.max(2,Math.ceil(this.zoom*1.6)));
  if(this.cx===cx&&this.cz===cz&&this.radius===r)return;this.cx=cx;this.cz=cz;this.radius=r;
  const want=new Set();const pending=[];
  for(let a=cx-r;a<=cx+r;a++)for(let b=cz-r;b<=cz+r;b++){const key=`${a}:${b}`;want.add(key);if(!this.chunks.has(key))pending.push([a,b]);}
  pending.sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cz)-Math.hypot(b[0]-cx,b[1]-cz));for(const [a,b]of pending)this.addChunk(a,b);
  for(const [key,chunk]of this.chunks)if(!want.has(key)){this.scene.remove(chunk.group);for(const m of chunk.disposable)m.dispose();for(const id of chunk.ids)this.nodes.delete(id);this.chunks.delete(key);}
  this.terrain=[...this.chunks.values()].map(c=>c.terrain);for(const [id,ruin]of this.ruins)if(Math.hypot(ruin.x-this.player.x,ruin.z-this.player.z)>CHUNK*(r+2)){this.scene.remove(ruin.group);ruin.label.remove();this.ruins.delete(id);}
  const rx=Math.floor(this.player.x/REGION),rz=Math.floor(this.player.z/REGION),vWant=new Set();
  for(let a=rx-1;a<=rx+1;a++)for(let b=rz-1;b<=rz+1;b++){const ruin=ruinFor(a,b);if(Math.hypot(ruin.x-this.player.x,ruin.z-this.player.z)<CHUNK*(r+1)&&!this.ruins.has(ruin.id))this.addRuin(ruin);const s=settlement(a,b);if(Math.hypot(s.x-this.player.x,s.z-this.player.z)<CHUNK*3.2){vWant.add(s.id);if(!this.villages.has(s.id))this.addVillage(s);}}
  for(const [id,v]of this.villages)if(!vWant.has(id)){this.scene.remove(v.group);v.label.remove();for(const npc of v.npcs){this.npcs.get(npc.id)?.label.remove();this.npcs.delete(npc.id);}this.villages.delete(id);}
  this.syncActionState(this.player);
 }
 addChunk(cx,cz){
  const group=new T.Group(),ids=[],disposable=[],segments=roadSegments(Math.floor(cx*CHUNK/REGION),Math.floor(cz*CHUNK/REGION));
  const steps=20,size=CHUNK/steps,positions=[],colors=[],biomeColors={};for(const [k,v]of Object.entries(BIOMES))biomeColors[k]=new T.Color(v.color);
  const heights=[];for(let z=0;z<=steps;z++){heights[z]=[];for(let x=0;x<=steps;x++)heights[z][x]=heightAt(cx*CHUNK+x*size,cz*CHUNK+z*size);}
  for(let iz=0;iz<steps;iz++)for(let ix=0;ix<steps;ix++){
   const wx=cx*CHUNK+(ix+.5)*size,wz=cz*CHUNK+(iz+.5)*size,water=waterDistance(wx,wz),road=roadDistance(wx,wz,segments);
   let col=biomeColors[biomeAt(wx,wz)].clone();col.multiplyScalar(.88+hash(cx*steps+ix,cz*steps+iz,800)*.2);if(water<20)col.lerp(new T.Color(0x9b9965),.45);if(road<4.6)col.setHex(0xad9560);
   for(const [dx,dz]of [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]){positions.push(cx*CHUNK+(ix+dx)*size,heights[iz+dz][ix+dx],cz*CHUNK+(iz+dz)*size);colors.push(col.r,col.g,col.b);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();disposable.push(geo);
  const terrain=new T.Mesh(geo,materials.terrain||(materials.terrain=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true})));terrain.receiveShadow=true;group.add(terrain);
  const waterGeo=new T.PlaneGeometry(CHUNK,CHUNK);disposable.push(waterGeo);const water=new T.Mesh(waterGeo,materials.water||(materials.water=new T.MeshStandardMaterial({color:0x4c918d,roughness:.4,metalness:.1,transparent:true,opacity:.91})));water.rotation.x=-Math.PI/2;water.position.set((cx+.5)*CHUNK,WATER,(cz+.5)*CHUNK);water.receiveShadow=true;group.add(water);
  // Roads cross river channels on timber bridges.
  const bridgePlaces=new Set();for(const [a,b]of segments){const d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(d/7);for(let i=0;i<n;i++){const t=(i+.5)/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(x<cx*CHUNK||x>=(cx+1)*CHUNK||z<cz*CHUNK||z>=(cz+1)*CHUNK||waterDistance(x,z)>22)continue;const key=`${Math.round(x/6)}:${Math.round(z/6)}`;if(bridgePlaces.has(key))continue;bridgePlaces.add(key);const deck=mesh(geos.box,mat('bridge',0x907449),x,WATER+.65,z,9,.7,8);deck.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);group.add(deck);}}
  const nodes=resourcesFor(cx,cz),trees=nodes.filter(n=>n.kind==='wood'),trunks=new T.InstancedMesh(geos.trunk,mat('trunk',0x6c573e),trees.length),crowns=new T.InstancedMesh(geos.pine,mat('foliage',0xffffff),trees.length);trunks.castShadow=true;crowns.castShadow=true;trunks.receiveShadow=true;crowns.receiveShadow=true;group.add(trunks,crowns);disposable.push(trunks,crowns);
  trees.forEach((n,i)=>{const h=7*n.scale,instances=[];for(const [m,y,sx,sy,sz]of [[trunks,n.y+h*.3,.9*n.scale,h*.65,.9*n.scale],[crowns,n.y+h*.75,3.4*n.scale,h,3.4*n.scale]]){this.temp.position.set(n.x,y,n.z);this.temp.rotation.set(0,hash(cx,cz,1000+i)*6.28,0);this.temp.scale.set(sx,sy,sz);this.temp.updateMatrix();m.setMatrixAt(i,this.temp.matrix);instances.push([m,i,this.temp.matrix.clone()]);}crowns.setColorAt(i,new T.Color(BIOMES[n.biome].tree).multiplyScalar(.9+hash(cx,cz,1100+i)*.3));const entry={...n,instanced:true,instances,occupied:[...this.homes.values()].some(h=>Math.hypot(h.x-n.x,h.z-n.z)<12)};this.nodes.set(n.id,entry);ids.push(n.id);this.showNode(entry,!this.depleted.has(n.id));});
  for(const n of nodes.filter(n=>n.kind!=='wood')){let object;if(n.kind==='stone'){object=mesh(geos.rock,mat('rock',0x8b9585),n.x,n.y+.9,n.z,1.4*n.scale,1.2*n.scale,1.1*n.scale);}else if(n.kind==='berries'){object=new T.Group();object.position.set(n.x,n.y,n.z);object.add(mesh(geos.sphere,mat('bush',0x496a3d),0,.8,0,1.3,.9,1.3));for(let i=0;i<5;i++)object.add(mesh(geos.sphere,mat('berry',0xb86652),Math.sin(i*2.4),1.1,Math.cos(i*2.4),.22,.22,.22));}else{object=mesh(geos.grass,mat('fiber',0xb4b078),n.x,n.y+.8,n.z,1.1,1.7,1.1);}group.add(object);const entry={...n,object,occupied:[...this.homes.values()].some(h=>Math.hypot(h.x-n.x,h.z-n.z)<12)};this.nodes.set(n.id,entry);ids.push(n.id);this.showNode(entry,!this.depleted.has(n.id));}
  // Instanced biome foliage keeps the landscape dense without per-plant draw calls.
  const nearbyRuins=[];const rx=Math.floor(cx*CHUNK/REGION),rz=Math.floor(cz*CHUNK/REGION);for(let a=rx-1;a<=rx+1;a++)for(let b=rz-1;b<=rz+1;b++)nearbyRuins.push(ruinFor(a,b));
  const centerBiome=biomeAt((cx+.5)*CHUNK,(cz+.5)*CHUNK),density={forest:115,meadow:48,marsh:76,highlands:28,tundra:30,desert:16}[centerBiome];
  const leaf=new T.InstancedMesh(geos.sphere,mat('broadLeaf',0xffffff),density*3),stems=new T.InstancedMesh(geos.trunk,mat('trunk',0x6c573e),density),pines=new T.InstancedMesh(geos.pine,mat('decorPines',0xffffff),density*2);leaf.castShadow=true;stems.castShadow=true;pines.castShadow=true;
  let treesCount=0,leafCount=0,pineCount=0;
  const clear=(x,z,padding=0)=>waterDistance(x,z)>10+padding&&nearestSettlement(x,z).distance>50&&roadDistance(x,z,segments)>6+padding&&![...this.homes.values()].some(h=>Math.hypot(h.x-x,h.z-z)<12)&&!nearbyRuins.some(r=>Math.hypot(r.x-x,r.z-z)<20);
  for(let i=0;i<density;i++){
   const x=cx*CHUNK+hash(cx,cz,5100+i*2)*CHUNK,z=cz*CHUNK+hash(cx,cz,5101+i*2)*CHUNK;if(!clear(x,z,5))continue;const biome=biomeAt(x,z),y=heightAt(x,z),h=5+hash(cx,cz,5400+i)*8,scale=.8+hash(cx,cz,5500+i)*.7;
   this.temp.position.set(x,y+h*.35,z);this.temp.scale.set(scale,h*.72,scale);this.temp.rotation.set(0,hash(cx,cz,i+5600)*6.28,0);this.temp.updateMatrix();stems.setMatrixAt(treesCount++,this.temp.matrix);
   const color=new T.Color(BIOMES[biome].tree).multiplyScalar(1+hash(cx,cz,5700+i)*.45),conifer=biome==='tundra'||biome==='highlands'||hash(cx,cz,5800+i)<.3;
   if(conifer){for(let j=0;j<2;j++){this.temp.position.set(x,y+h*(.64+j*.22),z);this.temp.scale.set(3.2*scale*(1-j*.24),h*.66,3.2*scale*(1-j*.24));this.temp.updateMatrix();pines.setMatrixAt(pineCount,this.temp.matrix);pines.setColorAt(pineCount++,color);}}
   else for(let j=0;j<3;j++){this.temp.position.set(x+Math.sin(j*2.1)*scale,y+h*(.7+j*.12),z+Math.cos(j*2.1)*scale);this.temp.scale.set(2.7*scale,h*.28,2.5*scale);this.temp.updateMatrix();leaf.setMatrixAt(leafCount,this.temp.matrix);leaf.setColorAt(leafCount++,color);}
  }
  stems.count=treesCount;leaf.count=leafCount;pines.count=pineCount;group.add(stems,leaf,pines);disposable.push(stems,leaf,pines);
  const grassCount=centerBiome==='desert'?120:650,grass=new T.InstancedMesh(geos.grass,mat('grassPatch',0xffffff),grassCount),shrubs=new T.InstancedMesh(geos.sphere,mat('shrubs',0xffffff),170),flowers=new T.InstancedMesh(geos.sphere,mat('wildFlowers',0xffffff),100);let ng=0,ns=0,nf=0;
  for(let i=0;i<grassCount;i++){const x=cx*CHUNK+hash(cx,cz,6000+i*2)*CHUNK,z=cz*CHUNK+hash(cx,cz,6001+i*2)*CHUNK;if(!clear(x,z))continue;const biome=biomeAt(x,z),y=heightAt(x,z),r=hash(cx,cz,7500+i),tall=biome==='marsh';this.temp.position.set(x,y+(tall?.65:.3),z);this.temp.rotation.set(0,r*6.28,0);this.temp.scale.set(.6+r*.7,tall?1.8+r:.55+r*.8,.5+r*.4);this.temp.updateMatrix();grass.setMatrixAt(ng,this.temp.matrix);grass.setColorAt(ng++,new T.Color(biome==='desert'?0xb1a26b:biome==='tundra'?0x9cab9a:0x879b4d).multiplyScalar(.8+r*.4));
   if(i%4===0&&ns<170){this.temp.position.set(x+.8,y+.65,z-.6);this.temp.scale.set(1.1+r,.9+r*.6,1.3+r);this.temp.updateMatrix();shrubs.setMatrixAt(ns,this.temp.matrix);shrubs.setColorAt(ns++,new T.Color(BIOMES[biome].tree).multiplyScalar(1.3));}
   if(i%7===0&&biome!=='desert'&&biome!=='tundra'&&nf<100){this.temp.position.set(x,y+.8,z);this.temp.scale.set(.2,.23,.2);this.temp.updateMatrix();flowers.setMatrixAt(nf,this.temp.matrix);flowers.setColorAt(nf++,new T.Color([0xe8ce7e,0xbc91b8,0xdfa381][i%3]));}
  }
  grass.count=ng;shrubs.count=ns;flowers.count=nf;group.add(grass,shrubs,flowers);disposable.push(grass,shrubs,flowers);
  this.scene.add(group);this.chunks.set(`${cx}:${cz}`,{group,terrain,ids,disposable,cx,cz});
 }
 addVillage(s){const group=new T.Group();
  for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,r=27+hash(s.rx,s.rz,1700+i)*8,x=s.x+Math.cos(angle)*r,z=s.z+Math.sin(angle)*r;const house=new T.Group();house.position.set(x,s.y,z);house.rotation.y=-angle+Math.PI/2;const width=7+hash(s.rx,s.rz,1800+i)*3,depth=7+hash(s.rx,s.rz,1900+i)*4;
   house.add(mesh(geos.box,mat('wall',0xc2b58c),0,2,0,width,4,depth),mesh(roof,mat('roof'+i%3,[0x805e41,0x8c7150,0x626b55][i%3]),0,4,0,width*.61,3,depth*.62),mesh(geos.box,mat('door',0x534b36),0,1.1,depth/2+.08,1.4,2.2,.2),mesh(geos.box,mat('window',0x4a655a),-width*.28,2.6,depth/2+.1,.8,1,.15),mesh(geos.box,mat('chimney',0x77735e),width*.28,5.5,-depth*.2,1,3,1));group.add(house);
  }
  // Central stone well.
  const well=new T.Mesh(new T.CylinderGeometry(2,2,1.1,10),mat('well',0x9a9b81));well.position.set(s.x,s.y+.55,s.z-1);group.add(well);group.add(mesh(geos.box,mat('wellWater',0x406e68),s.x,s.y+1.13,s.z-1,2.7,.05,2.7));
  const smith=smithFor(s);if(smith){const x=smith.forgeX,z=smith.forgeZ,y=s.y;group.add(mesh(geos.box,mat('forgeStone',0x6e7564),x,y+1,z,5,2,4),mesh(geos.box,mat('forgeFire',0xeb7130),x,y+1.4,z+2.03,3,.7,.1),mesh(geos.box,mat('forgeChimney',0x626957),x-1.7,y+4,z-1,1,6,1),mesh(geos.box,mat('anvil',0x485852),x+4,y+1,z+1,2.5,.7,1.1),mesh(geos.box,mat('anvilBase',0x795a3b),x+4,y+.4,z+1,1,1,1));}
  const npcs=npcsFor(s);for(const n of npcs){const person=avatar([0xb29054,0x6c8c76,0xa5826c,0x8c6350][npcs.indexOf(n)]);person.position.set(n.x,n.y,n.z);person.rotation.y=hash(s.rx,s.rz,npcs.indexOf(n)+1900)*6.28;group.add(person);const label=document.createElement('div');label.className='world-label';label.textContent=n.role==='smith'?`${n.name} · Smith`:n.name;this.labelContainer.append(label);this.npcs.set(n.id,{...n,object:person,label});}
  const label=document.createElement('div');label.className='world-label village';label.textContent=s.name;this.labelContainer.append(label);this.villages.set(s.id,{...s,group,npcs,label});this.scene.add(group);
  if(this.player)this.syncActionState(this.player);
 }
 labels(){
  if(this.cave){for(const e of this.labelContainer.children)e.style.display='none';return;}
  for(const n of [...this.npcs.values(),...this.villages.values(),...this.ruins.values(),...this.homes.values()]){
   const distance=Math.hypot(this.player.x-n.x,this.player.z-n.z),isVillage=!!n.npcs,isRuin=!!n.dungeonName,isHome=!!n.owner,visible=distance<(isRuin?420:isHome?170:isVillage?300:45);
   const point=this.projectedLabel.set(n.x,n.y+(isRuin?11:isVillage?14:isHome?10:4),n.z).project(this.camera);n.label.style.display=visible&&point.z>-1&&point.z<1&&Math.abs(point.x)<1.15&&Math.abs(point.y)<1.15?'block':'none';n.label.style.left='0';n.label.style.top='0';n.label.style.transform=`translate3d(${(point.x*.5+.5)*this.container.clientWidth}px,${(-point.y*.5+.5)*this.container.clientHeight}px,0) translate(-50%,-100%)`;
   if(isRuin){const state=caveStatus(n.id,{caves:this.exploration},this.depleted),stamp=[state.entered,state.explored,state.collected].join(':');if(n.labelStamp===stamp)continue;n.labelStamp=stamp;n.label.replaceChildren();const a=document.createElement('span'),b=document.createElement('span'),name=document.createElement('small');a.textContent=state.explored?'◈✓':state.entered?'◈':'◇';a.className=state.entered?'explored':'unexplored';a.title=state.explored?'All chambers explored':state.entered?'Previously entered':'Unexplored';b.textContent=state.cleared?'▣✓':'▣';b.className=state.cleared?'cleared':'supplies';b.title=state.cleared?'All resources gathered':`${state.total-state.collected} resources remain`;name.textContent=n.name;n.label.append(a,b,name);n.label.setAttribute('aria-label',`${n.name}: ${a.title}, ${b.title}`);}
  }
 }
 closest(){
  if(!this.player)return null;const p=this.player;
  if(this.cave){const e=this.caveModel.exit;if(Math.hypot(p.x-e.x,p.z-e.z)<7)return {...e,distance:Math.hypot(p.x-e.x,p.z-e.z)};let best=null,dist=4.5;for(const n of this.caveModel.nodes.values()){if(this.depleted.has(n.id)||n.occupied)continue;const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<dist){dist=d;best={...n,type:'resource',distance:d};}}return best;}
  for(const r of this.ruins.values()){const d=Math.hypot(p.x-r.x,p.z-r.z);if(d<13)return {...r,type:'entrance',distance:d};}
  let best=null,dist=10.5;for(const n of this.npcs.values()){const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<dist){dist=d;best={...n,type:n.role==='smith'?'smith':'npc',distance:d};}}if(best)return best;
  for(const n of this.nodes.values()){if(this.depleted.has(n.id)||n.occupied)continue;const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<dist){dist=d;best={...n,type:'resource',distance:d};}}
  if(!best&&p.house&&Math.hypot(p.x-p.house.doorX,p.z-p.house.doorZ)<8)return {...p.house,type:'home'};return best;
 }
 setQuality(){this.quality=this.quality==='balanced'?'low':'balanced';this.renderer.setPixelRatio(this.quality==='low'?1:Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=this.quality!=='low';return this.quality;}
}
