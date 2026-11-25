// Desktop panels share one scale; phones retain the original solo-player rule.
export const DESKTOP_DEFAULT_SCALE = 1.75;
export function scalePolicy({ mobile, solo, requested, width }) {
  const scale = Math.min(requested, Math.max(1, width - 16) / 275);
  return { main: mobile && !solo ? 1 : scale, panels: mobile ? 1 : scale,
    enabled: !mobile || solo };
}
export function installPlayerScaling({ stage, store, onScale, env = window }) {
  const root = stage.querySelector('#webamp');
  const main = stage.querySelector('#main-window');
  const mobile = () => env.matchMedia('(pointer: coarse)').matches && Math.min(env.innerWidth, env.innerHeight) <= 720;
  let requested = mobile() ? 1 : DESKTOP_DEFAULT_SCALE;
  let current = null, pointer = null, frame = 0, syncing = false, previousPanelScale = null;
  const grips = new Map();
  function addGrip(panel, label) {
    if (!panel || grips.has(panel)) return;
    const grip = document.createElement('button');
    grip.type = 'button'; grip.className = 'zuma-main-resize-grip';
    grip.setAttribute('aria-label', label);
    grip.addEventListener('pointerdown', down);
    panel.appendChild(grip); grips.set(panel, grip);
  }
  function sync() {
    if (syncing) return;
    syncing = true;
    try {
      const panels = store.getState().windows.genWindows;
      const solo = panels.main.open && !panels.equalizer.open && !panels.playlist.open && !panels.milkdrop.open;
      const isMobile = mobile();
      current = scalePolicy({ mobile: isMobile, solo, requested, width: stage.clientWidth });
      for (const [panel, grip] of grips) {
        if (!root.contains(panel)) { grip.removeEventListener('pointerdown', down); grips.delete(panel); }
      }
      addGrip(main, 'Resize player');
      addGrip(stage.querySelector('#equalizer-window'), 'Resize equalizer and player');
      for (const [panel, grip] of grips) {
        const isEq = panel.id === 'equalizer-window';
        grip.hidden = isEq && isMobile;
        grip.disabled = !current.enabled;
        grip.title = current.enabled ? (isEq ? 'Drag to scale equalizer and player together' : 'Drag to resize player') : 'Close EQ, Playlist, and visualizer to resize';
      }
      if (!current.enabled) release();
      root.style.setProperty('--zuma-panel-scale', String(current.panels));
      main.style.setProperty('--zuma-panel-scale', String(current.main));
      if (previousPanelScale !== current.panels) {
        previousPanelScale = current.panels;
        onScale(current.panels);
      }
      const scales = Object.fromEntries(Object.keys(panels).map(id => [id, id === 'main' ? current.main : current.panels]));
      if (Object.entries(scales).some(([id, scale]) => (panels[id].zumaScale || 1) !== scale)) {
        store.dispatch({ type: 'ZUMA_SET_WINDOW_SCALES', scales });
      }
    } finally { syncing = false; }
  }
  function down(event) {
    if (event.currentTarget.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); event.stopPropagation();
    pointer = { id: event.pointerId, target: event.currentTarget, x: event.clientX, y: event.clientY, scale: current.main };
    pointer.target.setPointerCapture?.(event.pointerId);
  }
  function move(event) {
    if (pointer?.id !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    requested = Math.round(Math.max(.7, Math.min(2.4, pointer.scale + (dx * 275 + dy * 116) / (275 ** 2 + 116 ** 2))) * 100) / 100;
    if (!frame) frame = env.requestAnimationFrame(() => { frame = 0; sync(); });
  }
  function release() {
    const old = pointer; pointer = null;
    if (old?.target.hasPointerCapture?.(old.id)) old.target.releasePointerCapture(old.id);
  }
  function up(event) {
    if (pointer?.id !== event.pointerId) return;
    release();
    if (frame) { env.cancelAnimationFrame(frame); frame = 0; sync(); }
  }
  env.addEventListener('pointermove', move, true);
  env.addEventListener('pointerup', up, true);
  env.addEventListener('pointercancel', up, true);
  const unsubscribe = store.subscribe(sync);
  // EQ is mounted on demand; add its grip after React commits the panel.
  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  const resizeObserver = new ResizeObserver(sync); resizeObserver.observe(stage);
  sync();
  return { sync, dispose() {
    release(); env.cancelAnimationFrame(frame); unsubscribe(); observer.disconnect(); resizeObserver.disconnect();
    env.removeEventListener('pointermove', move, true); env.removeEventListener('pointerup', up, true); env.removeEventListener('pointercancel', up, true);
    for (const grip of grips.values()) { grip.removeEventListener('pointerdown', down); grip.remove(); }
  } };
}
