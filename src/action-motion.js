export function advanceMotion(m,dt,{running=false,moving=false}={}){
 const stamina=m.stamina??100;if(stamina<=1)m.exhausted=true;if(stamina>=25||!running)m.exhausted=false;const run=running&&moving&&!m.exhausted&&stamina>1;m.stamina=Math.max(0,Math.min(100,stamina+(run?-24:18)*dt));
 m.height??=0;m.velocity??=0;m.swing=Math.max(0,(m.swing||0)-dt);
 if(m.height>0||m.velocity>0){m.velocity-=22*dt;m.height=Math.max(0,m.height+m.velocity*dt);if(!m.height)m.velocity=0;}
 return {running:run,height:m.height,stamina:m.stamina};
}
export function beginJump(m){if((m.height||0)>0||(m.velocity||0)>0||(m.stamina??100)<20)return false;m.velocity=9;m.stamina=(m.stamina??100)-20;return true;}
