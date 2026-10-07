import {hash,settlement,REGION,LIMIT} from './world.js?v=11';

// Reuse the original shuttle plot. Existing homes, terrain and resource IDs stay put.
export function landingBay(s){return {id:`${s.id}:bay`,x:s.x,z:s.z+13,y:s.y,width:14,depth:13};}
export function shipVisitor(s){const names=['Juno','Cass','Tavi','Iris','Dex','Miko','Pax','Zuri'];return {id:`${s.id}:pilot`,name:names[Math.floor(hash(s.rx,s.rz,9610)*names.length)],role:'pilot',visitor:true,home:s.id,village:s.name,affiliation:hash(s.rx,s.rz,9611)>.5?'Independent Drifters':'Dugall contract pilot',shipId:`${s.id}:skiff`,shipName:['Loose Bolt','Second Chance','Dust Finch','Wayward'][Math.floor(hash(s.rx,s.rz,9612)*4)],x:s.x+3.2,z:s.z+18.2,y:s.y};}
export function portBroker(s){return {id:`${s.id}:broker`,name:['Eli','Reva','Nox','Uma'][Math.floor(hash(s.rx,s.rz,9613)*4)],role:'keeper',broker:true,home:s.id,village:s.name,affiliation:'Independent Drifters',x:s.x-10,z:s.z+3,y:s.y};}
export function resolvePortPerson(id){const m=/^v:(-?\d+):(-?\d+):(pilot|broker)$/.exec(String(id));if(!m||Math.abs(+m[1]*REGION)>LIMIT||Math.abs(+m[2]*REGION)>LIMIT)return null;const s=settlement(+m[1],+m[2]);return m[3]==='pilot'?shipVisitor(s):portBroker(s);}
export function parkedShipObstacles(ship){if(!ship?.parked)return [];return [{id:`${ship.id}:hull`,x:ship.x,z:ship.z,width:4.5,depth:8.5,rotation:0},...[-4,4].map(x=>({id:`${ship.id}:engine:${x}`,x:ship.x+x,z:ship.z,width:1.8,depth:4.5,rotation:0}))];}
