// Webamp uses a streaming <audio> element. Fully fetching each selected file
// gives WebKit a local, seekable source even when its network media loader
// cannot issue byte-range requests through the embedded browser.
export function installBufferedPlayback(media: {
  loadFromUrl: (url: string, autoPlay: boolean) => Promise<void>;
}) {
  const originalLoad = media.loadFromUrl.bind(media);
  let generation = 0;
  let pending: AbortController | undefined;
  const cached = new Map<string, string>();

  media.loadFromUrl = async (url, autoPlay) => {
    const request = ++generation;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    let source = url;
    try {
      // Files dropped by the user are already local blob URLs.
      if (!url.startsWith("blob:")) {
        source = cached.get(url) ?? "";
        if (!source) {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Audio download failed: ${response.status}`);
          const blob = await response.blob();
          if (request !== generation) return;
          source = URL.createObjectURL(blob);
          cached.set(url, source);
        }
        // Keep just the two most recently used files in memory.
        cached.delete(url);
        cached.set(url, source);
      }
      if (request !== generation) return;
      await originalLoad(source, autoPlay);
      while (cached.size > 2) {
        const oldest = cached.keys().next().value!;
        URL.revokeObjectURL(cached.get(oldest)!);
        cached.delete(oldest);
      }
    } catch (error) {
      if (controller.signal.aborted || request !== generation) return;
      console.error("Could not buffer audio; trying the original source", error);
      await originalLoad(url, autoPlay);
    }
  };

  return () => {
    generation++;
    pending?.abort();
    media.loadFromUrl = originalLoad;
    for (const url of cached.values()) URL.revokeObjectURL(url);
    cached.clear();
  };
}
