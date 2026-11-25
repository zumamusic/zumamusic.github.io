// Keep Webamp's real analyser and three visualization modes. The native canvas
// gets replaced on focus/state changes, so give taps a stable button target.
export function installSpectrumControls(
  mainWindow: HTMLElement,
  media: { getAnalyser(): AnalyserNode },
  store: {
    getState(): { display: { visualizerStyle: number } };
    dispatch(action: { type: 'TOGGLE_VISUALIZER_STYLE' }): unknown;
    subscribe(listener: () => void): () => void;
  }
) {
  const analyser = media.getAnalyser();
  const context = analyser.context as AudioContext;
  // Keep the analysis branch connected to the output graph on WebKit without
  // duplicating audible output or changing Webamp's volume/EQ path.
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;
  analyser.connect(silentOutput);
  silentOutput.connect(context.destination);

  const resume = () => {
    if (context.state !== 'running' && context.state !== 'closed') {
      void context.resume().catch(() => { /* Retry on the next user gesture. */ });
    }
  };
  // Capture before transport handlers stop propagation; invoke resume directly
  // within the user gesture, including touchend for iOS user activation.
  const gestures = ['pointerdown', 'touchend', 'click', 'keydown'];
  gestures.forEach(type => document.addEventListener(type, resume, true));
  const onVisibility = () => { if (!document.hidden) resume(); };
  document.addEventListener('visibilitychange', onVisibility);

  for (let i = 0; i < 3 && store.getState().display.visualizerStyle !== 0; i++) {
    store.dispatch({ type: 'TOGGLE_VISUALIZER_STYLE' });
  }
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'zuma-spectrum-control';
  control.addEventListener('pointerdown', event => event.stopPropagation());
  control.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    resume();
    store.dispatch({ type: 'TOGGLE_VISUALIZER_STYLE' });
  });
  control.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) control.click();
  });
  const modes = ['Spectrum', 'Waveform', 'Off'];
  const syncLabel = () => {
    const mode = modes[store.getState().display.visualizerStyle] ?? modes[0];
    control.setAttribute('aria-label', `Audio display: ${mode}. Change display mode`);
    control.title = `Audio display: ${mode} — tap to change`;
    control.dataset.mode = mode.toLowerCase();
  };
  syncLabel();
  mainWindow.append(control);
  const unsubscribe = store.subscribe(syncLabel);
  return () => {
    unsubscribe();
    control.remove();
    gestures.forEach(type => document.removeEventListener(type, resume, true));
    document.removeEventListener('visibilitychange', onVisibility);
    analyser.disconnect(silentOutput);
    silentOutput.disconnect();
  };
}
