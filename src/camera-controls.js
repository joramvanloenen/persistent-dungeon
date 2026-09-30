export const CAMERA_LIMITS=Object.freeze({minPitch:.32,caveMinPitch:.55,maxPitch:1.22,defaultPitch:.73});
export function wrapAngle(angle){return Math.atan2(Math.sin(angle),Math.cos(angle));}
export function clampPitch(pitch,cave=false){return Math.max(cave?CAMERA_LIMITS.caveMinPitch:CAMERA_LIMITS.minPitch,Math.min(CAMERA_LIMITS.maxPitch,pitch));}
// Interpolate angles on the orbit, never a chord through the player.
export function advanceOrbit(current,target,dt,cave=false){
 const alpha=1-Math.exp(-Math.max(0,Math.min(.1,dt))*10);
 return {yaw:wrapAngle(current.yaw+wrapAngle(target.yaw-current.yaw)*alpha),pitch:clampPitch(current.pitch+(clampPitch(target.pitch,cave)-current.pitch)*alpha,cave)};
}
export function orbitPosition(focus,orbit,radius){
 const horizontal=Math.cos(orbit.pitch)*radius;
 return {x:focus.x+Math.sin(orbit.yaw)*horizontal,y:focus.y+Math.sin(orbit.pitch)*radius,z:focus.z+Math.cos(orbit.yaw)*horizontal};
}
