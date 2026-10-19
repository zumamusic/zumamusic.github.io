(() => {
  // Measure the extra pull from the original geometry, not the clamped window.
  // Reaching the dock leaves the window visible; a deliberate extra pull commits (8% more resistance than before).
  window.ZumaDockDrop = {
    distance(rect, dockTop) {
      return (Math.max(48, dockTop - 8 - rect.bottom) + rect.height * .08) * 1.08;
    }
  };
})();
