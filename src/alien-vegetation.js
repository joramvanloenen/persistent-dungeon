import * as T from '../vendor/three.module.js';

// All species share one opaque vertex-color material. No textures or per-part meshes.
export const PLANT_FAMILIES=[
 {name:'Lantern spire',height:13,canopy:true},{name:'Hanging arch',height:12,canopy:true},
 {name:'Cushion crown',height:9,canopy:true},{name:'Sail umbrella',height:18,canopy:true},
 {name:'Coiled tendril',height:7,canopy:true},{name:'Bladder colony',height:15,canopy:true},
 {name:'Shard rosette',height:1.2},{name:'Tube coral',height:2.4},
 {name:'Spore cushions',height:1.3},{name:'Nutrient nest',height:2.2},{name:'Ribbon reeds',height:2.8}
];
const roundedShells=[new T.IcosahedronGeometry(1,0),new T.OctahedronGeometry(1,0)];
const cache=[[],[]],material=new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide,flatShading:true});
export const BIOME_TINT={forest:0xb2d0b9,meadow:0xc5d8ab,marsh:0x9dd1c2,highlands:0xc1bec1,desert:0xd8b69e,tundra:0xc6d0d5};
const palette={stem:0x6f918a,dark:0x405f68,pod:0xeaaa85,knot:0xbba676,sail:0x93bab0,edge:0xb0a1b3};
const v=(x,y,z)=>new T.Vector3(x,y,z);
function grow(family,far){
 const positions=[],colors=[],colorCache={};
 function tri(a,b,c,tone){const col=colorCache[tone]??=new T.Color(palette[tone]);for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);colors.push(col.r,col.g,col.b);}}
 function tube(points,radii,sides=3,tone='stem'){
  const rings=points.map((p,i)=>{const direction=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize(),u=new T.Vector3().crossVectors(direction,v(0,0,1));if(u.lengthSq()<.001)u.set(1,0,0);u.normalize();const w=new T.Vector3().crossVectors(direction,u).normalize();return Array.from({length:sides},(_,j)=>p.clone().addScaledVector(u,Math.cos(j*2*Math.PI/sides)*radii[i]).addScaledVector(w,Math.sin(j*2*Math.PI/sides)*radii[i]));});
  for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(rings[i-1][j],rings[i-1][k],rings[i][j],tone);tri(rings[i-1][k],rings[i][k],rings[i][j],tone);}
 }
 // An octahedron is an eight-triangle seed pod, swelling, or spore sac.
 function pod(p,s,tone='pod'){const ring=[v(s[0],0,0),v(0,0,s[2]),v(-s[0],0,0),v(0,0,-s[2])].map(q=>q.add(p)),top=p.clone().add(v(0,s[1],0)),bottom=p.clone().add(v(0,-s[1],0));for(let i=0;i<4;i++){tri(top,ring[i],ring[(i+1)%4],tone);tri(bottom,ring[(i+1)%4],ring[i],tone);}}
 // A closed icosahedron gives a rounded silhouette in 20 triangles (eight distant).
 function roundPod(p,size,tone='pod'){
  const shell=roundedShells[+far].attributes.position;
  for(let i=0;i<shell.count;i+=3){const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(shell,i+j).multiply(v(...size)).add(p)),shade=points.reduce((sum,q)=>sum+q.y-p.y,0)<-size[1]*.8?'dark':tone;tri(...points,shade);}
 }
 function blade(root,tip,width,tone='sail'){const side=v(tip.z-root.z,0,root.x-tip.x).normalize().multiplyScalar(width),mid=root.clone().lerp(tip,.6);tri(root,mid.clone().add(side),tip,tone);tri(root,tip,mid.clone().sub(side),tone);}
 if(family<3){
  const tall=PLANT_FAMILIES[family].height;
  tube([v(0,0,0),v(.12,tall*.36,0),v(-.25,tall*.7,.12),v(.15,tall-.65,0)],[.45,.34,.2,.03],far?3:4);
  const arms=family===2?(far?2:3):(far?3:4);
  for(let i=0;i<arms;i++){const a=i*2*Math.PI/arms+.4,dir=v(Math.cos(a),0,Math.sin(a)),base=v(0,tall*(.32+(i%2)*.12),0),mid=base.clone().addScaledVector(dir,family===1?2.1:1.5).add(v(0,family===1?4:1.8,0)),tip=base.clone().addScaledVector(dir,family===2?3.8:3).add(v(0,family===1?1.6:3,0));
   tube([base,mid,tip],[.22,.12,.02],3);
   const end=tip.clone().addScaledVector(dir,.35).add(v(0,-2.2,0));tube([tip,tip.clone().addScaledVector(dir,.5).add(v(0,-.6,0)),end],[.045,.035,.01],3,'dark');if(family===2){roundPod(end,[1.5,1.3,1.4],'edge');roundPod(mid,[2,1.6,1.8],'sail');}else{pod(end,[.36,.6,.32]);if(!far)pod(mid,[.32,.32,.3],'knot');}
  }
  if(family===2)roundPod(v(.15,tall-1.5,0),[2.4,1.5,2.2],'sail');else pod(v(.15,tall-.65,0),[.43,.65,.43]);
 }else if(family===3){
  tube([v(0,0,0),v(.15,7,.1),v(-.4,13,0),v(.2,17,0)],[.45,.36,.25,.06],4);
  const n=far?4:6;for(let i=0;i<n;i++){const a=i*2*Math.PI/n,r=4.6,tip=v(Math.cos(a)*r,14+(i%2),Math.sin(a)*r);blade(v(.2,17,0),tip,1.3,i%2?'sail':'edge');if(!far){tube([tip,tip.clone().add(v(.1,-3,0))],[.04,.01],3,'dark');pod(tip.clone().add(v(.1,-3,0)),[.25,.5,.25]);}}
  pod(v(.2,17.55,0),[.38,.45,.38],'knot');
 }else if(family===4){
  const points=[v(0,0,0),v(0,2.2,0)],n=far?5:9;for(let i=0;i<=n;i++){const a=i/n*Math.PI*1.65;points.push(v(Math.sin(a)*1.75,4.5-Math.cos(a)*2.1,Math.sin(a*.5)*.4));}
  tube(points,points.map((_,i)=>.4*(1-i/(points.length+1))+.025),far?3:4);pod(points.at(-1),[.55,.62,.48],'edge');if(!far)for(let i=3;i<points.length;i+=3)pod(points[i],[.28,.28,.25],'knot');
 }else if(family===5){
  tube([v(0,0,0),v(.1,5,0),v(-.1,10,.15),v(.1,14,0)],[.45,.28,.18,.03],4);
  for(let i=0;i<(far?3:5);i++){const y=3.3+i*(far?4:2.45),a=i*2.4,p=v(Math.cos(a)*.7,y,Math.sin(a)*.7);tube([v(0,y-1,0),p],[.14,.06],3);roundPod(p,[2.1,1.9,1.8],i%2?'edge':'pod');}roundPod(v(.1,13.6,0),[1.8,1.4,1.65],'knot');
 }else if(family===6){
  for(let i=0;i<(far?4:7);i++){const a=i*2.4,r=.65+(i%3)*.16;blade(v(0,.03,0),v(Math.cos(a)*r,.6+(i%3)*.3,Math.sin(a)*r),.22,i%2?'sail':'edge');}pod(v(0,.25,0),[.16,.25,.16],'knot');
 }else if(family===7){
  for(let i=0;i<(far?2:4);i++){const a=i*2.4,x=Math.cos(a)*.35,z=Math.sin(a)*.35,h=1.2+(i%3)*.5;const end=v(x*2,h,z*2);tube([v(x,0,z),v(x*1.4,h*.55,z*1.4),end],[.23,.28,.3],3,'edge');tri(end.clone().add(v(-.2,-.02,0)),end.clone().add(v(.1,-.02,.19)),end.clone().add(v(.1,-.02,-.19)),'dark');}
 }else if(family===8){
  for(let i=0;i<(far?1:2);i++){const a=i*2.4,p=v(Math.cos(a)*.65,.5+(i%2)*.2,Math.sin(a)*.65);roundPod(p,[1.15,.65,1.05],i%2?'pod':'edge');}
 }else if(family===9){
  for(let i=0;i<(far?1:2);i++){const a=i*2.4,end=v(Math.cos(a)*.7,.85+(i%2)*.45,Math.sin(a)*.7);blade(v(0,0,0),end,.45,'stem');roundPod(end,[1,.85,.9]);}
 }else{
  for(let i=0;i<(far?3:6);i++){const a=i*2.4,root=v(Math.cos(a)*.3,0,Math.sin(a)*.3),tip=v(root.x+.3*Math.sin(a),1.2+(i%3)*.6,root.z+.4);blade(root,tip,.13,i%2?'sail':'stem');}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData.proceduralAlienPlant=true;return geometry;
}
export function alienPlantGeometry(family,far=false){return cache[+far][family]??=grow(family,far);}
function seed(n){let h=Math.imul(Math.round(n.x*17),374761393)^Math.imul(Math.round(n.z*19),668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
const canopyByBiome={forest:[0,1,2,3,5],meadow:[0,2,3,4],marsh:[1,3,4,5],desert:[2,4,5],highlands:[0,2,4],tundra:[0,4,5]};
export function alienPlacement(n,role='tree'){
 const r=seed(n),list=role==='tree'?(canopyByBiome[n.biome]||canopyByBiome.meadow):role==='berries'?[9]:role==='fiber'?[10]:role==='shrub'?[7,9]:role==='flowers'?[8,9]:[6,8,10],family=list[Math.floor(r*list.length)],base=PLANT_FAMILIES[family];
 return {...n,family,height:base.height*(.78+r*.4),widthScale:role==='tree'?(n.scale||1):.75+r*.55};
}
export function createAlienVegetationBatch(items,family,far=false){
 const batch=new T.InstancedMesh(alienPlantGeometry(family,far),material,items.length),temp=new T.Object3D(),matrices=[];
 batch.name=`alien-${PLANT_FAMILIES[family].name.toLowerCase().replaceAll(' ','-')}`;batch.userData={alienVegetation:true,variant:family,lowDetail:far};batch.receiveShadow=true;batch.castShadow=!!PLANT_FAMILIES[family].canopy&&!far;
 items.forEach((n,i)=>{temp.position.set(n.x,n.y,n.z);temp.rotation.set(0,seed(n)*Math.PI*2,0);temp.scale.set(n.widthScale||1,(n.height||PLANT_FAMILIES[family].height)/PLANT_FAMILIES[family].height,n.widthScale||1);temp.updateMatrix();batch.setMatrixAt(i,temp.matrix);matrices.push(temp.matrix.clone());batch.setColorAt(i,new T.Color(BIOME_TINT[n.biome]||BIOME_TINT.meadow));});
 batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;batch.computeBoundingSphere();return {batch,matrices};
}
