import * as T from '../vendor/three.module.js';
import {CHUNK,WATER} from './world.js?v=11';
import {TERRAIN_STEP,terrainSurfaceHeight,PATCH_COLORS,environmentFor} from './environment.js?v=19';

import {roadSurfacePlan} from './road-surfaces.js?v=20';

const roadMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const propMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true});
const cachedProps=[];
function clip(poly,value){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=value(a),db=value(b),insideA=da>=-1e-8,insideB=db>=-1e-8;if(insideA)out.push(a);if(insideA!==insideB){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}return out;}
function chunkClip(poly,cx,cz){for(const value of [p=>p.x-cx*CHUNK,p=>(cx+1)*CHUNK-p.x,p=>p.z-cz*CHUNK,p=>(cz+1)*CHUNK-p.z])poly=clip(poly,value);return poly;}
function geometryOf(positions,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;}
function surfaceWriter(cx,cz){
 const positions=[],colors=[],heightCache=new Map();const ground=(x,z)=>{const key=`${x.toFixed(5)}:${z.toFixed(5)}`;if(!heightCache.has(key))heightCache.set(key,terrainSurfaceHeight(x,z));return heightCache.get(key);};
 function emit(poly,tone,bridge=false,lift=0){
  if(poly.length<3)return;const col=new T.Color(tone);
  for(let i=1;i<poly.length-1;i++){const triangle=[poly[0],poly[i+1],poly[i]].map(p=>({x:Math.fround(p.x),z:Math.fround(p.z)})),[a,b,c]=triangle,area=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);if(Math.abs(area)<1e-7)continue;if(area<0)[triangle[1],triangle[2]]=[triangle[2],triangle[1]];
   for(const p of triangle){positions.push(p.x,(bridge?Math.max(WATER+1.06,ground(p.x,p.z)):ground(p.x,p.z)+.035)+lift,p.z);colors.push(col.r,col.g,col.b);}
  }
 }
 function conform(poly,tone,bridge=false,lift=0){if(poly.reduce((area,p,i)=>{const q=poly[(i+1)%poly.length];return area+p.x*q.z-q.x*p.z;},0)<0)poly=poly.slice().reverse();poly=chunkClip(poly,cx,cz);if(poly.length<3)return;const minX=Math.floor(Math.min(...poly.map(p=>p.x))/TERRAIN_STEP),maxX=Math.floor(Math.max(...poly.map(p=>p.x))/TERRAIN_STEP),minZ=Math.floor(Math.min(...poly.map(p=>p.z))/TERRAIN_STEP),maxZ=Math.floor(Math.max(...poly.map(p=>p.z))/TERRAIN_STEP);
  for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){let cell=poly;const x=ix*TERRAIN_STEP,z=iz*TERRAIN_STEP;for(const value of [p=>p.x-x,p=>x+TERRAIN_STEP-p.x,p=>p.z-z,p=>z+TERRAIN_STEP-p.z])cell=clip(cell,value);if(cell.length<3)continue;emit(clip(cell,p=>TERRAIN_STEP-(p.x-x)-(p.z-z)),tone,bridge,lift);emit(clip(cell,p=>(p.x-x)+(p.z-z)-TERRAIN_STEP),tone,bridge,lift);}
 }
 return {conform,finish:()=>geometryOf(positions,colors)};
}
export function buildRoadSurface(cx,cz,pieces=environmentFor(cx,cz).pieces){
 const {conform,finish}=surfaceWriter(cx,cz);
 for(const surface of roadSurfacePlan(pieces))conform(surface.poly,surface.tone,surface.bridge);
 const geometry=finish(),mesh=new T.Mesh(geometry,roadMaterial);mesh.name='worn-freight-roads';mesh.receiveShadow=true;mesh.userData.roadDetail=true;return mesh;
}
export function buildGroundPatches(cx,cz,patches=environmentFor(cx,cz).patches){
 const {conform,finish}=surfaceWriter(cx,cz);
 for(const n of patches){const ring=Array.from({length:7},(_,i)=>{const a=n.phase+i*Math.PI*2/7,r=n.radius*(.75+.25*Math.sin(i*4+n.phase));return {x:n.x+Math.cos(a)*r,z:n.z+Math.sin(a)*r};});conform(ring,PATCH_COLORS[n.biome]);}
 const mesh=new T.Mesh(finish(),roadMaterial);mesh.name='biome-ground-patches';mesh.receiveShadow=true;return mesh;
}
export function environmentGeometry(family){
 if(cachedProps[family])return cachedProps[family];const positions=[],colors=[];
 function part(geo,tone,x=0,y=0,z=0,sx=1,sy=1,sz=1,rz=0){const p=geo.index?geo.toNonIndexed():geo,a=p.attributes.position,c=new T.Color(tone),cs=Math.cos(rz),sn=Math.sin(rz);for(let i=0;i<a.count;i++){const px=a.getX(i)*sx,py=a.getY(i)*sy;positions.push(x+px*cs-py*sn,y+px*sn+py*cs,z+a.getZ(i)*sz);colors.push(c.r,c.g,c.b);}if(p!==geo)p.dispose();geo.dispose();}
 const stone=0x89969b,dark=0x516771,light=0xafb4a3,rock=()=>new T.IcosahedronGeometry(1,0),box=()=>new T.BoxGeometry(1,1,1);
 if(family===0){part(rock(),stone,0,.75,0,1.3,.9,1.1);part(rock(),dark,.85,.28,.4,.65,.45,.7);part(rock(),light,-.75,.32,-.55,.5,.5,.55);}
 if(family===1)for(let i=0;i<4;i++){const a=i*2.4;part(new T.CylinderGeometry(.48,.62,1,5),i%2?dark:stone,Math.cos(a)*.65,.5+(i%3)*.34,Math.sin(a)*.65,.75,1+(i%3)*.68,.75);}
 if(family===2)for(let i=0;i<3;i++){const a=i*2.4;part(new T.ConeGeometry(.42,1,4),i%2?0x849db0:0xa4c2ba,Math.cos(a)*.55,.75+(i%2)*.45,Math.sin(a)*.55,1,1.5+(i%2)*.9,1,(i-1)*.25);}
 if(family===3){part(new T.CylinderGeometry(.25,.7,1,5),dark,0,.45,0,1,1,1);part(rock(),0x718b79,0,1.1,0,1.3,.55,1.1);part(new T.ConeGeometry(.2,1,3),0xb5ad83,.6,1.7,.2,1,1.1,1,.45);}
 if(family===4){part(box(),dark,0,.28,0,2.1,.55,1.1,.15);part(box(),0x9caaa7,-.1,.8,.25,1.6,.15,1.2,-.55);part(new T.CylinderGeometry(.45,.55,1,6),stone,.7,.35,.3,.8,.65,.8);part(box(),0xbda572,-.9,.55,-.3,.3,.8,.3,.2);}
 if(family===5){part(new T.CylinderGeometry(.8,1.15,.7,6),stone,0,.35,0);part(new T.CylinderGeometry(.65,.65,.03,6),dark,0,.72,0);part(new T.ConeGeometry(.35,.8,4),0x95b9a2,.35,.75,.3);}
 if(family===6){part(box(),dark,0,1.35,0,.24,2.7,.24);part(box(),0xabb8ad,0,2.5,0,1.3,.7,.18);part(box(),0xd9b46b,0,2.48,.1,1.05,.12,.03);part(box(),0x729eaa,.1,2.75,.1,.2,.15,.04);part(box(),stone,0,.12,0,.55,.24,.55);}
 if(family===7){part(box(),dark,0,1.1,0,.28,2.2,.28);part(box(),stone,0,2.15,0,2,.12,1.25);part(box(),0x294f67,0,2.23,0,1.85,.04,1.1);for(let i=0;i<4;i++)part(box(),0x7aa6ad,-.65+i*.43,2.26,0,.035,.02,1.05);part(box(),0xd4b379,.7,2.55,0,.1,.55,.1);part(box(),stone,0,.15,0,.7,.3,.7);}
 return cachedProps[family]=geometryOf(positions,colors);
}
export function createEnvironmentBatches(props){
 const batches=[],temp=new T.Object3D(),tints={forest:0x9fbc9f,meadow:0xc0c2a1,marsh:0x92b6a8,desert:0xdbb895,highlands:0xb1aec1,tundra:0xc4dade};
 for(let family=0;family<8;family++){const items=props.filter(n=>n.family===family);if(!items.length)continue;const batch=new T.InstancedMesh(environmentGeometry(family),propMaterial,items.length),matrices=[];batch.name=`environment-${family}`;batch.receiveShadow=true;batch.castShadow=true;batch.userData.environmentDetail=true;
  for(const [i,n]of items.entries()){temp.position.set(n.x,n.y,n.z);temp.rotation.set(0,n.heading,0);temp.scale.setScalar(n.scale);temp.updateMatrix();batch.setMatrixAt(i,temp.matrix);batch.setColorAt(i,new T.Color(tints[n.biome]));matrices.push(temp.matrix.clone());}batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;batch.computeBoundingSphere();batches.push({batch,items,matrices});
 }return batches;
}
