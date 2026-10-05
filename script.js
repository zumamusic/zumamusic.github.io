(() => {
  const notice = document.querySelector('#notice-window');
  const titlebar = document.querySelector('#titlebar');
  const controls = titlebar.querySelector('.mini-controls');
  const dock = document.querySelector('.zuma-dock');
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

  function reachedDock(event, startY) {
    const top = dockTop(viewportSize().height);
    return event.clientY - startY > 48 &&
      (event.clientY >= top - 28 || notice.getBoundingClientRect().bottom >= top - 10);
  }

  function applyPosition() {
    notice.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }

  function constrain(next, start = position) {
    const rect = notice.getBoundingClientRect();
    const baseLeft = rect.left - start.x;
    const baseTop = rect.top - start.y;
    const viewport = viewportSize();
    const fitsX = rect.width <= viewport.width - 16;
    const fitsY = rect.height <= dockTop(viewport.height) - 14;
    return {
      x: Math.min(Math.max(next.x, fitsX ? 8 - baseLeft : 80 - rect.width - baseLeft), fitsX ? viewport.width - 8 - rect.width - baseLeft : viewport.width - 80 - baseLeft),
      y: Math.min(Math.max(next.y, 12 - baseTop), fitsY ? dockTop(viewport.height) - 8 - rect.height - baseTop : dockTop(viewport.height) - 39 - baseTop)
    };
  }

  controls.addEventListener('pointerdown', event => event.stopPropagation());
  titlebar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.mini-controls')) return;
    const rect = notice.getBoundingClientRect();
    const viewport = viewportSize();
    const baseLeft = rect.left - position.x;
    const baseTop = rect.top - position.y;
    const fitsX = rect.width <= viewport.width - 16;
    const fitsY = rect.height <= dockTop(viewport.height) - 14;
    drag = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: position.x,
      startY: position.y,
      moved: false,
      minX: fitsX ? 8 - baseLeft : 80 - rect.width - baseLeft,
      maxX: fitsX ? viewport.width - 8 - rect.width - baseLeft : viewport.width - 80 - baseLeft,
      minY: 12 - baseTop,
      maxY: fitsY ? dockTop(viewport.height) - 8 - rect.height - baseTop : dockTop(viewport.height) - 39 - baseTop
    };
    notice.classList.add('is-dragging');
    titlebar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  titlebar.addEventListener('pointermove', event => {
    if (!drag || !titlebar.hasPointerCapture(event.pointerId)) return;
    if (Math.hypot(event.clientX - drag.pointerX, event.clientY - drag.pointerY) > 8) drag.moved = true;
    position = {
      x: Math.min(Math.max(drag.startX + event.clientX - drag.pointerX, drag.minX), drag.maxX),
      y: Math.min(Math.max(drag.startY + event.clientY - drag.pointerY, drag.minY), drag.maxY)
    };
    applyPosition();
    const onDock = drag.moved && reachedDock(event, drag.pointerY);
    dock.classList.toggle('is-drop-target', onDock);
    if (onDock) finishDrag(event, true);
  });
  function finishDrag(event, minimizeOnDock = false) {
    if (!drag) return;
    if (titlebar.hasPointerCapture(event.pointerId)) titlebar.releasePointerCapture(event.pointerId);
    drag = null;
    notice.classList.remove('is-dragging');
    dock.classList.remove('is-drop-target');
    if (minimizeOnDock) window.ZumaWindowManager?.minimize('notice');
  }
  function stop(event) {
    if (!drag) return;
    finishDrag(event, event.type === 'pointerup' && drag.moved && reachedDock(event, drag.pointerY));
  }
  titlebar.addEventListener('pointerup', stop);
  titlebar.addEventListener('pointercancel', stop);
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);
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
  window.ZumaNoticeDrag = {
    offsetBy(x, y) {
      position = { x: position.x + x, y: position.y + y };
      applyPosition();
    }
  };

  const contactTrigger = document.querySelector('#contact-trigger');
  const contactLayer = document.querySelector('#contact-layer');
  const contactClose = document.querySelector('#contact-close');
  const contactWindow = document.querySelector('.contact-window');
  const contactForm = document.querySelector('#contact-form');
  const contactStatus = document.querySelector('#contact-status');
  const contactThankyou = document.querySelector('#contact-thankyou');
  const contactSubmit = contactForm.querySelector('[type="submit"]');

  function openContact() {
    window.ZumaWindowManager?.open('contact');
  }

  function closeContact() {
    if (contactWindow.classList.contains('is-sent')) contactForm.reset();
    contactWindow.classList.remove('is-sent');
    contactThankyou.hidden = true;
    contactStatus.className = 'contact-status';
    contactStatus.textContent = '';
    window.ZumaWindowManager?.close('contact');
    contactTrigger.focus();
  }

  contactTrigger.addEventListener('click', openContact);
  contactClose.addEventListener('click', closeContact);
  // The desktop behind the window is not a dismiss target: stray mobile taps
  // must never make an in-progress message disappear without a taskbar entry.
  document.addEventListener('keydown', event => {
    if (contactLayer.hidden || !window.ZumaWindowManager?.isActive('contact')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeContact();
      return;
    }
  });

  contactForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    contactStatus.className = 'contact-status';
    contactStatus.textContent = 'Sending…';
    contactSubmit.disabled = true;
    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(contactForm)
      });
      if (!response.ok) throw new Error('Message could not be sent');
      contactForm.reset();
      contactStatus.textContent = '';
      contactWindow.classList.add('is-sent');
      contactThankyou.hidden = false;
    } catch (error) {
      contactStatus.classList.add('is-error');
      contactStatus.innerHTML = 'Couldn\u2019t send. Email <a href="mailto:demos@zuma.music">demos@zuma.music</a>.';
    } finally {
      contactSubmit.disabled = false;
    }
  });

  document.querySelector('#waitlist-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
    event.currentTarget.hidden = true;
    document.querySelector('#form-message').hidden = false;
  });
})();
