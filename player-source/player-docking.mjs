// A dragged panel is attached again when it returns to its normal Webamp slot.
// Use Webamp's 15px magnetic distance so opening another panel sees the
// snapped stack even before the drag's pointerup handler runs.
const SNAP_DISTANCE = 15;
export const nearDockSlot = (position, slot) =>
  Math.abs(position.x - slot.x) < SNAP_DISTANCE &&
  Math.abs(position.y - slot.y) < SNAP_DISTANCE;

export function dockPlan({windows, detached, panelScale, useMobileStack, mobileLandscape, draggedId}) {
  const {main, equalizer, playlist, milkdrop} = windows;
  const height = panel => (panel.shade ? 14 : 116 + (panel.size?.[1] || 0) * 29) * panelScale;
  const mainBottom = main.position.y + height(main);
  const slots = {
    equalizer: {x: main.position.x, y: mainBottom},
    playlist: null,
    milkdrop: null,
  };
  const eqInStack = equalizer.open &&
    (!detached.equalizer || nearDockSlot(equalizer.position, slots.equalizer));
  const eqHeight = eqInStack ? height(equalizer) : 0;
  slots.playlist = {x: main.position.x, y: mainBottom + eqHeight};
  const playlistInStack = playlist.open &&
    (!detached.playlist || nearDockSlot(playlist.position, slots.playlist));
  const playlistHeight = playlistInStack ? height(playlist) : 0;
  const sideBySide = mobileLandscape || (!useMobileStack && (equalizer.open || playlist.open));
  slots.milkdrop = sideBySide
    ? {x: main.position.x + 275 * panelScale, y: main.position.y}
    : {x: main.position.x, y: mainBottom + (useMobileStack ? eqHeight + playlistHeight : 0)};
  const positions = {};
  for (const id of ['equalizer', 'playlist', 'milkdrop']) {
    const panel = windows[id], slot = slots[id];
    if (panel.open && !detached[id] && draggedId !== id &&
      (panel.position.x !== slot.x || panel.position.y !== slot.y)) positions[id] = slot;
  }
  return {positions, slots, sideBySide};
}
