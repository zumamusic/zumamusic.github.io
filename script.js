(() => {
  const notice = document.querySelector('#notice-window');
  const titlebar = document.querySelector('#titlebar');
  const controls = titlebar.querySelector('.mini-controls');
  let position = { x: 0, y: 0 };
  let drag = null;

  function viewportSize() {
    return {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight
    };
  }

  function dockTop(viewportHeight) {
    return document.querySelector('.zuma-dock')?.getBoundingClientRect().top ?? viewportHeight;
  }

  function applyPosition() {
    notice.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }

  function constrain(next, start = position) {
    const rect = notice.getBoundingClientRect();
    const baseLeft = rect.left - start.x;
    const baseTop = rect.top - start.y;
    const viewport = viewportSize();
    return {
      x: Math.min(Math.max(next.x, 80 - rect.width - baseLeft), viewport.width - 80 - baseLeft),
      y: Math.min(Math.max(next.y, 12 - baseTop), dockTop(viewport.height) - 39 - baseTop)
    };
  }

  controls.addEventListener('pointerdown', event => event.stopPropagation());
  titlebar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.mini-controls')) return;
    const rect = notice.getBoundingClientRect();
    const viewport = viewportSize();
    const baseLeft = rect.left - position.x;
    const baseTop = rect.top - position.y;
    drag = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: position.x,
      startY: position.y,
      minX: 80 - rect.width - baseLeft,
      maxX: viewport.width - 80 - baseLeft,
      minY: 12 - baseTop,
      maxY: dockTop(viewport.height) - 39 - baseTop
    };
    notice.classList.add('is-dragging');
    titlebar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  titlebar.addEventListener('pointermove', event => {
    if (!drag || !titlebar.hasPointerCapture(event.pointerId)) return;
    position = {
      x: Math.min(Math.max(drag.startX + event.clientX - drag.pointerX, drag.minX), drag.maxX),
      y: Math.min(Math.max(drag.startY + event.clientY - drag.pointerY, drag.minY), drag.maxY)
    };
    applyPosition();
  });
  function stop(event) {
    if (titlebar.hasPointerCapture(event.pointerId)) titlebar.releasePointerCapture(event.pointerId);
    drag = null;
    notice.classList.remove('is-dragging');
  }
  titlebar.addEventListener('pointerup', stop);
  titlebar.addEventListener('pointercancel', stop);
  titlebar.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'Home') position = { x: 0, y: 0 };
    else {
      const amount = event.shiftKey ? 30 : 10;
      const directions = { ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] };
      if (!directions[event.key]) return;
      const [x, y] = directions[event.key];
      position = constrain({ x: position.x + x, y: position.y + y });
    }
    event.preventDefault();
    applyPosition();
  });
  addEventListener('resize', () => { position = constrain(position); applyPosition(); });

  document.querySelector('#waitlist-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
    event.currentTarget.hidden = true;
    document.querySelector('#form-message').hidden = false;
  });
})();
