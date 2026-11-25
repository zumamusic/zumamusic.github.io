const clamp = (value, min, max) => Math.min(Math.max(min, max), Math.max(min, value));
// Match Webamp 2.3.1's snapUtils: edges within 15 logical pixels attach.
const SNAP_DISTANCE = 15;
const near = (a, b) => Math.abs(a - b) < SNAP_DISTANCE;
const panelBox = (id, panel) => ({...panel.position, ...dimensions(id, panel)});
function snapPosition(a, b) {
  let x, y;
  const overlapY = a.y <= b.y + b.height + SNAP_DISTANCE && b.y <= a.y + a.height + SNAP_DISTANCE;
  const overlapX = a.x <= b.x + b.width + SNAP_DISTANCE && b.x <= a.x + a.width + SNAP_DISTANCE;
  if (overlapY) {
    if (near(a.x, b.x + b.width)) x = b.x + b.width;
    else if (near(a.x + a.width, b.x)) x = b.x - a.width;
    else if (near(a.x, b.x)) x = b.x;
    else if (near(a.x + a.width, b.x + b.width)) x = b.x + b.width - a.width;
  }
  if (overlapX) {
    if (near(a.y, b.y + b.height)) y = b.y + b.height;
    else if (near(a.y + a.height, b.y)) y = b.y - a.height;
    else if (near(a.y, b.y)) y = b.y;
    else if (near(a.y + a.height, b.y + b.height)) y = b.y + b.height - a.height;
  }
  return {x, y};
}
function snapOffset(moving, stationary) {
  let x = 0, y = 0;
  for (const a of moving) for (const b of stationary) {
    const snapped = snapPosition(a, b);
    x ||= snapped.x === undefined ? 0 : snapped.x - a.x;
    y ||= snapped.y === undefined ? 0 : snapped.y - a.y;
  }
  return {x, y};
}
export function dimensions(id, panel) {
  return { width: 275 + (id === 'main' || id === 'equalizer' ? 0 : panel.size[0] * 25),
    height: panel.shade ? 14 : 116 + (id === 'main' || id === 'equalizer' ? 0 : panel.size[1] * 29) };
}
export function bounds(panels) {
  const boxes = Object.entries(panels).filter(([,p]) => p.open).map(([id,p]) => ({...p.position,...dimensions(id,p)}));
  const x = Math.min(...boxes.map(p=>p.x)), y = Math.min(...boxes.map(p=>p.y));
  return {x,y,width:Math.max(...boxes.map(p=>p.x+p.width))-x,height:Math.max(...boxes.map(p=>p.y+p.height))-y};
}
export function reposition(panels, from, to, previousBounds = bounds(panels)) {
  const next = bounds(panels);
  const fraction = (position, available) => available > 0 ? clamp(position / available, 0, 1) : .5;
  const x = clamp(fraction(previousBounds.x, from.width-previousBounds.width)*(to.width-next.width),12,to.width-next.width-12);
  const y = clamp(fraction(previousBounds.y, from.height-previousBounds.height)*(to.height-next.height),12,to.height-next.height-12);
  return Object.fromEntries(Object.entries(panels).map(([id,p])=>[id,{x:p.position.x+x-next.x,y:p.position.y+y-next.y}]));
}
export function besidePlayer(panels) {
  const {main,milkdrop} = panels;
  const under = milkdrop.position.y >= main.position.y + dimensions('main',main).height - 8 &&
    Math.abs(milkdrop.position.x-main.position.x) < dimensions('main',main).width;
  if (under) milkdrop.position = {x:main.position.x+275,y:main.position.y};
  return under;
}

export function installMobileLayout({stage,store,getFlags,setFlags,beginLayout,endLayout,env=window}) {
  const mobile = () => env.matchMedia('(pointer: coarse)').matches && Math.min(env.innerWidth,env.innerHeight)<=720;
  const viewport = () => ({width:stage.clientWidth,height:stage.clientHeight});
  const orientation = view => view.width>view.height ? 'landscape' : 'portrait';
  let currentView=viewport(), currentMode=orientation(currentView), frame=0, dragging=null;
  const layouts={};
  const panels=()=>store.getState().windows.genWindows;
  const capture=()=>({panels:structuredClone(panels()),flags:structuredClone(getFlags()),view:{...currentView}});
  function release() {
    if (!dragging) return;
    const old=dragging;dragging=null;
    if(old.target.hasPointerCapture(old.id))old.target.releasePointerCapture(old.id);
  }
  function resize() {
    frame=0;
    if(!mobile()){currentView=viewport();currentMode=orientation(currentView);return;}
    release();
    const nextView=viewport(), nextMode=orientation(nextView);
    const previous=capture();
    let saved=previous;
    if(nextMode!==currentMode){layouts[currentMode]=previous;saved=layouts[nextMode] || previous;}
    const restoring=nextMode!==currentMode && !!layouts[nextMode];
    const next=structuredClone(saved.panels), flags=structuredClone(saved.flags);
    // Visibility is live playback state, not part of the orientation preference.
    for(const [id,p] of Object.entries(panels()))next[id].open=p.open;
    const oldBounds=bounds(next);
    if(nextMode==='landscape' && nextMode!==currentMode && !restoring && besidePlayer(next))flags.detached.milkdrop=false;
    beginLayout(nextMode);
    try {
      setFlags(flags);
      for(const [id,p] of Object.entries(next)) {
        if(id==='milkdrop'||id==='playlist')store.dispatch({type:'WINDOW_SIZE_CHANGED',windowId:id,size:p.size});
      }
      store.dispatch({type:'BROWSER_WINDOW_SIZE_CHANGED',...nextView});
      store.dispatch({type:'UPDATE_WINDOW_POSITIONS',absolute:true,positions:reposition(next,saved.view,nextView,oldBounds)});
      currentView=nextView;currentMode=nextMode;
    } finally {endLayout();}
  }
  function schedule(event) {
    if(!mobile())return;
    // Webamp's resize fallback resets oversized groups to a stack at the top.
    // Handle only mobile resizing here; desktop keeps the native behavior.
    event?.stopImmediatePropagation();
    if(frame)env.cancelAnimationFrame(frame);
    frame=env.requestAnimationFrame(resize);
  }
  function titleTarget(target) {
    const title=target.classList.contains('draggable') ? target : null;
    if(!title || target.closest('button,a,input,#close,#minimize,#shade,#gen-close'))return null;
    const panel=title.closest('.window');
    const id=panel?.id==='main-window'?'main':panel?.id==='equalizer-window'?'equalizer':panel?.id?.startsWith('playlist-window')?'playlist':panel?.classList.contains('gen-window')?'milkdrop':null;
    return id ? {id,title} : null;
  }
  function down(event) {
    if(!mobile() || event.pointerType!=='touch' || event.isPrimary===false)return;
    const hit=titleTarget(event.target);if(!hit)return;
    event.preventDefault();
    const all=structuredClone(panels());
    const moving=new Set([hit.id]);
    if(hit.id==='main') {
      // Carry attached panels and user-arranged panels that still touch them.
      let changed=true;
      while(changed){changed=false;for(const [id,p] of Object.entries(all)) {
        if(!p.open||moving.has(id))continue;
        for(const other of moving){
          const snapped=snapPosition(panelBox(id,p),panelBox(other,all[other]));
          if(snapped.x!==undefined||snapped.y!==undefined) {moving.add(id);changed=true;break;}
        }
      }}
    }
    const stationary=Object.entries(all).filter(([id,p])=>p.open&&!moving.has(id)).map(([id,p])=>panelBox(id,p));
    dragging={id:event.pointerId,target:hit.title,windowId:hit.id,x:event.clientX,y:event.clientY,all,moving,stationary};
    hit.title.setPointerCapture(event.pointerId);
    store.dispatch({type:'SET_FOCUSED_WINDOW',window:hit.id});
  }
  function move(event) {
    const drag=dragging;if(!drag||drag.id!==event.pointerId)return;
    event.preventDefault();
    const group=Object.fromEntries([...drag.moving].map(id=>[id,drag.all[id]]));
    const box=bounds(group),view=viewport(),anchor=drag.all[drag.windowId],size=dimensions(drag.windowId,anchor);
    // An oversized stack must remain movable: constrain its title, not its full height.
    const fitY=drag.windowId==='main' && box.height<=view.height-16;
    const minX=-size.width*.5-anchor.position.x, maxX=view.width-size.width*.5-anchor.position.x;
    const minY=8-(fitY?box.y:anchor.position.y), maxY=view.height-24-(fitY?box.y+box.height:anchor.position.y);
    const proposedX=clamp(event.clientX-drag.x,minX,maxX);
    const proposedY=clamp(event.clientY-drag.y,minY,maxY);
    const moving=[...drag.moving].map(id=>{
      const original=panelBox(id,drag.all[id]);
      return {...original,x:original.x+proposedX,y:original.y+proposedY};
    });
    const snap=snapOffset(moving,drag.stationary);
    const dx=clamp(proposedX+snap.x,minX,maxX);
    const dy=clamp(proposedY+snap.y,minY,maxY);
    store.dispatch({type:'UPDATE_WINDOW_POSITIONS',positions:Object.fromEntries([...drag.moving].map(id=>[id,{x:drag.all[id].position.x+dx,y:drag.all[id].position.y+dy}]))});
  }
  const up=event=>{if(dragging?.id===event.pointerId)release();};
  const nativeStart=event=>{if(mobile()&&titleTarget(event.target))event.stopPropagation();};
  env.addEventListener('resize',schedule,true);
  stage.addEventListener('pointerdown',down,true);
  stage.addEventListener('touchstart',nativeStart,{capture:true,passive:false});
  env.addEventListener('pointermove',move,true);
  env.addEventListener('pointerup',up,true);
  env.addEventListener('pointercancel',up,true);
  env.addEventListener('blur',release);
  const observer=new ResizeObserver(()=>{if(mobile()&&(stage.clientWidth!==currentView.width||stage.clientHeight!==currentView.height))schedule();});
  observer.observe(stage);
  return Object.assign(()=>{
    release();observer.disconnect();if(frame)env.cancelAnimationFrame(frame);
    env.removeEventListener('resize',schedule,true);stage.removeEventListener('pointerdown',down,true);stage.removeEventListener('touchstart',nativeStart,true);
    env.removeEventListener('pointermove',move,true);env.removeEventListener('pointerup',up,true);env.removeEventListener('pointercancel',up,true);env.removeEventListener('blur',release);
  }, {resize:schedule});
}
