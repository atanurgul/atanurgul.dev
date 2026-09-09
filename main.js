(() => {
  const layer = document.getElementById("threshold");
  if (!layer) return;

  const root = document.documentElement;
  const fill = layer.querySelector(".threshold-fill");
  const count = layer.querySelector(".threshold-count");
  const skip = layer.querySelector(".threshold-skip");
  const images = Array.prototype.slice.call(document.querySelectorAll("main img"));

  /* Long enough that a warm cache reads as a transition rather than a flicker. */
  const HOLD = 700;
  const started = performance.now();

  let loaded = 0;
  let closed = false;

  function render() {
    const pct = images.length ? Math.round((loaded / images.length) * 100) : 100;
    layer.style.setProperty("--progress", pct);
    count.textContent = pct + "%";
  }

  function close(animate) {
    if (closed) return;
    closed = true;
    root.classList.remove("threshold-open");
    if (!animate) {
      layer.remove();
      return;
    }
    layer.addEventListener("transitionend", () => layer.remove(), { once: true });
    layer.classList.add("threshold-out");
  }

  function finish() {
    setTimeout(() => close(true), Math.max(0, HOLD - (performance.now() - started)));
  }

  function step() {
    loaded++;
    render();
    if (loaded >= images.length) finish();
  }

  render();
  if (!images.length) {
    finish();
  } else {
    for (const img of images) {
      if (img.complete && img.naturalWidth > 0) {
        step();
      } else {
        img.addEventListener("load", step, { once: true });
        img.addEventListener("error", step, { once: true });
      }
    }
  }

  skip.addEventListener("click", () => close(false));
})();
