(() => {
  const sign = document.querySelector('.dock-sign');
  const dock = document.querySelector('.zuma-dock');
  if (!sign || !dock) return;

  const portrait = matchMedia('(max-width: 680px) and (orientation: portrait) and (pointer: coarse)');
  const minimum = 32.5;
  const maximum = 52.5;
  const defaultWidth = 40;
  const clamp = value => Math.min(maximum, Math.max(minimum, value));
  let width = defaultWidth;
  let gesture = null;
  // Keep adjustments for this visit only; every reload starts at the default.

  function paint() {
    dock.style.setProperty('--portrait-dock-width', `${width}vw`);
    sign.setAttribute('aria-valuenow', String(Math.round((width - minimum) / (maximum - minimum) * 100)));
    sign.setAttribute('aria-valuetext', `${Math.round((width - minimum) / (maximum - minimum) * 100)}% extra dock spacing`);
  }

  function finish(commit) {
    if (!gesture) return;
    const previous = gesture;
    gesture = null;
    clearTimeout(previous.timer);
    if (!commit) width = previous.width;
    if (portrait.matches) paint();
    dock.classList.remove('is-adjusting-dock');
    if (sign.hasPointerCapture(previous.id)) sign.releasePointerCapture(previous.id);
  }

  function syncMode() {
    finish(false);
    if (portrait.matches) {
      sign.setAttribute('role', 'slider');
      sign.setAttribute('tabindex', '0');
      sign.setAttribute('aria-label', 'Dock spacing. Drag left to widen, right to narrow.');
      sign.setAttribute('aria-orientation', 'horizontal');
      sign.setAttribute('aria-valuemin', '0');
      sign.setAttribute('aria-valuemax', '100');
      paint();
    } else {
      dock.style.removeProperty('--portrait-dock-width');
      for (const name of ['role', 'tabindex', 'aria-label', 'aria-orientation', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) sign.removeAttribute(name);
    }
  }

  sign.addEventListener('pointerdown', event => {
    if (!portrait.matches || event.pointerType !== 'touch' || event.isPrimary === false || gesture) return;
    event.preventDefault();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, width, active: false };
    sign.setPointerCapture(event.pointerId);
    gesture.timer = setTimeout(() => {
      if (!gesture) return;
      gesture.active = true;
      dock.classList.add('is-adjusting-dock');
    }, 180);
  });

  sign.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.active) {
      const dx = Math.abs(event.clientX - gesture.x);
      const dy = Math.abs(event.clientY - gesture.y);
      // A deliberate sideways pull can engage immediately, without a long hold.
      if (dx >= 6 && dx > dy * 1.25) {
        clearTimeout(gesture.timer);
        gesture.active = true;
        dock.classList.add('is-adjusting-dock');
      } else {
        if (dy > 10) finish(false);
        return;
      }
    }
    event.preventDefault();
    width = clamp(gesture.width + (gesture.x - event.clientX) / innerWidth * 100);
    paint();
  });

  sign.addEventListener('pointerup', event => {
    if (gesture?.id === event.pointerId) finish(true);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    sign.addEventListener(type, event => {
      if (gesture?.id === event.pointerId) finish(false);
    });
  }
  sign.addEventListener('contextmenu', event => {
    if (portrait.matches) event.preventDefault();
  });
  sign.addEventListener('keydown', event => {
    if (!portrait.matches) return;
    if (event.key === 'Escape') { finish(false); return; }
    const next = { ArrowLeft: width + 2, ArrowRight: width - 2, Home: minimum, End: maximum }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    width = clamp(next);
    paint();
  });
  window.addEventListener('blur', () => finish(false));
  window.addEventListener('resize', () => finish(false));
  portrait.addEventListener('change', syncMode);
  syncMode();
})();
