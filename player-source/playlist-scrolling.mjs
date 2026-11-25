const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const displayName = (track) => {
  if (!track) return '???';
  if (track.artist && track.title) return `${track.artist} - ${track.title}`;
  if (track.title) return track.title;
  if (track.defaultName) return track.defaultName;
  if (track.url) {
    try { return decodeURIComponent(new URL(track.url, location.href).pathname.split('/').pop()) || '???'; }
    catch { return track.url.split('/').pop() || '???'; }
  }
  return '???';
};

export function installPlaylistScrolling({ stage, store, playTrack }) {
  let viewport = null;
  let observedCenter = null;
  let resizeObserver = null;
  let frame = 0;
  let disposed = false;
  let rendered = {};
  let lastPositionSent = null;
  let lastTap = null;
  let lastPointerType = 'mouse';

  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(sync);
  };

  const select = (event) => {
    const row = event.target.closest('.track-cell[data-track-index]');
    if (!row || !viewport?.contains(row)) return;
    const index = Number(row.dataset.trackIndex);
    const state = store.getState();
    const type = event.shiftKey ? 'SHIFT_CLICKED_TRACK'
      : event.ctrlKey || event.metaKey ? 'CTRL_CLICKED_TRACK' : 'CLICKED_TRACK';
    if (type !== 'CLICKED_TRACK' || state.playlist.trackOrder[index] !== state.playlist.selectedTracks[0]) {
      store.dispatch({ type, index });
    }
    if (lastPointerType === 'touch') {
      const now = performance.now();
      if (lastTap?.index === index && now - lastTap.time < 320) {
        playTrack(state.playlist.trackOrder[index]);
        lastTap = null;
      } else lastTap = { index, time: now };
    }
  };

  const onScroll = () => {
    if (!viewport) return;
    const range = viewport.scrollHeight - viewport.clientHeight;
    const position = range > 0 ? (viewport.scrollTop / range) * 100 : 0;
    lastPositionSent = position;
    store.dispatch({ type: 'SET_PLAYLIST_SCROLL_POSITION', position });
  };

  const onWheel = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!viewport) return;
    const scale = viewport.getBoundingClientRect().height / viewport.clientHeight || 1;
    const pixels = event.deltaMode === 1 ? event.deltaY * 13 : event.deltaMode === 2
      ? event.deltaY * viewport.clientHeight : event.deltaY / scale;
    viewport.scrollTop += pixels * 0.45;
  };

  const render = (state) => {
    if (!viewport) return;
    const { trackOrder, selectedTracks, currentTrack } = state.playlist;
    if (rendered.trackOrder === trackOrder && rendered.tracks === state.tracks &&
      rendered.selectedTracks === selectedTracks && rendered.currentTrack === currentTrack) return;
    const previousTop = viewport.scrollTop;
    const selected = new Set(selectedTracks);
    const fragment = document.createDocumentFragment();
    trackOrder.forEach((id, index) => {
      const track = state.tracks[id];
      const row = document.createElement('div');
      row.className = `track-cell${selected.has(id) ? ' selected' : ''}${currentTrack === id ? ' current' : ''}`;
      row.dataset.trackIndex = String(index);
      const title = document.createElement('span');
      title.className = 'zuma-track-title';
      title.textContent = `${String(index + 1).padStart(String(trackOrder.length).length, '\u00a0')}. ${displayName(track)}`;
      const duration = document.createElement('span');
      duration.className = 'zuma-track-duration';
      duration.textContent = formatTime(track?.duration);
      row.append(title, duration);
      fragment.append(row);
    });
    viewport.replaceChildren(fragment);
    viewport.scrollTop = previousTop;
    rendered = { trackOrder, tracks: state.tracks, selectedTracks, currentTrack };
  };

  const sync = () => {
    frame = 0;
    if (disposed) return;
    const center = stage.querySelector('#playlist-window .playlist-middle-center');
    if (center !== observedCenter) {
      resizeObserver?.disconnect();
      viewport?.remove();
      viewport = null;
      observedCenter = center;
      rendered = {};
      if (center) {
        viewport = document.createElement('div');
        viewport.className = 'playlist-tracks zuma-native-playlist';
        viewport.setAttribute('aria-label', 'Playlist tracks');
        viewport.addEventListener('scroll', onScroll, { passive: true });
        viewport.addEventListener('wheel', onWheel, { passive: false });
        viewport.addEventListener('pointerdown', (event) => { lastPointerType = event.pointerType; });
        viewport.addEventListener('click', select);
        center.append(viewport);
        resizeObserver = new ResizeObserver(schedule);
        resizeObserver.observe(center);
      }
    }
    if (!viewport) return;
    const state = store.getState();
    render(state);
    const position = state.display.playlistScrollPosition;
    const right = center.parentElement.querySelector('.playlist-middle-right');
    const scrollbar = right?.querySelector('.playlist-scrollbar');
    if (scrollbar) {
      const travel = Math.max(0, right.clientHeight - 20);
      scrollbar.style.setProperty('--zuma-scrollbar-y', `${travel * position / 100}px`);
    }
    if (position !== lastPositionSent) {
      const range = viewport.scrollHeight - viewport.clientHeight;
      viewport.scrollTop = Math.max(0, range) * position / 100;
      lastPositionSent = position;
    }
  };

  const unsubscribe = store.subscribe(schedule);
  schedule();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    unsubscribe();
    resizeObserver?.disconnect();
    viewport?.remove();
  };
}
