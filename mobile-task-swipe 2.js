(() => {
  const list = document.querySelector('#dock-task-list');
  if (!list) return;
  const mobile = matchMedia('(pointer: coarse) and (max-width: 960px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let gesture = null, frame = 0, position = 0, velocity = 0, maximum = 0;
  let suppressClickUntil = 0, scrollAnchor = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const now = () => performance.now();
  function measure() {
    const children = [...list.children];
    return Math.max(0, ...children.map(child => child.offsetLeft + child.offsetWidth - list.clientWidth));
  }
  function paint() {
    // Keep native scrolling still throughout the gesture and spring. Moving
    // scrollLeft and transformed overflow together makes WebKit fight itself.
    list.style.setProperty('--task-pull', `${scrollAnchor - position}px`);
  }
  function stopMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function settle() {
    stopMotion();
    maximum = measure();
    position = clamp(position, 0, maximum);
    velocity = 0;
    list.style.setProperty('--task-pull', '0px');
    list.scrollTo({ left: position, behavior: 'instant' });
    position = scrollAnchor = list.scrollLeft;
  }
  function spring() {
    let previousTime = now();
    let target = position < 0 ? 0 : position > maximum ? maximum : maximum === 0 ? 0 : null;
    function tick(time) {
      const dt = Math.min(64, Math.max(0, time - previousTime));
      previousTime = time;
      if (target !== null) {
        // Solve the damped spring directly, so 60/120 Hz and uneven frames
        // follow the same curve. Keep its target through the small rebound.
        const damping = .011, frequency = Math.sqrt(.015 ** 2 - damping ** 2);
        const offset = position - target;
        const sine = Math.sin(frequency * dt), cosine = Math.cos(frequency * dt);
        const coefficient = (velocity + damping * offset) / frequency;
        const decay = Math.exp(-damping * dt);
        const nextOffset = decay * (offset * cosine + coefficient * sine);
        velocity = decay * (-offset * frequency * sine + coefficient * frequency * cosine) - damping * nextOffset;
        position = target + nextOffset;
      } else {
        const decay = Math.exp(-dt / 240);
        position += velocity * 240 * (1 - decay);
        velocity *= decay;
        if (position < 0 || position > maximum) target = clamp(position, 0, maximum);
      }
      paint();
      if (Math.abs(velocity) < .006 && (target === null || Math.abs(position - target) < .12)) {
        if (target !== null) position = target;
        settle();
      } else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function finish(animate = false) {
    if (!gesture) { if (!animate && frame) settle(); return; }
    const previous = gesture;
    gesture = null;
    if (previous.active) suppressClickUntil = Date.now() + 400;
    if (now() - previous.time > 80) velocity = 0;
    if (list.hasPointerCapture(previous.id)) list.releasePointerCapture(previous.id);
    if (animate && previous.active && !reducedMotion.matches) spring();
    else settle();
  }
  list.addEventListener('pointerdown', event => {
    if (!mobile.matches || event.pointerType !== 'touch' || event.isPrimary === false || gesture || !list.children.length) return;
    event.preventDefault();
    suppressClickUntil = 0;
    const wasMoving = !!frame;
    stopMotion();
    maximum = measure();
    if (!wasMoving) position = scrollAnchor = list.scrollLeft;
    // Cancel task auto-scroll once; catching a spring retains the same anchor.
    list.scrollTo({ left: scrollAnchor, behavior: 'instant' });
    velocity = 0;
    const edge = clamp(position, 0, maximum), excess = position - edge;
    const limit = Math.max(Math.min(90, list.clientWidth * .6), Math.abs(excess) + 1);
    // Invert the rubber-band curve when catching a moving spring, so it does
    // not jump when the next drag starts outside the normal scroll range.
    const start = edge - Math.sign(excess) * limit / .8 * Math.log(1 - Math.abs(excess) / limit);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
      start, limit, time: now(), active: false };
  });
  list.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { finish(); return; }
      if (Math.abs(dx) < 4 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
      gesture.active = true;
      list.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const requested = gesture.start - dx;
    const scroll = clamp(requested, 0, maximum);
    const excess = requested - scroll;
    const limit = gesture.limit;
    const next = scroll + Math.sign(excess) * limit * (1 - Math.exp(-Math.abs(excess) * .8 / limit));
    const time = now(), dt = Math.max(8, time - gesture.time);
    velocity = clamp(velocity * .25 + (next - position) / dt * .75, -2.5, 2.5);
    position = next;
    gesture.time = time;
    paint();
  });
  list.addEventListener('pointerup', event => { if (gesture?.id === event.pointerId) finish(true); });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    list.addEventListener(type, event => {
      // Touch capture moves from the pressed task (or its icon/label) to the
      // list. Its bubbling lostpointercapture is a handoff, not cancellation.
      if (type === 'lostpointercapture' && event.target !== list) return;
      if (gesture?.id === event.pointerId) finish();
    });
  }
  list.addEventListener('click', event => {
    if (Date.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener('blur', () => finish());
  window.addEventListener('resize', () => finish());
  mobile.addEventListener('change', () => finish());
  reducedMotion.addEventListener('change', () => finish());
})();
