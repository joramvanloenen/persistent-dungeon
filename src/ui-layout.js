// Keep floating HUD elements clear of the real dock size, and respect the
// visual viewport when a phone keyboard or browser chrome changes its height.
export function installUILayout(doc=document,win=window){
 const root=doc.documentElement,dock=doc.querySelector('.bottom-hud'),viewport=win.visualViewport;
 const update=()=>{
  root.style.setProperty('--viewport-height',`${Math.round(viewport?.height||win.innerHeight)}px`);
  root.style.setProperty('--viewport-top',`${Math.round(viewport?.offsetTop||0)}px`);
  if(dock)root.style.setProperty('--dock-clearance',`${Math.ceil(win.innerHeight-dock.getBoundingClientRect().top)}px`);
 };
 const observer=win.ResizeObserver?new win.ResizeObserver(update):null;if(dock)observer?.observe(dock);
 win.addEventListener('resize',update);viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);update();
 return ()=>{observer?.disconnect();win.removeEventListener('resize',update);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);};
}
