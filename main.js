(() => {
  const field = document.getElementById("field");
  if (!field || !field.getContext) return;

  const ctx = field.getContext("2d");
  const MOBILE_WIDTH = 768;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const text = readRGB("--text");

  let w = 0;
  let h = 0;
  let particles = [];
  let still = false;
  let rafId = 0;
  let last = 0;

  function readRGB(name) {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const rand = (min, max) => min + Math.random() * (max - min);

  function resize() {
    const rect = field.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    field.width = Math.round(w * dpr);
    field.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function build() {
    const count = w < MOBILE_WIDTH ? 50 : 120;
    particles = [];
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(0.4, 3.4) / 1000;
      const a = rand(0.1, 0.45);
      const b = rand(0.1, 0.45);
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(0.5, 1.4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lo: Math.min(a, b),
        hi: Math.max(a, b),
        period: rand(6000, 14000),
        phase: rand(0, Math.PI * 2)
      });
    }
  }

  function step(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -p.r) p.x = w + p.r;
      else if (p.x > w + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = h + p.r;
      else if (p.y > h + p.r) p.y = -p.r;
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      const breath = still ? 0.5 : 0.5 + 0.5 * Math.sin((now / p.period) * Math.PI * 2 + p.phase);
      const alpha = p.lo + (p.hi - p.lo) * breath;
      ctx.fillStyle = `rgba(${text[0]}, ${text[1]}, ${text[2]}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    const dt = Math.min(now - last, 50);
    last = now;
    step(dt);
    draw(now);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId || still) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function setup() {
    stop();
    resize();
    still = reduceMotion.matches || w < MOBILE_WIDTH;
    build();
    if (still) draw(performance.now());
    else start();
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 150);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  reduceMotion.addEventListener("change", setup);

  setup();
})();
