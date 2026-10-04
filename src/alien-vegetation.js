import * as T from '../vendor/three.module.js';

// Three reusable plant archetypes are grown once, then instanced per chunk.
// This keeps the dense forest to three draw calls rather than one per stem.
const archetypes=[[],[]];
const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,side:T.DoubleSide,flatShading:true});
const biomeTint={
 forest:0xb2d0b9,meadow:0xc5d8ab,marsh:0x9dd1c2,
 highlands:0xc1bec1,desert:0xd8b69e,tundra:0xc6d0d5
};

function grow(variant,lowDetail=false){
 let seed=(variant+1)*182761;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const positions=[],colors=[];
 const shade={bark:new T.Color(0x798e80),inner:new T.Color(0x596f6c),vine:new T.Color(0x608a72),knob:new T.Color(0xb49b76),pod:new T.Color(0xe4aa83),seam:new T.Color(0x4e6a67)};
 function triangle(a,b,c,color){for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b);}}
 function tube(points,radii,sides,color){
  const rings=points.map((p,i)=>{const tangent=(i===0?points[1].clone().sub(p):i===points.length-1?p.clone().sub(points[i-1]):points[i+1].clone().sub(points[i-1])).normalize();
   const side=new T.Vector3().crossVectors(tangent,new T.Vector3(0,0,1));if(side.lengthSq()<.001)side.set(1,0,0);side.normalize();const other=new T.Vector3().crossVectors(tangent,side).normalize();
   return Array.from({length:sides},(_,j)=>p.clone().addScaledVector(side,Math.cos(j*2*Math.PI/sides)*radii[i]).addScaledVector(other,Math.sin(j*2*Math.PI/sides)*radii[i]));});
  for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;triangle(rings[i-1][j],rings[i-1][k],rings[i][j],color);triangle(rings[i-1][k],rings[i][k],rings[i][j],color);}
  for(let j=1;j<sides-1;j++){triangle(rings[0][0],rings[0][j+1],rings[0][j],color);triangle(rings.at(-1)[0],rings.at(-1)[j],rings.at(-1)[j+1],color);}
 }
 function bulb(center,size,color){
  const top=center.clone().add(new T.Vector3(0,size.y,0)),bottom=center.clone().add(new T.Vector3(0,-size.y,0)),rings=[];
  for(const y of [-.5,.45])rings.push(Array.from({length:5},(_,i)=>center.clone().add(new T.Vector3(Math.cos(i*2*Math.PI/5)*size.x*(y<0?.8:1),y*size.y,Math.sin(i*2*Math.PI/5)*size.z*(y<0?.8:1)))));
  for(let i=0;i<5;i++){const j=(i+1)%5;triangle(top,rings[1][i],rings[1][j],color);triangle(rings[1][i],rings[0][i],rings[1][j],color);triangle(rings[1][j],rings[0][i],rings[0][j],color);triangle(bottom,rings[0][j],rings[0][i],color);}
 }
 const v=(x,y,z)=>new T.Vector3(x,y,z),arms=variant===0?5:variant===1?4:6,
  trunk=variant===1?[v(0,0,0),v(.23,3,-.18),v(-.18,6,.27),v(.38,9,-.1),v(.1,12,.1)]:variant===2?[v(0,0,0),v(-.16,3,.13),v(.22,5.8,-.15),v(-.3,8.7,.18),v(-.12,11.2,0)]:[v(0,0,0),v(.17,3,.1),v(-.25,6,.03),v(.3,9,-.2),v(0,11.6,0)];
 tube(trunk,[.47,.39,.31,.2,.045],lowDetail?4:6,shade.bark);
 for(let a=0;a<(lowDetail?Math.min(arms,4):arms);a++){
  const angle=a*Math.PI*2/arms+(variant*.5),spread=variant===1?3.9:variant===2?3.3:3.5,
   level=variant===1?3.6+(a%2)*1.9:4.2+(a%3)*1.3,
   dir=v(Math.cos(angle),0,Math.sin(angle)),base=v(.1,level,0),mid=base.clone().addScaledVector(dir,spread*.43).add(v(0,1.5+(a%2)*.4,0)),
   tip=base.clone().addScaledVector(dir,spread*(.82+rnd()*.25)).add(v(0,3.4+(a%3)*.52,0));
  tube([base,mid,tip],[.25,.15,.035],lowDetail?3:5,shade.inner);
  // Secondary feelers rise at odd angles; suspended tendrils sag below the forks.
  const fork=mid.clone().addScaledVector(dir,spread*.2).add(v(0,.95,0));
  if(!lowDetail)tube([mid,fork,fork.clone().add(v((rnd()-.5)*.9,1.2,(rnd()-.5)*.9))],[.12,.075,.015],4,shade.bark);
  const hang=tip.clone().add(v((rnd()-.5)*.3,-1.35,(rnd()-.5)*.3));
  const end=hang.clone().add(v((rnd()-.5)*.5,-1.1-rnd()*.8,(rnd()-.5)*.5));
  if(!lowDetail||a%2===0)tube([tip,hang,end],[.065,.045,.015],3,shade.vine);
  if(!lowDetail||a%2===0)bulb(end.clone().add(v(0,-.35,0)),v(.27+rnd()*.12,.52+rnd()*.2,.25+rnd()*.1),shade.pod);
  if(!lowDetail||a%2===0)bulb(mid.clone().add(v(0,-.1,0)),v(.28,.24,.28),shade.knob);
  for(let j=0;j<(lowDetail?0:2);j++){
   const knot=base.clone().lerp(mid,.3+j*.33);bulb(knot,v(.14,.16,.14),shade.knob);
  }
 }
 bulb(trunk.at(-1),v(.45,.72,.39),shade.pod);
 if(!lowDetail)tube([v(.1,3.2,0),v(-.5,2.4,.36),v(-.72,1.5,.62)],[.08,.06,.012],3,shade.vine);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
 geometry.userData.proceduralAlienPlant=true;return geometry;
}

export function alienPlantGeometry(variant,lowDetail=false){return archetypes[+lowDetail][variant]??=grow(variant,lowDetail);}
export function createAlienVegetationBatch(items,variant,lowDetail=false){
 const batch=new T.InstancedMesh(alienPlantGeometry(variant,lowDetail),material,items.length),temp=new T.Object3D(),matrices=[];
 batch.name=`branching-alien-vegetation-${variant}`;batch.userData.alienVegetation=true;batch.castShadow=false;batch.receiveShadow=true;
 items.forEach((n,i)=>{const h=(n.height||13)/13,rot=((n.x*13.37+n.z*7.91)%6.283+6.283)%6.283;
  temp.position.set(n.x,n.y,n.z);temp.rotation.set(0,rot,0);temp.scale.set(h,h,h);temp.updateMatrix();batch.setMatrixAt(i,temp.matrix);matrices.push(temp.matrix.clone());
  batch.setColorAt(i,new T.Color(biomeTint[n.biome]||biomeTint.meadow));});
 batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;batch.computeBoundingSphere();return {batch,matrices};
}
