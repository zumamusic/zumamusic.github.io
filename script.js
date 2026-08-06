(() => {
  const windowEl = document.querySelector('#notice');
  const handle = document.querySelector('#drag-handle');
  if (!windowEl || !handle || matchMedia('(max-width: 680px)').matches) return;
  let startX = 0, startY = 0, baseX = 0, baseY = 0, dragging = false;
  const move = (x, y) => {
    baseX = Math.max(-window.innerWidth * .35, Math.min(window.innerWidth * .35, x));
    baseY = Math.max(-window.innerHeight * .3, Math.min(window.innerHeight * .3, y));
    windowEl.style.transform = `translate(${baseX}px, ${baseY}px)`;
  };
  handle.addEventListener('pointerdown', e => { dragging = true; startX = e.clientX - baseX; startY = e.clientY - baseY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', e => { if (dragging) move(e.clientX - startX, e.clientY - startY); });
  handle.addEventListener('pointerup', () => dragging = false);
  handle.addEventListener('keydown', e => {
    if (e.key === 'Escape') move(0, 0);
    else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault(); const n = e.shiftKey ? 20 : 5;
      move(baseX + (e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0), baseY + (e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0));
    }
  });
})();
