"use client";

import { useEffect, useRef, useState } from "react";
import { installBufferedPlayback } from "./buffered-playback";
import { installSpectrumControls } from "./spectrum-controls";
import { installMobileLayout } from "./mobile-layout.mjs";
import { installPlayerScaling, DESKTOP_DEFAULT_SCALE } from "./player-scaling.mjs";
import { dockPlan, nearDockSlot } from "./player-docking.mjs";
import { installPlaylistScrolling } from "./playlist-scrolling.mjs";

export default function Home() {
  const stageRef = useRef<HTMLDivElement>(null);
  const webampRef = useRef<{ dispose: () => void } | null>(null);
  const compactControlsRef = useRef<{
    togglePlayback: () => void;
    previous: () => void;
    next: () => void;
    seek: (percent: number) => void;
    close: () => void;
  } | null>(null);
  const compactDragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    left: number;
    top: number;
  } | null>(null);
  const [status, setStatus] = useState("Loading Webamp + Butterchurn…");
  const [compact, setCompact] = useState(false);
  const [compactMinimized, setCompactMinimized] = useState(false);
  const [compactPosition, setCompactPosition] = useState({ left: 24, top: 24 });
  const [compactInfo, setCompactInfo] = useState({ title: "ZUMA Player", playing: false, position: 0 });

  useEffect(() => {
    let cancelled = false;
    const notifyHost = (type: string) => {
      if (!cancelled && window.parent !== window) window.parent.postMessage({
        source: "zuma-player", type, session: new URLSearchParams(location.search).get("session"),
      }, location.origin);
    };

    async function mountWebamp() {
      const { default: Webamp } = await import("webamp/butterchurn");
      if (cancelled || !stageRef.current) return;

      let useMobileStack = window.matchMedia("(max-width: 720px)").matches;

      let mobileLandscape = window.matchMedia("(pointer: coarse)").matches && innerWidth > innerHeight && innerHeight <= 720;

      // Register before Webamp: its window resize listener otherwise resets an
      // oversized portrait group before our layout can preserve its position.
      let handleMobileResize: ((event: Event) => void) | null = null;
      const guardMobileResize = (event: Event) => {
        if (!window.matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) > 720) return;
        event.stopImmediatePropagation();
        handleMobileResize?.(event);
      };
      window.addEventListener("resize", guardMobileResize, true);
      const webamp = new Webamp({
        enableDoubleSizeMode: false,
        enableHotkeys: true,
        initialTracks: [
          { url: "/audio/Get%20Bent%21.m4a", metaData: { title: "Get Bent!.m4a" } },
          { url: "/audio/Raver99.m4a", metaData: { title: "Raver99.m4a" } },
          { url: "/audio/Reload.m4a", metaData: { title: "Reload.m4a" } },
          { url: "/audio/Breath.m4a", metaData: { title: "Breath.m4a" } },
          { url: "/audio/Free.m4a", metaData: { title: "Free.m4a" } },
          { url: "/audio/All%20I%20Can%20Take.mp3", metaData: { title: "All I Can Take.mp3" } },
          { url: "/audio/Bumper.mp3", metaData: { title: "Bumper.mp3" } },
          { url: "/audio/I%20Am%20The%20One.mp3", metaData: { title: "I Am The One.mp3" } },
          { url: "/audio/Pesos.m4a", metaData: { title: "Pesos.m4a" } },
          { url: "/audio/Fieber.mp3", metaData: { title: "Fieber.mp3" } },
          { url: "/audio/Isaac.mp3", metaData: { title: "Isaac.mp3" } },
          { url: "/audio/Schacht.mp3", metaData: { title: "Schacht.mp3" } },
          { url: "/audio/Way.m4a", metaData: { title: "Way.m4a" } },
          { url: "/audio/Can%20You%20Turn%20Around.mp3", metaData: { title: "Can You Turn Around.mp3" } },
        ],
        windowLayout: useMobileStack
          ? {
              main: { position: { top: 0, left: 0 } },
              equalizer: { position: { top: 116, left: 0 }, closed: true },
              playlist: { position: { top: 232, left: 0 }, size: { extraWidth: 0, extraHeight: 0 }, closed: true },
              milkdrop: { position: { top: 116, left: 0 }, size: { extraWidth: 0, extraHeight: 3 }, closed: true },
            }
          : {
              main: { position: { top: 0, left: 0 } },
              equalizer: { position: { top: 116, left: 0 }, closed: true },
              playlist: { position: { top: 232, left: 0 }, size: { extraWidth: 0, extraHeight: 4 }, closed: true },
              milkdrop: { position: { top: 116, left: 0 }, size: { extraWidth: 0, extraHeight: 3 }, closed: true },
            },
      });

      webampRef.current = webamp;
      const disposeBufferedPlayback = installBufferedPlayback(webamp.media);
      await webamp.renderInto(stageRef.current);

      if (window.parent !== window) {
        const stageBounds = stageRef.current.getBoundingClientRect();
        const mainBounds = stageRef.current.querySelector<HTMLElement>("#main-window")!.getBoundingClientRect();
        const initialScale = window.matchMedia("(pointer: coarse)").matches && Math.min(innerWidth, innerHeight) <= 720 ? 1 : DESKTOP_DEFAULT_SCALE;
        const targetLeft = stageBounds.left + Math.max(8, (stageBounds.width - mainBounds.width * initialScale) / 2);
        const targetTop = stageBounds.top + Math.min(160, Math.max(24, (stageBounds.height - mainBounds.height) / 3));
        const dx = targetLeft - mainBounds.left;
        const dy = targetTop - mainBounds.top;
        const positions = Object.fromEntries(
          Object.entries(webamp.store.getState().windows.genWindows).map(([id, windowState]) => [
            id,
            { x: windowState.position.x + dx, y: windowState.position.y + dy },
          ]),
        );
        webamp.store.dispatch({ type: "UPDATE_WINDOW_POSITIONS", positions });
      }

      // The dock owns the embedded player's lifetime. Closing Webamp (also
      // from its compact view) returns to the desktop and stops playback.
      let closeMessageSent = false;
      const notifyEmbeddedClose = () => {
        if (window.parent === window || closeMessageSent) return;
        closeMessageSent = true;
        notifyHost("close");
      };
      const syncEmbeddedClose = () => {
        if (webamp.store.getState().windows.genWindows.main.open) return;
        notifyEmbeddedClose();
      };
      const unsubscribeEmbeddedClose = webamp.store.subscribe(syncEmbeddedClose);
      const closeEmbeddedPlayer = (event: MouseEvent) => {
        if ((event.target as HTMLElement).closest("#main-window #close")) notifyEmbeddedClose();
      };
      stageRef.current.addEventListener("click", closeEmbeddedPlayer, true);

      // Webamp's Redux state starts with the EQ marked "on", but its audio
      // engine is not enabled until it receives an explicit action. Sending
      // the action once at startup keeps the first ON click a true bypass.
      webamp.store.dispatch({ type: "SET_EQ_ON" });

      // This small secondary volume control lives inside the native main window,
      // so it moves with Webamp and shares the engine's existing volume state.
      const mainWindow = stageRef.current.querySelector<HTMLElement>("#main-window")!;
      const disposeSpectrum = installSpectrumControls(mainWindow, webamp.media, webamp.store);
      type DockableWindow = "equalizer" | "playlist" | "milkdrop";
      const detached: Record<DockableWindow, boolean> = { equalizer: false, playlist: false, milkdrop: false };
      let visualizerSizeCustomized = false;
      let resizingVisualizer: { pointerId: number; width: number; height: number } | null = null;
      let draggedWindow: {
        id: DockableWindow;
        pointerId: number;
        start: { x: number; y: number };
      } | null = null;
      let aligningWindows = false;
      let panelScale = 1;

      const syncDockedWindows = () => {
        if (aligningWindows) return;
        const { main, equalizer, playlist, milkdrop } = webamp.store.getState().windows.genWindows;
        if (!main.open) return;
        if (resizingVisualizer &&
          (milkdrop.size[0] !== resizingVisualizer.width || milkdrop.size[1] !== resizingVisualizer.height)) {
          visualizerSizeCustomized = true;
        }

        // A native Webamp drag changes the window's position in the store.
        // Only that deliberate movement opts a child window out of docking.
        if (draggedWindow) {
          const { id, start } = draggedWindow;
          const position = { equalizer, playlist, milkdrop }[id].position;
          if (Math.hypot(position.x - start.x, position.y - start.y) > 2) detached[id] = true;
        }

        const { positions, sideBySide } = dockPlan({
          windows: { main, equalizer, playlist, milkdrop }, detached, panelScale,
          useMobileStack, mobileLandscape, draggedId: draggedWindow?.id,
        });
        const visualizerHeight = sideBySide && !mobileLandscape ? 4 : 3;
        const resizeVisualizer = milkdrop.open && !visualizerSizeCustomized &&
          (milkdrop.size[0] !== 0 || milkdrop.size[1] !== visualizerHeight);
        if (Object.keys(positions).length === 0 && !resizeVisualizer) return;
        aligningWindows = true;
        try {
          if (Object.keys(positions).length > 0) {
            webamp.store.dispatch({ type: "UPDATE_WINDOW_POSITIONS", positions });
          }
          if (resizeVisualizer) {
            webamp.store.dispatch({ type: "WINDOW_SIZE_CHANGED", windowId: "milkdrop", size: [0, visualizerHeight] });
          }
        } finally {
          aligningWindows = false;
        }
      };
      const beginWindowDrag = (event: PointerEvent) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (!target.classList.contains("draggable")) return;
        const id: DockableWindow | null = target.closest("#equalizer-window")
          ? "equalizer"
          : target.closest("#playlist-window, #playlist-window-shade")
            ? "playlist"
            : target.closest(".gen-window")
              ? "milkdrop"
              : null;
        if (!id) return;
        const position = webamp.store.getState().windows.genWindows[id].position;
        draggedWindow = { id, pointerId: event.pointerId, start: { ...position } };
      };
      const finishWindowDrag = (event: PointerEvent) => {
        if (draggedWindow?.pointerId !== event.pointerId) return;
        const id = draggedWindow.id;
        draggedWindow = null;
        const windows = webamp.store.getState().windows.genWindows;
        const { slots } = dockPlan({
          windows, detached, panelScale, useMobileStack, mobileLandscape, draggedId: null,
        });
        if (nearDockSlot(windows[id].position, slots[id])) detached[id] = false;
        syncDockedWindows();
      };
      const rememberVisualizerResize = (event: PointerEvent) => {
        if (!(event.target as HTMLElement).closest(".gen-window #gen-resize-target")) return;
        const [width, height] = webamp.store.getState().windows.genWindows.milkdrop.size;
        resizingVisualizer = { pointerId: event.pointerId, width, height };
      };
      const finishVisualizerResize = (event: PointerEvent) => {
        if (resizingVisualizer?.pointerId === event.pointerId) resizingVisualizer = null;
      };
      const unsubscribeDockedWindows = webamp.store.subscribe(syncDockedWindows);
      stageRef.current.addEventListener("pointerdown", beginWindowDrag, true);
      stageRef.current.addEventListener("pointerdown", rememberVisualizerResize, true);
      window.addEventListener("pointerup", finishWindowDrag, true);
      window.addEventListener("pointercancel", finishWindowDrag, true);
      window.addEventListener("pointerup", finishVisualizerResize, true);
      window.addEventListener("pointercancel", finishVisualizerResize, true);
      const compactToggle = document.createElement("button");
      compactToggle.type = "button";
      compactToggle.className = "zuma-compact-toggle";
      compactToggle.setAttribute("aria-label", "Compact player");
      compactToggle.title = "Compact player";
      compactToggle.addEventListener("pointerdown", (event) => event.stopPropagation());
      mainWindow.querySelector("#title-bar")?.appendChild(compactToggle);
      const transportDecor = document.createElement("div");
      transportDecor.className = "zuma-transport-decor";
      transportDecor.setAttribute("aria-hidden", "true");
      transportDecor.innerHTML = '<span class="divider"></span>';
      mainWindow.appendChild(transportDecor);
      const visualizerToggle = document.createElement("button");
      visualizerToggle.type = "button";
      visualizerToggle.className = "zuma-visualizer-toggle";
      visualizerToggle.addEventListener("pointerdown", (event) => event.stopPropagation());
      visualizerToggle.addEventListener("click", () => {
        webamp.store.dispatch({ type: "TOGGLE_WINDOW", windowId: "milkdrop" });
      });
      mainWindow.appendChild(visualizerToggle);
      const syncVisualizerToggle = () => {
        const isOpen = webamp.store.getState().windows.genWindows.milkdrop.open;
        visualizerToggle.setAttribute("aria-pressed", String(isOpen));
        visualizerToggle.setAttribute("aria-label", isOpen ? "Hide visualizer" : "Show visualizer");
        visualizerToggle.title = isOpen ? "Hide visualizer" : "Show visualizer";
      };
      syncVisualizerToggle();
      const unsubscribeVisualizerToggle = webamp.store.subscribe(syncVisualizerToggle);
      const playerScaling = installPlayerScaling({
        stage: stageRef.current,
        store: webamp.store,
        onScale: (scale: number) => { panelScale = scale; syncDockedWindows(); },
      });
      const disposeMobileLayout = installMobileLayout({
        stage: stageRef.current,
        store: webamp.store,
        getFlags: () => ({ detached, visualizerSizeCustomized }),
        setFlags: (flags) => { Object.assign(detached, flags.detached); visualizerSizeCustomized = flags.visualizerSizeCustomized; },
        beginLayout: (mode) => {
          aligningWindows = true;
          draggedWindow = null;
          resizingVisualizer = null;
          mobileLandscape = mode === "landscape";
          useMobileStack = !mobileLandscape;
        },
        endLayout: () => { aligningWindows = false; syncDockedWindows(); playerScaling.sync(); },
      });
      handleMobileResize = disposeMobileLayout.resize;
      const trayVolume = document.createElement("input");
      trayVolume.type = "range";
      trayVolume.min = "0";
      trayVolume.max = "100";
      trayVolume.className = "zuma-tray-volume";
      trayVolume.setAttribute("aria-label", "Transport volume");
      trayVolume.title = "Volume";
      trayVolume.addEventListener("input", () => webamp.setVolume(Number(trayVolume.value)));
      trayVolume.addEventListener("pointerdown", (event) => event.stopPropagation());
      const syncTrayVolume = () => {
        const volume = webamp.store.getState().media.volume;
        trayVolume.value = String(volume);
        trayVolume.style.setProperty("--volume", `${volume}%`);
      };
      mainWindow.appendChild(trayVolume);
      syncTrayVolume();
      const unsubscribeTray = webamp.store.subscribe(syncTrayVolume);

      const syncCompactInfo = () => {
        const state = webamp.store.getState();
        const track = state.playlist.currentTrack == null ? null : state.tracks[state.playlist.currentTrack];
        const name = track?.title?.trim() || track?.defaultName?.trim() || "ZUMA Player";
        const title = track?.artist?.trim() ? `${name} - ${track.artist.trim()}` : name;
        const playing = webamp.getMediaStatus() === "PLAYING";
        const position = track?.duration
          ? Math.max(0, Math.min(100, Math.round((state.media.timeElapsed / track.duration) * 100)))
          : 0;
        setCompactInfo((previous) =>
          previous.title === title && previous.playing === playing && previous.position === position
            ? previous
            : { title, playing, position }
        );
      };
      syncCompactInfo();
      const unsubscribeCompact = webamp.store.subscribe(syncCompactInfo);

      const openCompactPlayer = (event: MouseEvent) => {
        if (!(event.target as HTMLElement).closest("#main-window #shade, #main-window .zuma-compact-toggle")) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const bounds = mainWindow.getBoundingClientRect();
        const compactWidth = window.matchMedia("(max-width: 720px)").matches ? 275 : 275 * 1.15;
        const compactHeight = window.matchMedia("(max-width: 720px)").matches ? 50 : 50 * 1.15;
        setCompactPosition({
          left: Math.min(Math.max(8, bounds.left), Math.max(8, window.innerWidth - compactWidth - 8)),
          top: Math.min(Math.max(8, bounds.top), Math.max(8, window.innerHeight - compactHeight - 8)),
        });
        setCompactMinimized(false);
        setCompact(true);
      };
      stageRef.current.addEventListener("click", openCompactPlayer, true);

      // Webamp focuses a window on pointer-down. That update can replace a
      // header control before the browser delivers its click, leaving the first
      // press to do nothing. Invoke the control's own React click handler before
      // focus changes, then discard the browser's follow-up click.
      const windowControlSelector = [
        "#playlist-window #playlist-shade-button",
        "#playlist-window #playlist-close-button",
        "#playlist-window-shade #playlist-shade-button",
        "#playlist-window-shade #playlist-close-button",
        "#equalizer-window #equalizer-shade",
        "#equalizer-window #equalizer-close",
      ].join(", ");
      let suppressWindowControlClickUntil = 0;
      const activateWindowControl = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const control = (event.target as HTMLElement).closest<HTMLElement>(windowControlSelector);
        if (!control) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressWindowControlClickUntil = performance.now() + 1000;
        control.click();
      };
      const suppressFollowUpWindowClick = (event: MouseEvent) => {
        if (!event.isTrusted || performance.now() > suppressWindowControlClickUntil) return;
        if (!(event.target as HTMLElement).closest(windowControlSelector)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressWindowControlClickUntil = 0;
      };
      stageRef.current.addEventListener("pointerdown", activateWindowControl, true);
      stageRef.current.addEventListener("click", suppressFollowUpWindowClick, true);


      const autoButton = stageRef.current.querySelector<HTMLElement>("#equalizer-window #auto");
      if (autoButton) {
        autoButton.title = "Reset EQ to flat";
      }

      const resetAllEqualizerFaders = (event: MouseEvent) => {
        if (!(event.target as HTMLElement).closest("#equalizer-window #auto")) return;

        event.preventDefault();
        event.stopPropagation();
        const bands: Array<"preamp" | number> = [
          "preamp", 60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000,
        ];
        bands.forEach((band) => {
          webamp.store.dispatch({ type: "SET_BAND_VALUE", band, value: 50 });
        });
      };

      // Touch browsers do not consistently emit dblclick for the native faders.
      let eqTouch: { id: number; band: string; x: number; y: number; moved: boolean } | null = null;
      let eqLastTap: { band: string; time: number } | null = null;
      const beginEqTap = (event: PointerEvent) => {
        if (event.pointerType === "mouse") return;
        const band = (event.target as HTMLElement).closest<HTMLElement>("#equalizer-window .band");
        eqTouch = band ? { id: event.pointerId, band: band.id, x: event.clientX, y: event.clientY, moved: false } : null;
      };
      const moveEqTap = (event: PointerEvent) => {
        if (eqTouch?.id === event.pointerId && Math.hypot(event.clientX - eqTouch.x, event.clientY - eqTouch.y) > 8) {
          eqTouch.moved = true;
          eqLastTap = null;
        }
      };
      const finishEqTap = (event: PointerEvent) => {
        if (eqTouch?.id !== event.pointerId) return;
        const touch = eqTouch;
        eqTouch = null;
        if (touch.moved) return;
        if (eqLastTap?.band === touch.band && event.timeStamp - eqLastTap.time < 380) {
          event.preventDefault();
          const band = touch.band === "preamp" ? "preamp" : Number(touch.band.replace("band-", ""));
          webamp.store.dispatch({ type: "SET_BAND_VALUE", band, value: 50 });
          eqLastTap = null;
        } else {
          eqLastTap = { band: touch.band, time: event.timeStamp };
        }
      };
      const cancelEqTap = () => { eqTouch = null; eqLastTap = null; };
      stageRef.current.addEventListener("pointerdown", beginEqTap, true);
      window.addEventListener("pointermove", moveEqTap, true);
      window.addEventListener("pointerup", finishEqTap, true);
      window.addEventListener("pointercancel", cancelEqTap, true);

      const resetEqualizerFader = (event: MouseEvent) => {
        // Shade controls are omitted by the supplied main-window design.
        if ((event.target as HTMLElement).closest("#main-window #title-bar")) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if ((event.target as HTMLElement).closest("#main-window #balance")) {
          event.preventDefault();
          event.stopPropagation();
          webamp.store.dispatch({ type: "SET_BALANCE", balance: 0 });
          return;
        }

        const fader = (event.target as HTMLElement).closest<HTMLElement>("#equalizer-window .band");
        if (!fader) return;

        const band = fader.id === "preamp" ? "preamp" : Number(fader.id.replace("band-", ""));
        if (band !== "preamp" && !Number.isFinite(band)) return;

        event.preventDefault();
        event.stopPropagation();
        webamp.store.dispatch({ type: "SET_BAND_VALUE", band, value: 50 });
      };

      const unlockAudio = async () => {
        const media = webamp.media as unknown as { _context?: AudioContext };
        if (media._context?.state === "suspended") await media._context.resume();
      };

      const startHighlightedTrack = async () => {
        const { lastSelectedIndex, selectedTracks, trackOrder, currentTrack } = webamp.store.getState().playlist;
        const selectedTrackId = lastSelectedIndex != null && selectedTracks.length > 0
          ? trackOrder[lastSelectedIndex] : currentTrack ?? trackOrder[0];
        if (selectedTrackId == null) return null;
        await unlockAudio();
        webamp.store.dispatch({ type: "PLAY_TRACK", id: selectedTrackId });
        return selectedTrackId;
      };

      const disposePlaylistScrolling = installPlaylistScrolling({
        stage: stageRef.current,
        store: webamp.store,
        playTrack: (id: number) => {
          void unlockAudio().then(() => webamp.store.dispatch({ type: "PLAY_TRACK", id }));
        },
      });

      const playHighlightedTrack = (event: MouseEvent) => {
        if (!(event.target as HTMLElement).closest("#main-window #play")) return;

        event.preventDefault();
        event.stopPropagation();
        const state = webamp.store.getState();
        const selectedId = state.playlist.lastSelectedIndex != null && state.playlist.selectedTracks.length > 0
          ? state.playlist.trackOrder[state.playlist.lastSelectedIndex] : state.playlist.currentTrack;
        if (webamp.getMediaStatus() === "PAUSED" && selectedId === state.playlist.currentTrack) {
          void unlockAudio().then(() => webamp.play());
        } else {
          void startHighlightedTrack();
        }
      };

      const wrapNextTrack = (event: MouseEvent) => {
        if (!(event.target as HTMLElement).closest("#main-window #next")) return;

        const { currentTrack, trackOrder } = webamp.store.getState().playlist;
        if (trackOrder.length === 0 || currentTrack !== trackOrder[trackOrder.length - 1]) return;

        event.preventDefault();
        event.stopPropagation();
        void unlockAudio().then(() => {
          webamp.store.dispatch({ type: "PLAY_TRACK", id: trackOrder[0] });
        });
      };

      const appendOpenedFiles = (event: MouseEvent) => {
        if (!(event.target as HTMLElement).closest("#main-window #eject")) return;

        event.preventDefault();
        event.stopPropagation();

        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "audio/*";
        picker.multiple = true;
        picker.hidden = true;
        document.body.appendChild(picker);

        picker.addEventListener(
          "change",
          () => {
            const files = Array.from(picker.files ?? []);
            if (files.length > 0) {
              webamp.appendTracks(
                files.map((file) => ({
                  blob: file,
                  defaultName: file.name.replace(/\.[^.]+$/, ""),
                }))
              );
            }
            picker.remove();
          },
          { once: true }
        );

        window.addEventListener("focus", () => window.setTimeout(() => picker.remove(), 1000), { once: true });
        picker.click();
      };

      let spacebarTrackId: number | null = null;

      const playDoubleClickedTrack = (event: MouseEvent) => {
        if (!(event.target as HTMLElement).closest("#playlist-window .track-cell")) return;

        event.preventDefault();
        event.stopPropagation();
        void startHighlightedTrack().then((selectedTrackId) => {
          if (selectedTrackId != null) spacebarTrackId = selectedTrackId;
        });
      };

      const togglePlaybackWithSpace = (event: KeyboardEvent) => {
        if (event.code !== "Space" || event.repeat) return;
        if ((event.target as HTMLElement)?.closest(".zuma-spectrum-control")) return;

        const target = event.target as HTMLElement | null;
        if (target?.isContentEditable || target?.matches("textarea, input[type='text'], input[type='search']")) return;

        event.preventDefault();
        event.stopPropagation();

        const { lastSelectedIndex, selectedTracks, trackOrder } = webamp.store.getState().playlist;
        const selectedTrackId =
          lastSelectedIndex != null && selectedTracks.length > 0 ? trackOrder[lastSelectedIndex] : null;

        if (selectedTrackId != null && selectedTrackId !== spacebarTrackId) {
          spacebarTrackId = selectedTrackId;
          void startHighlightedTrack();
          return;
        }

        if (webamp.getMediaStatus() === "PLAYING") webamp.pause();
        else webamp.play();
      };

      let balancePointerStart: { id: number; x: number; y: number } | null = null;
      let lastBalanceTap: { time: number; x: number; y: number } | null = null;
      let activeSeek: { id: number; slider: HTMLInputElement } | null = null;

      const seekPercentAtPointer = (slider: HTMLInputElement, clientX: number) => {
        const rect = slider.getBoundingClientRect();
        const isShadeMode = slider.closest("#main-window")?.classList.contains("shade") ?? false;
        const unscaledThumbWidth = isShadeMode ? 3 : 20;
        const scale = slider.offsetWidth > 0 ? rect.width / slider.offsetWidth : 1;
        const thumbWidth = unscaledThumbWidth * scale;
        const usableWidth = Math.max(1, rect.width - thumbWidth);
        return Math.max(
          0,
          Math.min(100, ((clientX - rect.left - thumbWidth / 2) / usableWidth) * 100)
        );
      };

      const previewSeek = (slider: HTMLInputElement, clientX: number) => {
        const percent = seekPercentAtPointer(slider, clientX);
        slider.value = String(percent);
        webamp.store.dispatch({ type: "SET_FOCUS", input: "position" });
        webamp.store.dispatch({ type: "SET_SCRUB_POSITION", position: percent });
        // Commit during dragging as well as release, including touch input.
        const duration = (webamp.media as unknown as { duration: () => number }).duration();
        if (Number.isFinite(duration) && duration > 0) {
          webamp.seekToTime((duration * percent) / 100);
        }
        return percent;
      };

      const rememberMobilePointer = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        const positionSlider = target.closest<HTMLInputElement>("#main-window #position");
        if (positionSlider) {
          event.preventDefault();
          event.stopPropagation();
          activeSeek = { id: event.pointerId, slider: positionSlider };
          positionSlider.setPointerCapture?.(event.pointerId);
          previewSeek(positionSlider, event.clientX);
        } else if (event.pointerType !== "mouse" && target.closest("#main-window #balance")) {
          balancePointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }
      };

      const moveSeekPointer = (event: PointerEvent) => {
        if (activeSeek?.id !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        previewSeek(activeSeek.slider, event.clientX);
      };

      const finishMobilePointer = (event: PointerEvent) => {
        const target = event.target as HTMLElement;

        if (
          balancePointerStart?.id === event.pointerId &&
          target.closest("#main-window #balance")
        ) {
          const moved = Math.hypot(
            event.clientX - balancePointerStart.x,
            event.clientY - balancePointerStart.y
          );
          balancePointerStart = null;

          if (moved <= 8) {
            const previousTap = lastBalanceTap;
            const isDoubleTap =
              previousTap != null &&
              event.timeStamp - previousTap.time <= 380 &&
              Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <= 24;

            if (isDoubleTap) {
              event.preventDefault();
              event.stopPropagation();
              lastBalanceTap = null;
              webamp.store.dispatch({ type: "SET_BALANCE", balance: 0 });
            } else {
              lastBalanceTap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
            }
          }
          return;
        }

        if (activeSeek?.id !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const { slider } = activeSeek;
        activeSeek = null;
        const percent = previewSeek(slider, event.clientX);
        slider.releasePointerCapture?.(event.pointerId);
        webamp.store.dispatch({ type: "SEEK_TO_PERCENT_COMPLETE", percent });
        webamp.store.dispatch({ type: "UNSET_FOCUS" });
      };

      const cancelSeekPointer = (event: PointerEvent) => {
        if (activeSeek?.id !== event.pointerId) return;
        activeSeek = null;
        webamp.store.dispatch({ type: "UNSET_FOCUS" });
      };

      compactControlsRef.current = {
        togglePlayback: () => {
          const control = webamp.getMediaStatus() === "PLAYING" ? "#pause" : "#play";
          mainWindow.querySelector<HTMLElement>(control)?.click();
        },
        previous: () => mainWindow.querySelector<HTMLElement>("#previous")?.click(),
        next: () => mainWindow.querySelector<HTMLElement>("#next")?.click(),
        seek: (percent) => {
          webamp.store.dispatch({ type: "SEEK_TO_PERCENT_COMPLETE", percent });
          webamp.store.dispatch({ type: "UNSET_FOCUS" });
        },
        close: () => mainWindow.querySelector<HTMLElement>("#close")?.click(),
      };

      stageRef.current.addEventListener("dblclick", resetEqualizerFader, true);
      stageRef.current.addEventListener("dblclick", playDoubleClickedTrack, true);
      stageRef.current.addEventListener("click", playHighlightedTrack, true);
      stageRef.current.addEventListener("click", wrapNextTrack, true);
      stageRef.current.addEventListener("click", appendOpenedFiles, true);
      stageRef.current.addEventListener("click", resetAllEqualizerFaders, true);
      stageRef.current.addEventListener("pointerdown", rememberMobilePointer, true);
      window.addEventListener("pointermove", moveSeekPointer, true);
      window.addEventListener("pointerup", finishMobilePointer, true);
      window.addEventListener("pointercancel", cancelSeekPointer, true);
      window.addEventListener("keydown", togglePlaybackWithSpace, true);
      webampRef.current = {
        dispose: () => {
          window.removeEventListener("resize", guardMobileResize, true);
          disposeMobileLayout();
          playerScaling.dispose();
          unsubscribeDockedWindows();
          unsubscribeTray();
          unsubscribeVisualizerToggle();
          unsubscribeCompact();
          unsubscribeEmbeddedClose();
          stageRef.current?.removeEventListener("click", closeEmbeddedPlayer, true);
          compactControlsRef.current = null;
          trayVolume.remove();
          compactToggle.remove();
          transportDecor.remove();
          visualizerToggle.remove();
          stageRef.current?.removeEventListener("pointerdown", beginWindowDrag, true);
          stageRef.current?.removeEventListener("pointerdown", rememberVisualizerResize, true);
          window.removeEventListener("pointerup", finishWindowDrag, true);
          window.removeEventListener("pointercancel", finishWindowDrag, true);
          window.removeEventListener("pointerup", finishVisualizerResize, true);
          window.removeEventListener("pointercancel", finishVisualizerResize, true);
          stageRef.current?.removeEventListener("click", openCompactPlayer, true);
          stageRef.current?.removeEventListener("pointerdown", activateWindowControl, true);
          stageRef.current?.removeEventListener("click", suppressFollowUpWindowClick, true);
          stageRef.current?.removeEventListener("pointerdown", beginEqTap, true);
          window.removeEventListener("pointermove", moveEqTap, true);
          window.removeEventListener("pointerup", finishEqTap, true);
          window.removeEventListener("pointercancel", cancelEqTap, true);
          stageRef.current?.removeEventListener("dblclick", resetEqualizerFader, true);
          stageRef.current?.removeEventListener("dblclick", playDoubleClickedTrack, true);
          stageRef.current?.removeEventListener("click", playHighlightedTrack, true);
          stageRef.current?.removeEventListener("click", wrapNextTrack, true);
          stageRef.current?.removeEventListener("click", appendOpenedFiles, true);
          stageRef.current?.removeEventListener("click", resetAllEqualizerFaders, true);
          stageRef.current?.removeEventListener("pointerdown", rememberMobilePointer, true);
          window.removeEventListener("pointermove", moveSeekPointer, true);
          window.removeEventListener("pointerup", finishMobilePointer, true);
          window.removeEventListener("pointercancel", cancelSeekPointer, true);
          window.removeEventListener("keydown", togglePlaybackWithSpace, true);
          disposeSpectrum();
          disposePlaylistScrolling();
          webamp.dispose();
          disposeBufferedPlayback();
        },
      };
      notifyHost("ready");
      if (!cancelled) setStatus("Ready — drag an audio file onto the player, then press play");
    }

    mountWebamp().catch((error) => {
      console.error(error);
      notifyHost("error");
      if (!cancelled) setStatus("Webamp could not start in this browser.");
    });

    return () => {
      cancelled = true;
      webampRef.current?.dispose();
    };
  }, []);

  return (
    <main className={compact ? "zuma-compact-view" : undefined}>
      {/* Recolor Webamp's #00e200 bitmap glyphs for ZUMA readouts. */}
      <svg className="zuma-svg-filters" aria-hidden="true" focusable="false">
        <filter id="zuma-title-blue" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0.761062 0 0 0  0 0.982301 0 0 0  0 0.995575 0 0 0  0 0 0 1 0"
          />
        </filter>
        <filter id="zuma-readout-cyan" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0.407080 0 0 0  0 0.933628 0 0 0  0 0.955752 0 0 0  0 0 0 1 0"
          />
        </filter>
      </svg>
      <header className="intro">
        <div>
          <span className="eyebrow">ORIGINAL ENGINE TEST</span>
          <h1>Webamp + Butterchurn</h1>
        </div>
        <p>{status}</p>
      </header>
      <section className="stage" ref={stageRef} aria-label="Webamp player and MilkDrop visualizer" />
      {compact && (
        compactMinimized ? (
          <button className="zuma-mini-dock" type="button" onClick={() => setCompactMinimized(false)}>
            <span className="zuma-mini-dock-mark" aria-hidden="true" />
            ZUMA Player
          </button>
        ) : (
          <div
            className="zuma-mini-player"
            style={{ left: compactPosition.left, top: compactPosition.top }}
            aria-label="ZUMA compact player"
          >
            <div
              className="zuma-mini-titlebar"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                compactDragRef.current = {
                  pointerId: event.pointerId,
                  clientX: event.clientX,
                  clientY: event.clientY,
                  left: compactPosition.left,
                  top: compactPosition.top,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const drag = compactDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const bounds = event.currentTarget.closest<HTMLElement>(".zuma-mini-player")?.getBoundingClientRect();
                const halfWidth = (bounds?.width ?? 275) / 2;
                const height = bounds?.height ?? 50;
                setCompactPosition({
                  left: Math.min(Math.max(-halfWidth, drag.left + event.clientX - drag.clientX), window.innerWidth - halfWidth),
                  top: Math.min(Math.max(8, drag.top + event.clientY - drag.clientY), Math.max(8, window.innerHeight - height - 8)),
                });
              }}
              onPointerUp={(event) => {
                if (compactDragRef.current?.pointerId !== event.pointerId) return;
                compactDragRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => { compactDragRef.current = null; }}
            >
              <span className="zuma-mini-title" title={compactInfo.title}>{compactInfo.title}</span>
              <div className="zuma-mini-window-controls">
                <button className="zuma-mini-minimize" type="button" aria-label="Minimize compact player" onClick={() => setCompactMinimized(true)} />
                <button className="zuma-mini-restore" type="button" aria-label="Restore full player" onClick={() => setCompact(false)} />
                <button className="zuma-mini-close" type="button" aria-label="Close player" onClick={() => {
                  compactControlsRef.current?.close();
                  setCompact(false);
                }} />
              </div>
            </div>
            <div className="zuma-mini-frame">
              <button className="zuma-mini-previous" type="button" aria-label="Previous track" onClick={() => compactControlsRef.current?.previous()} />
              <button className={`zuma-mini-play ${compactInfo.playing ? "is-playing" : ""}`} type="button" aria-label={compactInfo.playing ? "Pause" : "Play"} onClick={() => compactControlsRef.current?.togglePlayback()} />
              <button className="zuma-mini-next" type="button" aria-label="Next track" onClick={() => compactControlsRef.current?.next()} />
              <span className="zuma-mini-divider" aria-hidden="true" />
              <span className="zuma-mini-seek-art" aria-hidden="true">
                <span className="zuma-mini-seek-thumb" style={{ left: `${(compactInfo.position / 100) * 79}px` }} />
              </span>
              <input
                className="zuma-mini-seek"
                type="range"
                min="0"
                max="100"
                value={compactInfo.position}
                aria-label="Seek through song"
                onChange={(event) => {
                  const position = Number(event.target.value);
                  setCompactInfo((previous) => ({ ...previous, position }));
                  compactControlsRef.current?.seek(position);
                }}
              />
            </div>
          </div>
        )
      )}
      <footer>This is the stock player and visualizer foundation. No ZUMA styling has been applied yet.</footer>
    </main>
  );
}
