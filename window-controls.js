(() => {
  const dock = document.querySelector('.zuma-dock');
  const taskList = document.querySelector('#dock-task-list');
  const configs = {
    notice: {
      window: document.querySelector('#notice-window'),
      layer: document.querySelector('#home'),
      titlebar: document.querySelector('#titlebar'),
      minimize: document.querySelector('#notice-minimize'),
      restoreLabel: 'Socials',
      taskIcon: 'zumapc.png'
    },
    contact: {
      window: document.querySelector('.contact-window'),
      layer: document.querySelector('#contact-layer'),
      titlebar: document.querySelector('.contact-titlebar'),
      minimize: document.querySelector('#contact-minimize'),
      restoreLabel: 'Contact',
      taskIcon: 'pixel-rainwave.png',
      bodyClass: 'contact-is-open'
    },
    archives: {
      window: document.querySelector('#archives-window'),
      layer: document.querySelector('#archives-layer'),
      titlebar: document.querySelector('.archives-titlebar'),
      minimize: document.querySelector('#archives-minimize'),
      restoreLabel: 'Archives',
      taskIcon: 'dock-archives.png',
      bodyClass: 'archives-is-open'
    }
  };
  const positions = { contact: { x: 0, y: 0 }, archives: { x: 0, y: 0 } };
  const states = new Map();
  const taskButtons = new Map();
  const animations = new Map();
  const zOrder = [];
  let activeName = null;

  function viewport() {
    return { width: window.visualViewport?.width ?? innerWidth, height: window.visualViewport?.height ?? innerHeight };
  }

  function dockTop() {
    return dock?.getBoundingClientRect().top ?? viewport().height;
  }

  function reachedDock(event, startY, windowEl) {
    const top = dockTop();
    return event.clientY - startY > 48 &&
      (event.clientY >= top - 28 || windowEl.getBoundingClientRect().bottom >= top - 10);
  }

  function offsetWindow(name, x, y) {
    if (name === 'notice') {
      window.ZumaNoticeDrag?.offsetBy(x, y);
      return;
    }
    const position = positions[name];
    position.x += x;
    position.y += y;
    configs[name].window.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }

  function updateTaskButtons() {
    taskButtons.forEach((button, name) => {
      button.setAttribute('aria-label', `Restore ${configs[name].restoreLabel} window`);
    });
  }

  function ensureTaskButton(name) {
    if (taskButtons.has(name)) return taskButtons.get(name);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'taskbar-window';
    const icon = document.createElement('img');
    icon.src = configs[name].taskIcon;
    icon.alt = '';
    const label = document.createElement('span');
    label.textContent = configs[name].restoreLabel;
    button.append(icon, label);
    button.addEventListener('click', () => {
      if (states.get(name) === 'minimized') restore(name);
    });
    taskList.append(button);
    taskButtons.set(name, button);
    updateTaskButtons();
    return button;
  }

  function scrollTaskIntoView(name) {
    const button = taskButtons.get(name);
    if (!button) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < taskList.scrollLeft) taskList.scrollTo({ left: left - 4, behavior: 'smooth' });
    else if (right > taskList.scrollLeft + taskList.clientWidth) taskList.scrollTo({ left: right - taskList.clientWidth + 8, behavior: 'smooth' });
  }

  function activate(name) {
    if (states.get(name) !== 'open') return;
    const index = zOrder.indexOf(name);
    if (index !== -1) zOrder.splice(index, 1);
    zOrder.push(name);
    zOrder.forEach((windowName, order) => { configs[windowName].layer.style.zIndex = String(60 + order); });
    activeName = name;
  }

  function pickActiveWindow() {
    activeName = [...zOrder].reverse().find(name => states.get(name) === 'open') ?? null;
  }

  function cancelAnimation(name) {
    animations.get(name)?.cancel();
    animations.delete(name);
  }

  function animateWindow(name, direction, onFinish = () => {}) {
    const config = configs[name];
    const button = taskButtons.get(name);
    if (name === 'contact' || !button || !config.window.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onFinish();
      return;
    }
    const windowRect = config.window.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const x = buttonRect.left + buttonRect.width / 2 - windowRect.left - windowRect.width / 2;
    const y = buttonRect.top + buttonRect.height / 2 - windowRect.top - windowRect.height / 2;
    const computedTransform = getComputedStyle(config.window).transform;
    const base = computedTransform === 'none' ? 'translate3d(0, 0, 0)' : computedTransform;
    const collapsed = `${base} translate(${x}px, ${y}px) scale(.16, .12)`;
    const expandedFrame = { transform: base, opacity: 1 };
    const collapsedFrame = { transform: collapsed, opacity: 0 };
    const frames = direction === 'out' ? [expandedFrame, collapsedFrame] : [collapsedFrame, expandedFrame];
    const animation = config.window.animate(frames, { duration: 185, easing: 'cubic-bezier(.25,.65,.35,1)', fill: 'both' });
    animations.set(name, animation);
    animation.finished.then(() => {
      if (animations.get(name) !== animation) return;
      onFinish();
      animation.cancel();
      animations.delete(name);
    }).catch(() => {});
  }

  function open(name) {
    const config = configs[name];
    const wasMinimized = states.get(name) === 'minimized';
    cancelAnimation(name);
    config.layer.hidden = false;
    if (config.bodyClass) document.body.classList.add(config.bodyClass);
    states.set(name, 'open');
    activate(name);
    if (wasMinimized) animateWindow(name, 'in', () => {
      taskButtons.get(name)?.remove();
      taskButtons.delete(name);
    });
  }

  function minimize(name) {
    const config = configs[name];
    if (states.get(name) !== 'open') return;
    const keepKeyboardFocus = config.minimize.matches(':focus-visible');
    cancelAnimation(name);
    if (name === 'archives') config.window.querySelector('video')?.pause();
    if (config.bodyClass) document.body.classList.remove(config.bodyClass);
    ensureTaskButton(name);
    scrollTaskIntoView(name);
    states.set(name, 'minimized');
    pickActiveWindow();
    animateWindow(name, 'out', () => {
      if (states.get(name) === 'minimized') config.layer.hidden = true;
    });
    if (keepKeyboardFocus) taskButtons.get(name)?.focus();
  }

  function restore(name) {
    open(name);
    requestAnimationFrame(() => (name === 'notice' ? configs[name].titlebar : configs[name].minimize).focus());
  }

  function close(name) {
    const config = configs[name];
    cancelAnimation(name);
    config.layer.hidden = true;
    if (config.bodyClass) document.body.classList.remove(config.bodyClass);
    states.delete(name);
    const index = zOrder.indexOf(name);
    if (index !== -1) zOrder.splice(index, 1);
    taskButtons.get(name)?.remove();
    taskButtons.delete(name);
    pickActiveWindow();
  }

  function enableDrag(name) {
    const config = configs[name];
    const { window: windowEl, titlebar } = config;
    let drag = null;
    titlebar.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button, a') || windowEl.classList.contains('is-maximized')) return;
      const rect = windowEl.getBoundingClientRect();
      const { width } = viewport();
      const baseLeft = rect.left - positions[name].x;
      const baseTop = rect.top - positions[name].y;
      const fullyFitsX = rect.width <= width - 16;
      const fullyFitsY = rect.height <= dockTop() - 14;
      drag = {
        x: event.clientX,
        y: event.clientY,
        startX: positions[name].x,
        startY: positions[name].y,
        moved: false,
        minX: fullyFitsX ? 8 - baseLeft : 80 - rect.width - baseLeft,
        maxX: fullyFitsX ? width - 8 - rect.width - baseLeft : width - 80 - baseLeft,
        minY: 6 - baseTop,
        maxY: fullyFitsY ? Math.max(90, dockTop() - 8 - rect.height - baseTop) : dockTop() - Math.min(35, rect.height) - baseTop
      };
      titlebar.setPointerCapture(event.pointerId);
      windowEl.classList.add('is-dragging');
      event.preventDefault();
    });
    titlebar.addEventListener('pointermove', event => {
      if (!drag || !titlebar.hasPointerCapture(event.pointerId)) return;
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 8) drag.moved = true;
      positions[name].x = Math.min(Math.max(drag.startX + event.clientX - drag.x, drag.minX), drag.maxX);
      positions[name].y = Math.min(Math.max(drag.startY + event.clientY - drag.y, drag.minY), drag.maxY);
      windowEl.style.transform = `translate3d(${positions[name].x}px, ${positions[name].y}px, 0)`;
      const onDock = drag.moved && reachedDock(event, drag.y, windowEl);
      dock.classList.toggle('is-drop-target', onDock);
      if (onDock) finishDrag(event, true);
    });
    const finishDrag = (event, minimizeOnDock = false) => {
      if (!drag) return;
      if (titlebar.hasPointerCapture(event.pointerId)) titlebar.releasePointerCapture(event.pointerId);
      drag = null;
      windowEl.classList.remove('is-dragging');
      dock.classList.remove('is-drop-target');
      if (minimizeOnDock) minimize(name);
    };
    const stop = event => {
      if (!drag) return;
      finishDrag(event, event.type === 'pointerup' && drag.moved && reachedDock(event, drag.y, windowEl));
    };
    titlebar.addEventListener('pointerup', stop);
    titlebar.addEventListener('pointercancel', stop);
    window.addEventListener('pointerup', stop, true);
    window.addEventListener('pointercancel', stop, true);
  }

  function enableResize(name) {
    const config = configs[name];
    const { window: windowEl } = config;
    const handle = windowEl.querySelector('.window-resize-handle');
    let start = null;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || windowEl.classList.contains('is-maximized')) return;
      const rect = windowEl.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, left: rect.left, top: rect.top };
      handle.setPointerCapture(event.pointerId);
      windowEl.classList.add('is-resizing');
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (!start || !handle.hasPointerCapture(event.pointerId)) return;
      const view = viewport();
      if (name === 'contact') {
        const ratio = 1519 / 1404;
        const horizontalChange = event.clientX - start.x;
        const verticalChange = (event.clientY - start.y) * ratio;
        const change = Math.abs(horizontalChange) >= Math.abs(verticalChange) ? horizontalChange : verticalChange;
        const minWidth = Math.min(260, view.width - 24, dockTop() * ratio - 24);
        const maxWidth = Math.max(minWidth, Math.min(
          view.width - Math.max(0, start.left) - 8,
          (dockTop() - Math.max(0, start.top) - 8) * ratio
        ));
        windowEl.style.width = `${Math.min(maxWidth, Math.max(minWidth, start.width + change))}px`;
        windowEl.style.height = '';
        const shifted = windowEl.getBoundingClientRect();
        offsetWindow(name, start.left - shifted.left, start.top - shifted.top);
        return;
      }
      const minWidth = parseFloat(getComputedStyle(windowEl).minWidth) || 280;
      const minHeight = parseFloat(getComputedStyle(windowEl).minHeight) || 180;
      const maxWidth = Math.max(minWidth, view.width - Math.max(0, start.left) - 8);
      const maxHeight = Math.max(minHeight, dockTop() - Math.max(0, start.top) - 8);
      windowEl.style.width = `${Math.min(maxWidth, Math.max(minWidth, start.width + event.clientX - start.x))}px`;
      windowEl.style.height = `${Math.min(maxHeight, Math.max(minHeight, start.height + event.clientY - start.y))}px`;
      const shifted = windowEl.getBoundingClientRect();
      offsetWindow(name, start.left - shifted.left, start.top - shifted.top);
    });
    const stop = event => {
      if (!start) return;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      start = null;
      windowEl.classList.remove('is-resizing');
    };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
    window.addEventListener('pointerup', stop, true);
    window.addEventListener('pointercancel', stop, true);
    handle.addEventListener('lostpointercapture', () => {
      start = null;
      windowEl.classList.remove('is-resizing');
    });
  }

  Object.entries(configs).forEach(([name, config]) => {
    config.minimize.addEventListener('click', () => minimize(name));
    if (name !== 'notice') enableDrag(name);
    enableResize(name);
    config.window.addEventListener('pointerdown', () => activate(name));
    config.window.addEventListener('focusin', () => activate(name));
  });

  const contactMaximize = document.querySelector('#contact-maximize');
  contactMaximize.addEventListener('click', () => {
    const windowEl = configs.contact.window;
    const maximized = windowEl.classList.toggle('is-maximized');
    contactMaximize.setAttribute('aria-label', maximized ? 'Restore contact window size' : 'Maximize contact window');
  });

  let mouseDrag = null;
  let suppressClick = false;
  taskList.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    mouseDrag = { x: event.clientX, scrollLeft: taskList.scrollLeft, moved: false };
  });
  taskList.addEventListener('pointermove', event => {
    if (!mouseDrag) return;
    const distance = event.clientX - mouseDrag.x;
    if (!mouseDrag.moved && Math.abs(distance) < 5) return;
    if (!mouseDrag.moved) {
      mouseDrag.moved = true;
      taskList.setPointerCapture(event.pointerId);
      taskList.classList.add('is-scrolling');
    }
    taskList.scrollLeft = mouseDrag.scrollLeft - distance;
    event.preventDefault();
  });
  const stopScroll = event => {
    if (!mouseDrag) return;
    suppressClick = mouseDrag.moved;
    if (taskList.hasPointerCapture(event.pointerId)) taskList.releasePointerCapture(event.pointerId);
    mouseDrag = null;
    taskList.classList.remove('is-scrolling');
    setTimeout(() => { suppressClick = false; }, 0);
  };
  taskList.addEventListener('pointerup', stopScroll);
  taskList.addEventListener('pointercancel', stopScroll);
  taskList.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  taskList.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target !== taskList) return;
    event.preventDefault();
    taskList.scrollBy({ left: event.key === 'ArrowRight' ? 120 : -120, behavior: 'smooth' });
  });

  document.querySelector('#socials-trigger').addEventListener('click', () => {
    open('notice');
    requestAnimationFrame(() => configs.notice.titlebar.focus());
  });

  window.ZumaWindowManager = {
    open,
    close,
    minimize,
    isActive: name => activeName === name && states.get(name) === 'open',
    resetPosition(name) {
      if (!positions[name]) return;
      positions[name] = { x: 0, y: 0 };
      configs[name].window.style.transform = '';
    }
  };
})();
