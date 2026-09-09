/* Runs before the body is parsed so the layer is there on the first paint;
   everything that needs the finished DOM lives in main.js. */
(() => {
  const root = document.documentElement;
  root.classList.add("js");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const layer = document.createElement("div");
  layer.className = "threshold";
  layer.id = "threshold";

  const name = document.createElement("p");
  name.className = "threshold-name";
  name.textContent = "Atanur Gül";

  const track = document.createElement("div");
  track.className = "threshold-track";
  track.appendChild(document.createElement("div")).className = "threshold-fill";

  const count = document.createElement("p");
  count.className = "threshold-count";
  count.textContent = "0%";

  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "threshold-skip";
  skip.textContent = "Skip";

  layer.append(name, track, count, skip);
  root.classList.add("threshold-open");
  document.body.appendChild(layer);
})();
