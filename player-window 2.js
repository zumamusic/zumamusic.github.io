(() => {
  const trigger = document.querySelector('#dock-player-trigger');
  const layer = document.querySelector('#player-layer');
  const frame = document.querySelector('#player-frame');
  const manager = window.ZumaWindowManager;
  const dock = document.querySelector('.zuma-dock');
  const status = document.querySelector('#player-launch-status');
  const statusText = status.querySelector('span');
  const retry = status.querySelector('button');
  let state = 'closed';
  let session = '';
  let startupTimer = 0;
  let boundDocument = null;
  let refreshBounds = () => {};
  let disconnect = () => {};

  manager.register('player', {
    window: frame,
    layer,
    embedded: true,
    restoreLabel: 'Player',
    taskIcon: 'dock-playlist.png',
    onClose() {
      disconnect();
      state = 'closed';
      session = '';
      clearTimeout(startupTimer);
      boundDocument = null;
      refreshBounds = () => {};
      status.hidden = true;
      trigger.removeAttribute('aria-busy');
      layer.style.clipPath = 'inset(50%)';
      trigger.setAttribute('aria-pressed', 'false');
      // Unload the document so closing also stops audio and visualizers.
      frame.removeAttribute('src');
      manager.restoreFocus(trigger);
    },
  });

  function failStartup() {
    if (state !== 'loading') return;
    state = 'failed';
    clearTimeout(startupTimer);
    trigger.removeAttribute('aria-busy');
    statusText.textContent = 'Player is taking longer to open.';
    retry.hidden = false;
  }

  function openPlayer() {
    manager.open('player');
    trigger.setAttribute('aria-pressed', 'true');
    if (state === 'closed' || state === 'failed') {
      disconnect();
      boundDocument = null;
      refreshBounds = () => {};
      layer.style.clipPath = 'inset(50%)';
      state = 'loading';
      session = crypto.randomUUID();
      status.hidden = false;
      statusText.textContent = 'Opening player…';
      retry.hidden = true;
      trigger.setAttribute('aria-busy', 'true');
      clearTimeout(startupTimer);
      startupTimer = setTimeout(failStartup, 20000);
      frame.src = `player/index.html?v=20261017-dock&session=${session}`;
    } else refreshBounds();
  }

  // An iframe cannot pass taps through its transparent body. Clip its host to
  // the actual visible panels, without changing Webamp's viewport or layout.
  // This same-origin adapter bridges focus and the host's taskbar controls.
  function connectFrame() {
    if (state === 'closed' || !frame.hasAttribute('src')) return;
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc?.body || new URL(doc.URL).searchParams.get('session') !== session) return;
    if (doc === boundDocument) { refreshBounds(); return; }
    disconnect();
    boundDocument = doc;
    let scheduled = 0;
    let gesture = false;
    let dockDrag = null;
    let previousPath = '';
    let disposed = false;
    const panels = '#webamp .window, .zuma-mini-player, .zuma-mini-dock, #webamp-context-menu .context-menu';

    function syncBounds() {
      if (scheduled) cancelAnimationFrame(scheduled);
      scheduled = 0;
      if (disposed || layer.hidden) return;
      const paths = [];
      doc.querySelectorAll(panels).forEach(panel => {
        const style = view.getComputedStyle(panel);
        const rect = panel.getBoundingClientRect();
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return;
        const left = Math.floor(rect.left);
        const top = Math.floor(rect.top);
        const right = Math.ceil(rect.right);
        const bottom = Math.ceil(rect.bottom);
        paths.push(`M${left} ${top}H${right}V${bottom}H${left}Z`);
      });
      const path = gesture ? 'none' : paths.length ? `path('${paths.join(' ')}')` : 'inset(50%)';
      if (path !== previousPath) {
        layer.style.clipPath = path;
        previousPath = path;
      }
    }
    function scheduleBounds() {
      if (!disposed && !scheduled) scheduled = requestAnimationFrame(syncBounds);
    }
    function activatePlayer() { manager.activate('player'); }
    function pointerDown(event) {
      // Webamp owns motion inside the iframe; the host owns minimizing. Track
      // raw titlebar travel so its viewport clamp doesn't block the extra pull.
      const title = event.target.closest('#main-window #title-bar, .zuma-mini-titlebar');
      if (title && event.isPrimary !== false && (event.pointerType !== 'mouse' || event.button === 0) &&
          !event.target.closest('button, a, input, #minimize, #shade, #close, #option')) {
        const panel = title.closest('#main-window, .zuma-mini-player');
        const rect = panel.getBoundingClientRect();
        const frameTop = frame.getBoundingClientRect().top;
        dockDrag = { id: event.pointerId, title, y: event.clientY + frameTop,
          distance: window.ZumaDockDrop.distance({ height: rect.height, bottom: rect.bottom + frameTop }, dock.getBoundingClientRect().top) };
      }
      manager.setInputMode('pointer');
      activatePlayer();
      // Keep drags/sliders captured even when the pointer outruns a panel.
      gesture = true;
      syncBounds();
    }
    function endGesture() {
      dockDrag = null;
      dock.classList.remove('is-drop-target');
      gesture = false;
      scheduleBounds();
    }
    function trackDockDrag(event, fromHost = false) {
      if (!dockDrag || dockDrag.id !== event.pointerId) return;
      const y = event.clientY + (fromHost ? 0 : frame.getBoundingClientRect().top);
      const commit = y - dockDrag.y >= dockDrag.distance;
      dock.classList.toggle('is-drop-target', commit);
      if (!commit) return;
      const drag = dockDrag;
      endGesture();
      // Finish native mouse, mobile, and compact drags before hiding their
      // document, so restoring cannot leave a stale drag attached to the cursor.
      drag.title.dispatchEvent(new view.PointerEvent('pointercancel', { bubbles: true, pointerId: event.pointerId, pointerType: event.pointerType }));
      if (drag.title.hasPointerCapture?.(event.pointerId)) drag.title.releasePointerCapture(event.pointerId);
      view.dispatchEvent(new view.MouseEvent('mouseup', { bubbles: true }));
      manager.minimize('player');
    }
    function frameMove(event) { trackDockDrag(event); }
    function hostMove(event) { trackDockDrag(event, true); }
    function frameUp(event) { trackDockDrag(event); endGesture(); }
    function hostUp(event) {
      if (!gesture) return;
      const title = dockDrag?.title;
      trackDockDrag(event, true);
      // A mouse can leave the iframe before release. Clear Webamp's native drag
      // even when that release fell short of the dock threshold.
      if (title) view.dispatchEvent(new view.MouseEvent('mouseup', { bubbles: true }));
      endGesture();
    }
    function keyDown(event) {
      manager.setInputMode('keyboard');
      if (event.key === 'Escape' && manager.isActive('player')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        manager.close('player');
      }
    }
    function hostControls(event) {
      if (!event.target.closest('#main-window #minimize, .zuma-mini-minimize')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      endGesture();
      manager.minimize('player');
    }

    const observer = new MutationObserver(scheduleBounds);
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    const resizeObserver = new ResizeObserver(scheduleBounds);
    resizeObserver.observe(doc.body);
    doc.addEventListener('pointerdown', pointerDown, true);
    doc.addEventListener('pointermove', frameMove, true);
    doc.addEventListener('pointerup', frameUp, true);
    document.addEventListener('pointermove', hostMove, true);
    document.addEventListener('pointerup', hostUp, true);
    document.addEventListener('pointercancel', endGesture, true);
    doc.addEventListener('pointercancel', endGesture, true);
    doc.addEventListener('focusin', activatePlayer);
    doc.addEventListener('keydown', keyDown, true);
    doc.addEventListener('click', hostControls, true);
    view.addEventListener('blur', endGesture);
    view.addEventListener('resize', scheduleBounds);
    const hostObserver = new MutationObserver(scheduleBounds);
    hostObserver.observe(layer, { attributes: true, attributeFilter: ['hidden'] });
    refreshBounds = syncBounds;
    syncBounds();
    disconnect = () => {
      disposed = true;
      observer.disconnect();
      hostObserver.disconnect();
      resizeObserver.disconnect();
      cancelAnimationFrame(scheduled);
      doc.removeEventListener('pointerdown', pointerDown, true);
      doc.removeEventListener('pointermove', frameMove, true);
      doc.removeEventListener('pointerup', frameUp, true);
      document.removeEventListener('pointermove', hostMove, true);
      document.removeEventListener('pointerup', hostUp, true);
      document.removeEventListener('pointercancel', endGesture, true);
      endGesture();
      doc.removeEventListener('pointercancel', endGesture, true);
      doc.removeEventListener('focusin', activatePlayer);
      doc.removeEventListener('keydown', keyDown, true);
      doc.removeEventListener('click', hostControls, true);
      view.removeEventListener('blur', endGesture);
      view.removeEventListener('resize', scheduleBounds);
    };
  }

  frame.addEventListener('load', connectFrame);
  frame.addEventListener('error', failStartup);
  retry.addEventListener('click', openPlayer);
  trigger.addEventListener('dragstart', event => event.preventDefault());
  trigger.addEventListener('click', openPlayer);
  addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.source !== 'zuma-player') return;
    // WindowProxy survives iframe navigation: reject messages from a previous launch.
    if (!session || event.data.session !== session) return;
    if (event.data.type === 'boot') connectFrame();
    if (event.data.type === 'ready') {
      state = 'ready';
      clearTimeout(startupTimer);
      trigger.removeAttribute('aria-busy');
      status.hidden = true;
      connectFrame();
    }
    if (event.data.type === 'error') failStartup();
    if (event.data.type === 'close') manager.close('player');
  });
})();
