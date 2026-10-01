import {LIMIT,REGION,settlement,hash,nearestSettlement} from './world.js?v=9';
export const PLANET_SPAN=16384;
const names=['Vesper IX','Cinder Reach','Glasswake','Brinefall','Sable Meridian','Spindle','Low Sun','Morrow Ash','Quiet Vector'];
const types=['Cold frontier','Dust basin','Glasslands','Tidal garden','Verdant frontier','Storm belt','Dry frontier','Basalt shelf','Frost basin'];
const colors=[0x6d8690,0xa18c78,0x8a9995,0x739997,0x9aada0,0x868396,0xaa997c,0x77878b,0x8d9fa3];
export function planetFor(gx,gz){if(!Number.isInteger(gx)||!Number.isInteger(gz)||Math.abs(gx)>1||Math.abs(gz)>1)return null;const i=(gz+1)*3+gx+1,x=gx*PLANET_SPAN,z=gz*PLANET_SPAN;return {id:`planet:${gx}:${gz}`,name:names[i],type:types[i],gx,gz,x,z,sky:colors[i],description:'A Drifter colony beacon is active. Surface scans are incomplete.'};}
export function allPlanets(){return Array.from({length:9},(_,i)=>planetFor(i%3-1,Math.floor(i/3)-1));}
export function resolvePlanet(id){const m=/^planet:(-?[01]):(-?[01])$/.exec(String(id));return m?planetFor(+m[1],+m[2]):null;}
export function planetAt(x,z){return planetFor(Math.max(-1,Math.min(1,Math.round(x/PLANET_SPAN))),Math.max(-1,Math.min(1,Math.round(z/PLANET_SPAN))));}
export function planetContains(id,x,z){const p=resolvePlanet(id);return !!p&&Math.abs(x)<=LIMIT&&Math.abs(z)<=LIMIT&&Math.abs(x-p.x)<PLANET_SPAN/2-8&&Math.abs(z-p.z)<PLANET_SPAN/2-8;}
export function landingColony(planet){return settlement(planet.gx*16+1+Math.floor(hash(planet.gx,planet.gz,9801)*3),planet.gz*16+1+Math.floor(hash(planet.gx,planet.gz,9802)*3));}
export function canLaunch(p){if(p.dungeon)return false;return nearestSettlement(p.x,p.z).distance<85||Math.hypot(p.x-p.house.doorX,p.z-p.house.doorZ)<20;}
export function transitFare(p,payment='credits'){if(p.arrivalVoucher>0)return {voucher:true,coins:0,powerballs:0};return payment==='powerball'?{coins:0,powerballs:1}:{coins:4,powerballs:0};}
export function applyTransit(p,next,a,now){
 if(a.type!=='travel-planet')return null;const planet=resolvePlanet(a.target);if(!planet)throw Error('That planetary beacon cannot be found.');if(planet.id===p.planet)throw Error('You are already on this planet.');if(!canLaunch(p))throw Error('Return to a colony or your landing pod to book transit.');if(p.forge)throw Error('Finish or abandon your fabrication job before leaving this planet.');if(a.payment&&!['credits','powerball'].includes(a.payment))throw Error('Choose credits or a Powerball.');
 const fare=transitFare(p,a.payment);if(p.coins<fare.coins||p.inventory.powerballs<fare.powerballs)throw Error('Transit needs 4 credits or 1 Powerball.');next.coins-=fare.coins;next.inventory.powerballs-=fare.powerballs;if(fare.voucher)next.arrivalVoucher--;
 const colony=landingColony(planet);next.x=colony.x+9;next.z=colony.z+15;next.planet=planet.id;next.dungeon=null;next.landing={planet:planet.id,colony:colony.id,at:now};if(!next.visitedPlanets.includes(planet.id))next.visitedPlanets.push(planet.id);if(!next.visited.includes(colony.id))next.visited.push(colony.id);return {summary:`Landed on ${planet.name} · ${colony.name}`,extra:{landed:planet.id,colony:colony.id,fare}};
}
