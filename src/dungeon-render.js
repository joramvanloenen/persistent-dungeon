import * as T from '../vendor/three.module.js';
import {containsPowerball} from './fringe-lore.js?v=11';
import {TILE,caveWalkable} from './dungeons.js?v=11';
const box=new T.BoxGeometry(1,1,1),rock=new T.IcosahedronGeometry(1,0),cylinder=new T.CylinderGeometry(1,1,1,7);
function material(color,emissive=0){return new T.MeshStandardMaterial({color,roughness:.95,flatShading:true,emissive,emissiveIntensity:1.4});}
function m(geo,mat,x,y,z,sx,sy,sz){const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
export function buildDungeon(d){
 const group=new T.Group(),nodes=new Map(),torches=[],disposable=[],temp=new T.Object3D();
 const palettes=[[0x73878d,0x3d5966,0x20343e],[0x829494,0x506875,0x263f48],[0x8994a2,0x536775,0x263847]],p=palettes[d.style];
 const floorMat=material(p[0]),wallMat=material(p[1]),darkMat=material(0x172831),stoneMat=material(0x70858d),woodMat=material(0x728e8c),clothMat=material(0x90a5a4),crystalMat=material(0x61a397,0x16382c),foodMat=material(0x9f735f),fireMat=material(0x7fd0cf,0x2a959c);disposable.push(floorMat,wallMat,darkMat,stoneMat,woodMat,clothMat,crystalMat,foodMat,fireMat);
 const powerMat=material(0xe8bf62,0x9a6920);disposable.push(powerMat);
 const floorTiles=[],wallTiles=[];
 for(let z=0;z<d.height;z++)for(let x=0;x<d.width;x++){if(d.cells[z*d.width+x])floorTiles.push([x,z]);else if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>d.cells[(z+dz)*d.width+x+dx]))wallTiles.push([x,z]);}
 const floors=new T.InstancedMesh(box,floorMat,floorTiles.length),walls=new T.InstancedMesh(box,wallMat,wallTiles.length);floors.receiveShadow=true;walls.castShadow=true;walls.receiveShadow=true;
 for(const [i,[x,z]]of floorTiles.entries()){temp.position.set((x+.5)*TILE,-.16,(z+.5)*TILE);temp.scale.set(TILE-.04,.32,TILE-.04);temp.rotation.set(0,0,0);temp.updateMatrix();floors.setMatrixAt(i,temp.matrix);const tint=.88+((x*13+z*17)%11)/65;floors.setColorAt(i,new T.Color(tint,tint,tint));}
 for(const [i,[x,z]]of wallTiles.entries()){temp.position.set((x+.5)*TILE,1.05,(z+.5)*TILE);temp.scale.set(TILE,2.1,TILE);temp.updateMatrix();walls.setMatrixAt(i,temp.matrix);}group.add(floors,walls);disposable.push(floors,walls);
 const rayGeo=new T.PlaneGeometry(d.width*TILE,d.height*TILE),rayMat=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});const rayFloor=new T.Mesh(rayGeo,rayMat);rayFloor.rotation.x=-Math.PI/2;rayFloor.position.set(d.width*TILE/2,.015,d.height*TILE/2);group.add(rayFloor);disposable.push(rayGeo,rayMat);
 for(const room of d.rooms){
  const x=(room.x+1.5)*TILE,z=(room.z+1.5)*TILE;
  const pillar=m(cylinder,stoneMat,x,1.4,z,.75,2.8,.75);group.add(pillar);
  const brazier=m(cylinder,darkMat,x+2,.6,z,.45,1.2,.45),fire=m(rock,fireMat,x+2,1.4,z,.32,.65,.32);group.add(brazier,fire);torches.push(fire);
  for(let i=0;i<4;i++){const px=(room.x+2+(i*3.7)%(room.w-4))*TILE,pz=(room.z+room.h-1.7)*TILE;group.add(m(rock,stoneMat,px,.28,pz,.55,.45,.45));}
  if(room.id>0){const altar=m(box,darkMat,room.cx*TILE,.45,(room.z+room.h-2)*TILE,4,.9,1.7);group.add(altar,m(box,crystalMat,room.cx*TILE,1.2,(room.z+room.h-2)*TILE,2,.65,.15));}
 }
 for(const node of d.nodes){const g=new T.Group();g.position.set(node.x,0,node.z);
  if(node.kind==='stone'){for(let i=0;i<4;i++){const stone=m(rock,crystalMat,Math.sin(i*2)*.6,.5+ i*.14,Math.cos(i*2)*.6,.35,.8+i*.2,.35);stone.rotation.z=.3*i;g.add(stone);}}
  else if(node.kind==='wood'){g.add(m(box,woodMat,0,.6,0,1.7,1.2,1.3));g.add(m(box,darkMat,0,1.22,0,1.72,.08,1.32));}
  else if(node.kind==='fiber'){g.add(m(cylinder,clothMat,0,.35,0,.6,.7,.6),m(cylinder,clothMat,.7,.3,.2,.4,.6,.4));}
  else{g.add(m(box,woodMat,0,.35,0,1.3,.7,.9));for(let i=0;i<3;i++)g.add(m(rock,foodMat,(i-1)*.3,.9,0,.25,.3,.25));}
  if(containsPowerball(node))g.add(m(rock,powerMat,0,1.75,0,.5,.5,.5));group.add(g);nodes.set(node.id,{...node,object:g});
 }
 for(let i=0;i<7;i++)group.add(m(box,stoneMat,d.entrance.x,-.1+i*.12,d.entrance.z-1.8+i*.38,4,.3,.4));
 const exit=new T.Group();exit.position.set(d.entrance.x,0,d.entrance.z);exit.add(m(box,stoneMat,-2.2,2,0,.65,4,.7),m(box,stoneMat,2.2,2,0,.65,4,.7),m(box,stoneMat,0,4,0,5,.7,.8));group.add(exit);
 return {group,nodes,rayFloor,torches,disposable,exit:{id:'dungeon-exit',type:'exit',x:d.entrance.x,z:d.entrance.z,name:'Access lock to the surface'}};
}
export function findCavePath(d,start,end){
 if(!caveWalkable(d,end.x,end.z))return null;const sx=Math.floor(start.x/TILE),sz=Math.floor(start.z/TILE),ex=Math.floor(end.x/TILE),ez=Math.floor(end.z/TILE),source=sz*d.width+sx,target=ez*d.width+ex;
 const parent=new Int32Array(d.cells.length).fill(-1),queue=[source];parent[source]=source;
 for(let head=0;head<queue.length;head++){const v=queue[head];if(v===target)break;const x=v%d.width,z=Math.floor(v/d.width);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,n=nz*d.width+nx;if(nx<0||nz<0||nx>=d.width||nz>=d.height||!d.cells[n]||parent[n]!==-1)continue;parent[n]=v;queue.push(n);}}
 if(parent[target]===-1)return null;const out=[];let v=target;while(v!==source){out.push({x:(v%d.width+.5)*TILE,z:(Math.floor(v/d.width)+.5)*TILE});v=parent[v];}out.reverse();out.push(end);return out;
}
