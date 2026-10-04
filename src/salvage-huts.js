import * as T from '../vendor/three.module.js';

// Every part stays inside the existing house footprint. The original village and
// home IDs, plot positions, front doors, and collision shapes remain valid.
const box=new T.BoxGeometry(1,1,1);
const cylinder=new T.CylinderGeometry(1,1,1,12);
const cone=new T.ConeGeometry(1,1,12);
const sphere=new T.SphereGeometry(1,10,6);
const materials={};
function metal(name,color,emissive=0){return materials[name]??=new T.MeshStandardMaterial({color,roughness:.82,metalness:.32,emissive,emissiveIntensity:emissive?.6:0,flatShading:true});}
const palette={
 frame:metal('charred chassis',0x344b54),burnt:metal('burnt engine',0x25353b),
 weld:metal('visible welds',0x667981),hatch:metal('pressure hatch',0x3a525a),
 glass:metal('recovered viewport',0x3b7783,0x08272e),solar:metal('salvaged solar cells',0x294658),
 wire:metal('insulated cables',0x233f4c),hazard:metal('faded hazard paint',0xc69657),
 rust:metal('oxidised steel',0x9b654a),light:metal('beacon light',0x85bab6,0x1b5755),
 screen:metal('working terminal',0x74bac1,0x1a626b),dust:metal('dusty alloy',0x8b9e9d)
};
const skins=[metal('freight hull',0xb2bab0),metal('weathered ceramic',0x9caeae),metal('old booster paint',0xc1ab88),metal('patched ferry hull',0x8aa7a5)];
function piece(group,name,shape,mat,x,y,z,sx,sy,sz,rotate){const m=new T.Mesh(shape,mat);m.name=name;m.position.set(x,y,z);m.scale.set(sx,sy,sz);if(rotate)m.rotation.set(...rotate);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function beam(g,name,mat,x,y,z,sx,sy,sz,rotate){return piece(g,name,box,mat,x,y,z,sx,sy,sz,rotate);}
function pipe(g,name,mat,x,y,z,radius,length,axis='y'){return piece(g,name,cylinder,mat,x,y,z,radius,length,radius,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:null);}
function connectedCable(g,name,points){for(let i=1;i<points.length;i++){const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]),direction=b.clone().sub(a),cable=pipe(g,name,palette.wire,0,0,0,.075,direction.length());cable.position.copy(a.add(b).multiplyScalar(.5));cable.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());}}

/** A collection of re-used ship components; centered on an existing plot. */
export function salvageHut(width,depth,style=0,owned=false){
 const g=new T.Group(),variant=style%3,skin=skins[style%skins.length],front=depth/2;
 g.name=owned?'reclaimed-landing-pod':'drifter-salvage-hut';g.userData.hullType=['freighter-booster','escape-stage','cargo-capsule'][variant];
 const foot=width*.37;
 // Landing skids and old hull sections replace the earlier house-shaped block.
 for(const x of [-foot,foot])beam(g,'salvage landing skid',palette.frame,x,.35,0,.36,.7,depth*.83);
 for(const z of [-depth*.29,depth*.29])beam(g,'cross braced undercarriage',palette.weld,0,.55,z,width*.78,.22,.3);
 if(variant===0){
  const length=width*.76,r=Math.min(2.12,depth*.31);
  pipe(g,'horizontal rocket booster hull',skin,0,2.7,-.38,r,length,'x');
  for(const x of [-length*.39,length*.39])pipe(g,'welded booster retaining collar',palette.frame,x,2.7,-.38,r+.13,.25,'x');
  pipe(g,'burnt engine throat',palette.burnt,-length*.5-.14,2.7,-.38,r*.74,.46,'x');
  pipe(g,'exposed exhaust nozzle',palette.rust,-length*.5-.42,2.7,-.38,r*.48,.28,'x');
  beam(g,'reused heat shield',palette.rust,length*.22,4.4,-.45,length*.31,.12,depth*.4,[0,0,.13]);
  if(owned){pipe(g,'auxiliary spent booster',palette.rust,width*.36,2.2,-depth*.2,.58,3.5);pipe(g,'auxiliary booster collar',palette.frame,width*.36,3.2,-depth*.2,.67,.16);piece(g,'auxiliary booster cap',cone,palette.burnt,width*.36,4.22,-depth*.2,.59,.8,.59);}
 }else if(variant===1){
  const r=Math.min(width*.32,depth*.3);
  pipe(g,'upright rocket booster tank',skin,0,3.25,-.65,r,5.35);
  piece(g,'booster nose cone',cone,palette.dust,0,6.12,-.65,r*.91,1.3,r*.91);
  pipe(g,'blackened thrust bell',palette.burnt,0,.57,-.65,r*.75,.72);
  for(const x of [-r*.85,r*.85])beam(g,'recovered stabilizer fin',palette.rust,x,1.5,-1.3,.26,2.4,1.25);
  pipe(g,'secondary fuel tank',palette.rust,width*.36,2.65,-depth*.19,.63,3.45);
  for(const y of [1.55,3.72])pipe(g,'tank clamp',palette.frame,width*.36,y,-depth*.19,.72,.13);
 }else{
  const r=Math.min(width*.29,2.05),length=depth*.72;
  pipe(g,'crashed cargo capsule',skin,0,2.65,-.35,r,length,'z');
  for(const z of [-length*.41,length*.41])pipe(g,'cargo bulkhead rib',palette.frame,0,2.65,z,r+.12,.24,'z');
  beam(g,'bolted freight container',palette.dust,width*.34,1.85,-.6,width*.27,2.6,depth*.55,[0,0,-.11]);
  for(const z of [-1.3,0,.7])beam(g,'container reinforcement',palette.frame,width*.34,1.85,z,width*.27+.05,.11,.12);
  piece(g,'damaged capsule nose',cone,palette.rust,0,2.65,-length*.5-.1,r*.72,.9,r*.72,[Math.PI/2,0,0]);
 }
 // The welded airlock reaches the old front face, so the saved doorstep remains usable.
 beam(g,'welded pressure-lock vestibule',palette.frame,0,1.91,front-.93,2.75,3.55,1.94);
 beam(g,'recovered pressure hatch',palette.hatch,0,1.65,front+.055,1.8,2.75,.12);
 beam(g,'hatch viewport',palette.glass,0,2.35,front+.13,1.1,.44,.06);
 for(const x of [-1.09,1.09]){
  beam(g,'hatch locking rail',palette.weld,x,1.6,front+.14,.13,2.7,.1);
  beam(g,'faded yellow door marker',palette.hazard,x,3.37,front+.16,.13,.3,.11);
 }
 beam(g,'recovered boarding ramp',palette.dust,0,.24,front+.79,2.2,.14,1.45,[.07,0,0]);
 for(const x of [-.7,0,.7])beam(g,'ramp traction strip',palette.frame,x,.32,front+.91,.11,.03,1.1);
 // A conspicuous powered cabinet, cooling vents, loose conduit and roof arrays.
 const panelX=-width*.33,boxZ=depth*.11;
 beam(g,'external electronics cabinet',palette.frame,panelX,1.62,boxZ,1.1,2.5,1.12);
 beam(g,'working circuit board',palette.screen,panelX,1.93,boxZ+.59,.79,.79,.06);
 for(const x of [-.22,0,.22])beam(g,'circuit trace',palette.wire,panelX+x,1.94,boxZ+.64,.055,.54,.02);
 for(const y of [.72,.91,1.1])beam(g,'vent slats',palette.weld,panelX,y,boxZ+.61,.76,.07,.045);
 connectedCable(g,'exposed power umbilical',[[panelX,2.35,boxZ-.3],[panelX-.12,3.1,-.5],[-width*.08,4.25,-1],[-width*.02,4.7,-1]]);
 const solarX=width*.24,solarZ=-depth*.2,solarY=variant===1?5.35:5.24;
 beam(g,'salvaged solar array',palette.solar,solarX,solarY,solarZ,width*.38,.11,depth*.46,[0,0,-.2]);
 for(let n=-1;n<=1;n++)beam(g,'solar cell bus',palette.weld,solarX+n*width*.105,solarY+.075,solarZ,.06,.025,depth*.4,[0,0,-.2]);
 pipe(g,'communications antenna',palette.frame,width*.35,6.45,-depth*.27,.065,2.8);
 piece(g,'directional comms dish',sphere,palette.dust,width*.35,7.75,-depth*.27,.52,.13,.52,[.4,0,.25]);
 piece(g,'colony beacon',sphere,owned?palette.light:palette.hazard,width*.35,7.98,-depth*.27,.16,.16,.16);
 beam(g,'serial plate',palette.hazard,width*.33,1.25,front+.07,.47,.15,.045);
 // Farther away the craft silhouette remains, while small hardware can skip draw calls.
 const silhouette=/landing skid|undercarriage|booster hull|booster tank|booster nose|thrust bell|engine throat|exhaust nozzle|cargo capsule|cargo bulkhead rib|freight container|pressure-lock vestibule|pressure hatch|solar array|communications antenna/;
 g.userData.detailMeshes=g.children.filter(m=>!silhouette.test(m.name));
 return g;
}
