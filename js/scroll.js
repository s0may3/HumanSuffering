// js/scroll.js
export function setupScroll(onModeChange) {
  const steps = Array.from(document.querySelectorAll(".step"));
  let currentMode = null;
  let ticking = false;

  function findActiveMode() {
    const center = window.innerHeight * 0.5;

    let bestEl = null;
    let bestDist = Infinity;

    for (const el of steps) {
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) continue;

      const stepCenter = (r.top + r.bottom) / 2;
      const dist = Math.abs(stepCenter - center);

      if (dist < bestDist) {
        bestDist = dist;
        bestEl = el;
      }
    }

    return bestEl ? bestEl.getAttribute("data-mode") : "overview";
  }

  function activate() {
    const mode = findActiveMode();
    if (!mode || mode === currentMode) return;

    currentMode = mode;
    steps.forEach(s => s.classList.toggle("is-active", s.getAttribute("data-mode") === mode));
    onModeChange(mode);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      activate();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  let rt = null;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => activate(), 100);
  });

  activate();
}
