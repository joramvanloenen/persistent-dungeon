import {planetAt} from './planets.js?v=11';
import {RESOURCE_NAMES} from './fringe-lore.js?v=24';
import {hash,settlement,smithFor} from './world.js?v=11';
import {resolveDungeon,TILE,cavePathClear} from './dungeons.js?v=11';
export const WEAPONS=Object.freeze([
 {id:'dagger',name:'Vibroknife',fee:4,iron:2,wood:1,hits:10,damage:12,reach:4.4,description:'A compact salvage tool with an oscillating alloy edge.'},
 {id:'sword',name:'Arc blade',fee:7,iron:3,wood:2,hits:14,damage:18,reach:5.5,description:'A field blade with a charged cutting rail and longer reach.'},
 {id:'axe',name:'Breacher axe',fee:9,iron:4,wood:3,hits:16,damage:24,reach:4.8,description:'A reactor-service axe repurposed for close combat.'}
]);
export const HEAT={orangeStart:6000,orangeEnd:9000,ruined:11000};
export function resolveSmith(id){const m=/^v:(-?\d+):(-?\d+):npc:3$/.exec(String(id));return m?smithFor(settlement(+m[1],+m[2])):null;}
export function forgeSpot(job){return Math.floor(hash(job.serial,job.step,9200+(job.mistakes||0))*9);}
export function guardiansFor(d){return d.rooms.filter(r=>r.id>0&&r.id%3===2).map(r=>({id:`${d.id}:warden:${r.id}`,name:'Security automaton',x:(r.cx+.5)*TILE,z:(r.cz+.5)*TILE,space:d.id,health:36,room:r.id}));}
export function dummyFor(s){return {id:`${s.id}:dummy`,name:'Calibration rig',x:s.x+13,z:s.z-11,y:s.y,health:60,space:'overworld',dummy:true};}
export function resolveOpponent(id){const a=/^d:(-?\d+):(-?\d+):warden:(\d+)$/.exec(String(id));if(a){const d=resolveDungeon(`d:${a[1]}:${a[2]}`);return d?guardiansFor(d).find(n=>n.room===+a[3]):null;}const b=/^v:(-?\d+):(-?\d+):dummy$/.exec(String(id));return b?dummyFor(settlement(+b[1],+b[2])):null;}
export function equippedWeapon(p){return p.weapons?.find(w=>w.id===p.equipped)||null;}
export function heatState(job,now=Date.now()){const elapsed=now-job.startedAt;return {elapsed,level:Math.max(0,Math.min(100,elapsed/HEAT.ruined*100)),ready:elapsed>=HEAT.orangeStart&&elapsed<=HEAT.orangeEnd,ruined:elapsed>=HEAT.ruined};}
export function applyActionGame(p,next,a,now){
 let summary='',extra={};const atSmith=id=>{const s=resolveSmith(id);if(p.dungeon||!s||Math.hypot(p.x-s.x,p.z-s.z)>15)throw Error('Walk closer to the fabricator.');return s;};
 const jobAtSmith=()=>{if(!p.forge)throw Error('Pay the fabricator and choose a weapon first.');atSmith(p.forge.smith);return next.forge;};
 switch(a.type){
 case 'smith-buy':{atSmith(a.target);if(p.coins<8)throw Error('You need 8 credits for a material bundle.');next.coins-=8;next.inventory.iron+=2;next.inventory.wood++;summary='Bought 2 alloy fragments and 1 biomass from the fabricator';break;}
 case 'smith-sell':{atSmith(a.target);const count=a.kind==='powerballs'?1:5,credits=a.kind==='powerballs'?12:5;if(!['wood','stone','fiber','powerballs'].includes(a.kind)||p.inventory[a.kind]<count)throw Error('Bring the listed materials to trade.');next.inventory[a.kind]-=count;next.coins+=credits;summary=`Sold ${count} ${RESOURCE_NAMES[a.kind]} for ${credits} credits`;break;}
 case 'refine-powerball':{atSmith(a.target);if(p.inventory.stone<2||p.inventory.iron<1)throw Error('Refining needs 2 silicate and 1 alloy fragment.');next.inventory.stone-=2;next.inventory.iron--;next.inventory.powerballs++;summary='Refined a Powerball';break;}
 case 'forge-start':{const smith=atSmith(a.target),recipe=WEAPONS.find(r=>r.id===a.recipe);if(!recipe)throw Error('Choose a weapon from the catalog.');if(p.forge)throw Error('Finish or abandon your current blank first.');if(p.coins<recipe.fee||p.inventory.iron<recipe.iron||p.inventory.wood<recipe.wood)throw Error('Bring the listed fee, alloy fragments, and biomass.');next.coins-=recipe.fee;next.inventory.iron-=recipe.iron;next.inventory.wood-=recipe.wood;next.forge={smith:smith.id,recipe:recipe.id,serial:p.revision+1,phase:'heat',startedAt:now,step:0,mistakes:0};summary=`Paid ${smith.name} ${recipe.fee} credits to fabricate a ${recipe.name.toLowerCase()}`;break;}
 case 'forge-transfer':{const job=jobAtSmith();if(job.phase!=='heat')throw Error('The blank is not in the induction bay.');const state=heatState(job,now);if(state.elapsed<HEAT.orangeStart)throw Error('The metal is still too cold.');if(state.elapsed>HEAT.orangeEnd){job.phase='failed';summary='The overheated blank sparked and broke apart';}else{job.phase='hammer';job.deadline=now+2000;summary='Brought orange-hot metal to the forming press';}break;}
 case 'forge-strike':{const job=jobAtSmith();if(job.phase!=='hammer'||a.step!==job.step)throw Error('That strike belongs to an earlier step.');const recipe=WEAPONS.find(r=>r.id===job.recipe);if(now>job.deadline||a.spot!==forgeSpot(job)){job.mistakes++;job.step=Math.max(0,job.step-1);if(job.mistakes>=3)job.phase='failed';else job.deadline=now+2000;summary=job.phase==='failed'?'The blank lost its shape. Start heating again.':'Missed the mark. One strike lost.';}else{job.step++;if(job.step>=recipe.hits){const weapon={id:`weapon:${p.id}:${job.serial}`,recipe:recipe.id,name:recipe.name,damage:recipe.damage,reach:recipe.reach};next.weapons.push(weapon);next.equipped=weapon.id;next.forge=null;extra={crafted:weapon};summary=`Fabricated and equipped ${recipe.name}`;}else{job.deadline=now+2000;summary=`Shaped the blank: ${job.step}/${recipe.hits} strikes`;}}break;}
 case 'forge-retry':{const job=jobAtSmith();if(job.phase!=='failed'&&!(job.phase==='heat'&&heatState(job,now).ruined))throw Error('The current blank can still be worked.');Object.assign(job,{phase:'heat',startedAt:now,step:0,mistakes:0});summary='The fabricator replaced the ruined blank. Heating again.';break;}
 case 'forge-abandon':{if(!p.forge)throw Error('You have no paid fabrication job.');next.forge=null;summary='Cancelled the fabrication rental · fee and materials consumed';break;}
 case 'equip':{if(a.weapon!==null&&!p.weapons.some(w=>w.id===a.weapon))throw Error('That weapon is not in your cargo kit.');next.equipped=a.weapon;summary=a.weapon===null?'Put your weapon away':`Equipped ${p.weapons.find(w=>w.id===a.weapon).name}`;break;}
 case 'jump':{if(now-(p.lastJump||0)<900)throw Error('Land before jumping again.');next.lastJump=now;next.actionStats.jumps++;summary='Jumped';break;}
 case 'attack':{
  const weapon=equippedWeapon(p);if(!weapon)throw Error('Equip a fabricated weapon before attacking.');if(now-(p.lastAttack||0)<1100)throw Error('Let your weapon recover.');if(!Number.isFinite(a.heading))throw Error('Choose an attack direction.');next.lastAttack=now;next.actionStats.attacks++;summary=`Swung ${weapon.name}`;
  if(a.target){const foe=resolveOpponent(a.target),pos=p.dungeon||p,space=p.dungeon?.id||'overworld';if(!foe||foe.space!==space)throw Error('That opponent is not here.');const dx=foe.x-pos.x,dz=foe.z-pos.z,distance=Math.hypot(dx,dz);if(distance>weapon.reach||distance>.2&&(dx*Math.sin(a.heading)+dz*Math.cos(a.heading))/distance<.25)throw Error('Face your target and move closer.');if(p.dungeon&&!cavePathClear(resolveDungeon(space),pos,foe))throw Error('A dungeon wall blocks your strike.');let hp=p.combat[foe.id]?.health??foe.health;if(hp<=0){if(!foe.dummy)throw Error('This automaton is already defeated.');hp=foe.health;}hp=Math.max(0,hp-weapon.damage);next.combat[foe.id]={health:hp,lastHit:now};extra={target:foe.id,damage:weapon.damage,health:hp};summary=`Hit ${foe.name} for ${weapon.damage} damage`;
   if(hp===0){next.actionStats.defeated++;if(!foe.dummy){next.coins+=6;next.inventory.iron+=2;summary='Defeated a security automaton · 6 credits and 2 alloy fragments';}else summary='Knocked down the calibration rig';}
   else if(!foe.dummy){const evaded=now-(p.lastJump||0)<1000;next.health=Math.max(0,p.health-(evaded?0:8));extra.retaliation=evaded?0:8;summary+=evaded?' · jumped over its counterattack':' · automaton countered for 8 damage';if(next.health===0){next.health=60;next.dungeon=null;next.x=p.house.doorX;next.z=p.house.doorZ;next.planet=planetAt(next.x,next.z).id;extra.returnedHome=true;summary='The automaton overwhelmed you. You woke at your pod with your supplies.';}}
  }break;
 }
 default:return null;
 }return {summary,extra};
}
