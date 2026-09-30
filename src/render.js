import * as T from '../vendor/three.module.js';
import {CHUNK,REGION,WATER,BIOMES,hash,heightAt,waterDistance,biomeAt,roadSegments,roadDistance,settlement,npcsFor,resourcesFor,nearestSettlement} from './world.js';
const materials={};const mat=(name,color)=>materials[name]||(materials[name]=new T.MeshStandardMaterial({color,roughness:1,flatShading:true}));
const geos={box:new T.BoxGeometry(1,1,1),trunk:new T.CylinderGeometry(.25,.45,1,5),pine:new T.ConeGeometry(1,1,6),rock:new T.IcosahedronGeometry(1,0),sphere:new T.IcosahedronGeometry(1,1),grass:new T.ConeGeometry(1,1,3)};
function mesh(geo,material,x,y,z,sx=1,sy=1,sz=1){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;return m;}
function roofGeo(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([
 -1,0,-1,0,1,-1,1,0,-1, -1,0,1,1,0,1,0,1,1,
 -1,0,-1,0,1,1,0,1,-1, -1,0,-1,-1,0,1,0,1,1,
 1,0,-1,0,1,1,1,0,1, 1,0,-1,0,1,-1,0,1,1
],3));g.computeVertexNormals();return g;}
const roof=roofGeo();
export function avatar(color=0xd5b370){const g=new T.Group();g.add(mesh(geos.pine,mat('cloak'+color,color),0,1,0,.8,1.7,.65));g.add(mesh(geos.sphere,mat('skin',0xcdb392),0,2,0,.37,.4,.37));g.add(mesh(geos.box,mat('pack',0x695338),0,1.3,.45,.65,.7,.3));return g;}
export class WorldRenderer {
 constructor(container,{onWalk,onFrame}){
  this.container=container;this.onWalk=onWalk;this.onFrame=onFrame;this.chunks=new Map();this.nodes=new Map();this.npcs=new Map();this.villages=new Map();this.depleted=new Set();this.others=new Map();this.frame=0;this.keys={};this.player=null;this.target=null;this.yaw=.15;this.zoom=1;this.touchPoints=new Map();this.terrain=[];this.quality='balanced';
  this.scene=new T.Scene();this.scene.background=new T.Color(0x9aada0);this.scene.fog=new T.Fog(0x9aada0,280,580);
  this.camera=new T.PerspectiveCamera(40,1,.3,1500);
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.16;container.append(this.renderer.domElement);
  this.scene.add(new T.HemisphereLight(0xe8f1da,0x536448,2.3));this.sun=new T.DirectionalLight(0xffe5ae,3.1);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-150;this.sun.shadow.camera.right=150;this.sun.shadow.camera.top=150;this.sun.shadow.camera.bottom=-150;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=450;this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.8;this.scene.add(this.sun,this.sun.target);
  this.hero=avatar();this.scene.add(this.hero);
  this.ring=new T.Mesh(new T.RingGeometry(1.2,1.55,32),new T.MeshBasicMaterial({color:0xf4d18c,side:T.DoubleSide,transparent:true,opacity:.8}));this.ring.rotation.x=-Math.PI/2;this.scene.add(this.ring);
  this.destination=new T.Mesh(new T.RingGeometry(1.3,1.5,24),new T.MeshBasicMaterial({color:0xffe2a7,side:T.DoubleSide}));this.destination.rotation.x=-Math.PI/2;this.destination.visible=false;this.scene.add(this.destination);
  this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.temp=new T.Object3D();this.clock=new T.Clock();this.labelContainer=document.getElementById('world-labels');
  this.resize=()=>{this.camera.aspect=container.clientWidth/container.clientHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(container.clientWidth,container.clientHeight);};this.resize();window.addEventListener('resize',this.resize);
  window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;this.keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();});window.addEventListener('keyup',e=>this.keys[e.code]=false);window.addEventListener('blur',()=>this.keys={});
  const c=this.renderer.domElement;c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});this.down={x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,moved:false};if(this.touchPoints.size===2)this.pinch=this.pinchDistance();});
  c.addEventListener('pointermove',e=>{if(!this.touchPoints.has(e.pointerId))return;this.touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.touchPoints.size===2){const d=this.pinchDistance();this.zoom=Math.max(.55,Math.min(2.3,this.zoom*this.pinch/d));this.pinch=d;this.down.moved=true;return;}if(!this.down)return;const dx=e.clientX-this.down.px;if(Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>9)this.down.moved=true;if(this.down.moved)this.yaw-=dx*.005;this.down.px=e.clientX;this.down.py=e.clientY;});
  c.addEventListener('pointerup',e=>{this.touchPoints.delete(e.pointerId);if(this.down&&!this.down.moved&&this.player){const r=c.getBoundingClientRect();this.pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.terrain,false)[0];if(hit)this.onWalk({x:hit.point.x,z:hit.point.z});}this.down=null;});c.addEventListener('pointercancel',()=>{this.touchPoints.clear();this.down=null;});
  c.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.55,Math.min(2.3,this.zoom+e.deltaY*.0007));},{passive:false});
  this.loop=()=>{this.raf=requestAnimationFrame(this.loop);const dt=Math.min(.05,this.clock.getDelta());if(this.player)this.animate(dt);};this.loop();
 }
 pinchDistance(){const a=[...this.touchPoints.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
 setPlayer(p){this.player={...p};this.hero.position.set(p.x,heightAt(p.x,p.z),p.z);this.camera.position.set(p.x+110,p.y+140||heightAt(p.x,p.z)+140,p.z+140);this.stream();}
 setDepleted(ids){this.depleted=new Set(ids);for(const [id,n]of this.nodes)this.showNode(n,!this.depleted.has(id));}
 showNode(n,visible){if(n.instanced){for(const [m,i,matrix]of n.instances){if(visible)m.setMatrixAt(i,matrix);else{const hide=new T.Matrix4().makeScale(0,0,0);m.setMatrixAt(i,hide);}m.instanceMatrix.needsUpdate=true;}}else n.object.visible=visible;}
 setOthers(players){const live=new Set();for(const p of players){if(p.id===this.player?.id)continue;live.add(p.id);let o=this.others.get(p.id);if(!o){o=avatar(0x91b6bb);this.scene.add(o);this.others.set(p.id,o);}o.position.set(p.x,heightAt(p.x,p.z),p.z);}for(const [id,o]of this.others)if(!live.has(id)){this.scene.remove(o);this.others.delete(id);}}
 ground(x,z){if(waterDistance(x,z)<6&&roadDistance(x,z,roadSegments(Math.floor(x/REGION),Math.floor(z/REGION)))<7)return WATER+1.1;return heightAt(x,z);}
 passable(x,z){return waterDistance(x,z)>-3||roadDistance(x,z,roadSegments(Math.floor(x/REGION),Math.floor(z/REGION)))<7;}
 animate(dt){
  const p=this.player;let vx=0,vz=0;
  if(!document.querySelector('dialog[open]')){
   let ax=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0),az=(this.keys.KeyS||this.keys.ArrowDown?1:0)-(this.keys.KeyW||this.keys.ArrowUp?1:0);
   if(ax||az){this.target=null;const len=Math.hypot(ax,az);ax/=len;az/=len;vx=ax*Math.cos(this.yaw)+az*Math.sin(this.yaw);vz=-ax*Math.sin(this.yaw)+az*Math.cos(this.yaw);}
   else if(this.target){const d=Math.hypot(this.target.x-p.x,this.target.z-p.z);if(d<1.2)this.target=null;else{vx=(this.target.x-p.x)/d;vz=(this.target.z-p.z)/d;}}
  }
  const speed=12,dx=vx*dt*speed,dz=vz*dt*speed;let moved=0;
  if(vx||vz){const nx=p.x+dx,nz=p.z+dz;if(this.passable(nx,nz)){p.x=nx;p.z=nz;moved=Math.hypot(dx,dz);this.hero.rotation.y=Math.atan2(vx,vz);}else if(this.passable(nx,p.z)){p.x=nx;moved=Math.abs(dx);}else if(this.passable(p.x,nz)){p.z=nz;moved=Math.abs(dz);}else this.target=null;}
  const y=this.ground(p.x,p.z);this.hero.position.set(p.x,y+Math.sin(this.clock.elapsedTime*12)*Math.min(moved*1.5,.15),p.z);this.ring.position.set(p.x,y+.2,p.z);
  const dist=160*this.zoom,desired=new T.Vector3(p.x+Math.sin(this.yaw)*dist,p.y||y,p.z+Math.cos(this.yaw)*dist);desired.y=y+145*this.zoom;this.camera.position.lerp(desired,1-Math.exp(-dt*6));this.camera.lookAt(p.x,y+3,p.z);
  this.sun.position.set(p.x-85,y+175,p.z-90);this.sun.target.position.set(p.x,y,p.z);
  this.destination.visible=!!this.target;if(this.target)this.destination.position.set(this.target.x,this.ground(this.target.x,this.target.z)+.3,this.target.z);
  if(this.frame++%20===0)this.stream();if(this.frame%10===0)this.labels();this.onFrame({x:p.x,z:p.z,moved,dt});this.renderer.render(this.scene,this.camera);
 }
 stream(){const cx=Math.floor(this.player.x/CHUNK),cz=Math.floor(this.player.z/CHUNK),r=2;
  if(this.cx===cx&&this.cz===cz)return;this.cx=cx;this.cz=cz;
  const want=new Set();const pending=[];
  for(let a=cx-r;a<=cx+r;a++)for(let b=cz-r;b<=cz+r;b++){const key=`${a}:${b}`;want.add(key);if(!this.chunks.has(key))pending.push([a,b]);}
  pending.sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cz)-Math.hypot(b[0]-cx,b[1]-cz));for(const [a,b]of pending)this.addChunk(a,b);
  for(const [key,chunk]of this.chunks)if(!want.has(key)){this.scene.remove(chunk.group);for(const m of chunk.disposable)m.dispose();for(const id of chunk.ids)this.nodes.delete(id);this.chunks.delete(key);}
  this.terrain=[...this.chunks.values()].map(c=>c.terrain);
  const rx=Math.floor(this.player.x/REGION),rz=Math.floor(this.player.z/REGION),vWant=new Set();
  for(let a=rx-1;a<=rx+1;a++)for(let b=rz-1;b<=rz+1;b++){const s=settlement(a,b);if(Math.hypot(s.x-this.player.x,s.z-this.player.z)<CHUNK*3.2){vWant.add(s.id);if(!this.villages.has(s.id))this.addVillage(s);}}
  for(const [id,v]of this.villages)if(!vWant.has(id)){this.scene.remove(v.group);v.label.remove();for(const npc of v.npcs){this.npcs.get(npc.id)?.label.remove();this.npcs.delete(npc.id);}this.villages.delete(id);}
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
  trees.forEach((n,i)=>{const h=7*n.scale,instances=[];for(const [m,y,sx,sy,sz]of [[trunks,n.y+h*.3,.9*n.scale,h*.65,.9*n.scale],[crowns,n.y+h*.75,3.4*n.scale,h,3.4*n.scale]]){this.temp.position.set(n.x,y,n.z);this.temp.rotation.set(0,hash(cx,cz,1000+i)*6.28,0);this.temp.scale.set(sx,sy,sz);this.temp.updateMatrix();m.setMatrixAt(i,this.temp.matrix);instances.push([m,i,this.temp.matrix.clone()]);}crowns.setColorAt(i,new T.Color(BIOMES[n.biome].tree).multiplyScalar(.9+hash(cx,cz,1100+i)*.3));const entry={...n,instanced:true,instances};this.nodes.set(n.id,entry);ids.push(n.id);this.showNode(entry,!this.depleted.has(n.id));});
  for(const n of nodes.filter(n=>n.kind!=='wood')){let object;if(n.kind==='stone'){object=mesh(geos.rock,mat('rock',0x8b9585),n.x,n.y+.9,n.z,1.4*n.scale,1.2*n.scale,1.1*n.scale);}else if(n.kind==='berries'){object=new T.Group();object.position.set(n.x,n.y,n.z);object.add(mesh(geos.sphere,mat('bush',0x496a3d),0,.8,0,1.3,.9,1.3));for(let i=0;i<5;i++)object.add(mesh(geos.sphere,mat('berry',0xb86652),Math.sin(i*2.4),1.1,Math.cos(i*2.4),.22,.22,.22));}else{object=mesh(geos.grass,mat('fiber',0xb4b078),n.x,n.y+.8,n.z,1.1,1.7,1.1);}group.add(object);const entry={...n,object};this.nodes.set(n.id,entry);ids.push(n.id);object.visible=!this.depleted.has(n.id);}
  // Decorative undergrowth does not create collectible duplicates.
  const decor=new T.InstancedMesh(geos.pine,mat('undergrowth',0x587647),90);let count=0;
  for(let i=0;i<90;i++){const x=cx*CHUNK+hash(cx,cz,1400+i*2)*CHUNK,z=cz*CHUNK+hash(cx,cz,1401+i*2)*CHUNK;if(waterDistance(x,z)<24||nearestSettlement(x,z).distance<55||roadDistance(x,z,segments)<7)continue;this.temp.position.set(x,heightAt(x,z)+.5,z);this.temp.scale.set(.45+hash(cx,cz,1600+i),.8, .6);this.temp.updateMatrix();decor.setMatrixAt(count++,this.temp.matrix);}decor.count=count;group.add(decor);disposable.push(decor);
  this.scene.add(group);this.chunks.set(`${cx}:${cz}`,{group,terrain,ids,disposable,cx,cz});
 }
 addVillage(s){const group=new T.Group();
  for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,r=27+hash(s.rx,s.rz,1700+i)*8,x=s.x+Math.cos(angle)*r,z=s.z+Math.sin(angle)*r;const house=new T.Group();house.position.set(x,s.y,z);house.rotation.y=-angle+Math.PI/2;const width=7+hash(s.rx,s.rz,1800+i)*3,depth=7+hash(s.rx,s.rz,1900+i)*4;
   house.add(mesh(geos.box,mat('wall',0xc2b58c),0,2,0,width,4,depth),mesh(roof,mat('roof'+i%3,[0x805e41,0x8c7150,0x626b55][i%3]),0,4,0,width*.61,3,depth*.62),mesh(geos.box,mat('door',0x534b36),0,1.1,depth/2+.08,1.4,2.2,.2),mesh(geos.box,mat('window',0x4a655a),-width*.28,2.6,depth/2+.1,.8,1,.15),mesh(geos.box,mat('chimney',0x77735e),width*.28,5.5,-depth*.2,1,3,1));group.add(house);
  }
  // Central stone well.
  const well=new T.Mesh(new T.CylinderGeometry(2,2,1.1,10),mat('well',0x9a9b81));well.position.set(s.x,s.y+.55,s.z-1);group.add(well);group.add(mesh(geos.box,mat('wellWater',0x406e68),s.x,s.y+1.13,s.z-1,2.7,.05,2.7));
  const npcs=npcsFor(s);for(const n of npcs){const person=avatar([0xb29054,0x6c8c76,0xa5826c][npcs.indexOf(n)]);person.position.set(n.x,n.y,n.z);person.rotation.y=hash(s.rx,s.rz,npcs.indexOf(n)+1900)*6.28;group.add(person);const label=document.createElement('div');label.className='world-label';label.textContent=n.name;this.labelContainer.append(label);this.npcs.set(n.id,{...n,object:person,label});}
  const label=document.createElement('div');label.className='world-label village';label.textContent=s.name;this.labelContainer.append(label);this.villages.set(s.id,{...s,group,npcs,label});this.scene.add(group);
 }
 labels(){for(const n of [...this.npcs.values(),...this.villages.values()]){const distance=Math.hypot(this.player.x-n.x,this.player.z-n.z),isVillage=!!n.npcs,visible=distance<(isVillage?230:38);const point=new T.Vector3(n.x,n.y+(isVillage?14:3.9),n.z).project(this.camera);n.label.style.display=visible&&point.z<1?'block':'none';n.label.style.left=((point.x*.5+.5)*this.container.clientWidth)+'px';n.label.style.top=((-point.y*.5+.5)*this.container.clientHeight)+'px';}}
 closest(){if(!this.player)return null;const p=this.player;let best=null,dist=10.5;for(const n of this.npcs.values()){const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<dist){dist=d;best={...n,type:'npc',distance:d};}}if(best)return best;for(const n of this.nodes.values()){if(this.depleted.has(n.id))continue;const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<dist){dist=d;best={...n,type:'resource',distance:d};}}return best;}
 setQuality(){this.quality=this.quality==='balanced'?'low':'balanced';this.renderer.setPixelRatio(this.quality==='low'?1:Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=this.quality!=='low';return this.quality;}
}
