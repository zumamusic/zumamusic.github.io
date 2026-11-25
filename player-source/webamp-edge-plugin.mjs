// A narrow, version-checked build adaptation: keep Webamp's native grouping,
// snapping, and vertical constraints; relax only its horizontal viewport edge.
export default function webampEdges() {
  const original = 'e.x-Qy<0?n=0:e.x+e.width+Qy>t.width&&(n=t.width-e.width)';
  const replacement = 'e.x<-e.width*.5?n=-e.width*.5:e.x+e.width*.5>t.width&&(n=t.width-e.width*.5)';
  return {
    name: 'zuma-webamp-horizontal-edges',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/webamp.butterchurn-bundle.min.mjs')) return null;
      if (code.split(original).length !== 2) throw new Error('Webamp edge adaptation needs review for this dependency version');
      code = code.replace(original, replacement);
      const patches = [
        // Expose scale in Redux so native drag grouping/snapping sees physical
        // bounds. Renderers keep logical pixel sizes; CSS zoom supplies scale.
        ['windows:(e=wf,t)=>{switch(t.type){', 'windows:(e=wf,t)=>{switch(t.type){case"ZUMA_SET_WINDOW_SCALES":return {...e,genWindows:Object.fromEntries(Object.entries(e.genWindows).map(([id,w])=>[id,{...w,zumaScale:t.scales[id]||1}]))};'],
        ['ey=qf(Xx,wx,$x,(e,t,n)=>n.map(n=>({key:n,...e[n],...t[n]})))', 'ey=qf(Xx,wx,$x,gx,(e,t,n,w)=>n.map(n=>({key:n,...e[n],width:e[n].width*(w[n].zumaScale||1),height:e[n].height*(w[n].zumaScale||1),...t[n]})))'],
        // Native Playlist/visualizer grips measure movement in logical pixels.
        ['const s=ff(t)-o.x,i=xf(t)-o.y,l=[Math.max(0,n+Math.round(s/25))', 'const s=(ff(t)-o.x)/(o.scale||1),i=(xf(t)-o.y)/(o.scale||1),l=[Math.max(0,n+Math.round(s/25))'],
        ['l({x:ff(e),y:xf(e)}),i(!0)', 'l({x:ff(e),y:xf(e),scale:parseFloat(getComputedStyle(e.currentTarget.closest(".window")).zoom)||1}),i(!0)'],
      ];
      for (const [before, after] of patches) {
        if (code.split(before).length !== 2) throw new Error('Webamp scaling adaptation needs review for this dependency version');
        code = code.replace(before, after);
      }
      return { code, map: null };
    }
  };
}
