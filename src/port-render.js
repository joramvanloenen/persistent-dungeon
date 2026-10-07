import * as T from '../vendor/three.module.js';
import {landingBay} from './landing-port.js?v=24';
const box=new T.BoxGeometry(1,1,1),tank=new T.CylinderGeometry(1,1,1,8),cone=new T.ConeGeometry(1,1,8),materials=new Map();
function material(color,lit=false){const key=`${color}:${lit}`;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,flatShading:true,roughness:.85,...(lit?{emissive:color,emissiveIntensity:.7}:{})}));return materials.get(key);}
function part(g,geometry,color,x,y,z,sx,sy,sz,lit=false){const m=new T.Mesh(geometry,material(color,lit));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=!lit;m.receiveShadow=true;g.add(m);return m;}
export function buildSkiff(variant=0){
 const g=new T.Group(),hull=[0x9aaca6,0xb1a38d,0x748b96][variant%3];
 part(g,box,hull,0,2,0,4.2,2.1,7);part(g,box,0x425e69,0,2.5,3.3,3,.9,1.6);part(g,box,0x253f50,0,2.9,3.55,2.6,.45,1.45);part(g,box,0x516970,0,1.4,-.4,9,.4,3.6);
 for(const x of [-4,4]){const engine=part(g,tank,0x506771,x,1.6,0,.85,4.3,.85);engine.rotation.x=Math.PI/2;part(g,box,hull,x,2.05,0,1.4,.3,2.7);const nozzle=part(g,tank,0x253f4b,x,1.5,-2.1,.62,.55,.62);nozzle.rotation.x=Math.PI/2;part(g,box,0xe0a36b,x,2.23,0,.4,.08,2.7);}
 for(const x of [-1.6,1.6])for(const z of [-2.8,2.8]){part(g,box,0x354950,x,.65,z,.2,1.2,.2);part(g,box,0x60787b,x,.1,z,1.1,.18,1.2);}
 part(g,box,0xc7b785,0,3.17,-.7,.7,.05,3);part(g,box,0x72cbc1,-2.2,2.4,2,.12,.25,.4,true);
 const hatch=part(g,box,hull,2.3,1.45,2,.15,1.6,1.4),ramp=part(g,box,0x697e83,3.5,.6,4.8,3,.12,1.3);ramp.rotation.z=-.18;
 const jets=[];for(const x of [-4,4]){const jet=part(g,cone,0x76ced5,x,-1,0,.48,3,.48,true);jet.rotation.z=Math.PI;jets.push(jet);}
 g.userData={hatch,ramp,jets};return g;
}
export function updateSkiff(g,state){g.visible=state.visible;g.position.set(state.x,state.y,state.z);g.userData.hatch.visible=!state.hatchOpen;g.userData.ramp.visible=state.hatchOpen;for(const jet of g.userData.jets){jet.visible=state.enginePower>0;jet.scale.y=1.4+state.enginePower*2.2;}}
export function buildLandingBay(s){const bay=landingBay(s),g=new T.Group();g.position.set(bay.x,bay.y,bay.z);
 part(g,box,0x52686d,0,.025,0,14,.05,13);part(g,box,0x778987,0,.062,0,10,.025,10);
 for(const x of [-6.5,6.5])for(const z of [-5.8,5.8])part(g,box,0x75c9bd,x,.12,z,.65,.15,.65,true);
 for(const x of [-5.5,5.5])part(g,box,0xc1aa76,x,.086,0,.4,.01,8);
 for(const x of [-1.4,1.4])part(g,box,0xbccdc0,x,.085,0,.3,.01,4);part(g,box,0xbccdc0,0,.085,0,2.8,.01,.3);
 // Recovered freight containers and a beacon frame the working bay.
 part(g,box,0x47646e,-6,1.2,-4,1,2.4,2);part(g,box,0x73c3bd,-6,2.6,-4,.7,.25,.7,true);part(g,box,0x877f6c,-6,.4,4,1.2,.8,1.2);part(g,box,0x738886,-6,1.1,4,.9,.65,.9);
 return g;
}
export function buildPortFacilities(s,houses){const g=new T.Group();
 // Supply kiosk: transparent counter frontage, fuel cylinders behind it.
 part(g,box,0x576d73,s.x+18,s.y+1,s.z+4,3,2,2);part(g,box,0x83948d,s.x+18,s.y+2.7,s.z+4.4,4,.25,3.5);part(g,box,0x72c1b7,s.x+18,s.y+2,s.z+5.02,2.2,.3,.05,true);
 for(const x of [-.8,.8])part(g,tank,0xb19c77,s.x+18+x,s.y+1,s.z+3.8,.4,2,.4);
 // Mark existing reclaimed hulls as a bar and short-stay crew quarters.
 for(const [i,color]of [[2,0xe2a17b],[5,0x75b8c9]]){const h=houses[i],sign=new T.Group();sign.position.set(h.x,s.y,h.z);sign.rotation.y=h.rotation;part(sign,box,0x2a414b,0,3.1,h.depth/2+.06,3,.7,.14);for(const x of [-.8,0,.8])part(sign,box,color,x,3.1,h.depth/2+.15,.35,.35,.08,true);g.add(sign);}
 return g;
}
