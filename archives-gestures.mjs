// Horizontal media navigation. One wheel gesture advances one file, including
// Magic Mouse/trackpad momentum; vertical scrolling and pinch zoom stay native.
export function installArchiveSwipe(surface, step, isActive) {
  let touch = null;
  let wheelTime = -Infinity;
  let wheelDistance = 0;
  let wheelFired = false;
  const reset = () => {
    touch = null;
    wheelTime = -Infinity;
    wheelDistance = 0;
    wheelFired = false;
  };

  surface.addEventListener('wheel', event => {
    if (!isActive() || event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    const now = event.timeStamp;
    if (now - wheelTime > 220) {
      wheelDistance = 0;
      wheelFired = false;
    }
    wheelTime = now;
    if (wheelFired) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientWidth : 1;
    wheelDistance += event.deltaX * unit;
    if (Math.abs(wheelDistance) >= 40) {
      wheelFired = true;
      step(wheelDistance > 0 ? 1 : -1);
    }
  }, { passive: false });

  surface.addEventListener('touchstart', event => {
    touch = null;
    if (!isActive() || event.touches.length !== 1) return;
    const point = event.touches[0];
    // Leave the native video transport/seek controls to the browser.
    const video = event.target.closest?.('video');
    if (video && point.clientY >= video.getBoundingClientRect().bottom - 48) return;
    touch = { id: point.identifier, x: point.clientX, y: point.clientY };
  }, { passive: true });
  surface.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1) { touch = null; return; }
    const point = Array.from(event.touches).find(item => item.identifier === touch.id);
    if (!point) return;
    const dx = point.clientX - touch.x;
    const dy = point.clientY - touch.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) event.preventDefault();
  }, { passive: false });
  surface.addEventListener('touchend', event => {
    if (!touch) return;
    const start = touch;
    touch = null;
    const point = Array.from(event.changedTouches).find(item => item.identifier === start.id);
    if (!point || !isActive()) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.25) step(dx < 0 ? 1 : -1);
  }, { passive: true });
  surface.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  return reset;
}
