(() => {
  const field = document.getElementById("field");
  if (!field || !field.getContext) return;

  const tree = document.getElementById("tree");
  const labels = Array.prototype.slice.call(document.querySelectorAll(".layer"));
  const fieldCtx = field.getContext("2d");
  const treeCtx = tree && tree.getContext ? tree.getContext("2d") : null;

  const cache = document.createElement("canvas");
  const cacheCtx = cache.getContext("2d");

  const DEPTH = 9;
  const PULSE_TRAVEL = 5000;
  const PULSE_PAUSE = 2000;
  const ENTRANCE = 2600;
  const TIP_GLOW = 40;

  const smallScreen = window.matchMedia("(max-width: 767.98px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const text = readRGB("--text");
  const accent = readRGB("--accent");

  let w = 0;
  let h = 0;
  let treeW = 0;
  let treeH = 0;
  let dpr = 1;
  let particles = [];
  let segments = [];
  let tips = [];
  let mode = "full";
  let still = false;
  let rafId = 0;
  let last = 0;
  let mouseTarget = 0;
  let mouseEased = 0;
  let scrollTarget = 0;
  let scrollEased = 0;
  let activeBand = -1;
  let pulseDist = -1;
  const started = performance.now();
  const dots = [];

  function readRGB(name) {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const rand = (min, max) => min + Math.random() * (max - min);
  const rgba = (c, a) => "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + a + ")";

  function seeded(seed) {
    const x = Math.sin(seed * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function sizeCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return rect;
  }

  function build() {
    const count = smallScreen.matches ? 50 : 120;
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

  function stepField(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -p.r) p.x = w + p.r;
      else if (p.x > w + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = h + p.r;
      else if (p.y > h + p.r) p.y = -p.r;
    }
  }

  function drawField(elapsed) {
    fieldCtx.clearRect(0, 0, w, h);
    for (const p of particles) {
      const breath = still ? 0.5 : 0.5 + 0.5 * Math.sin((elapsed / p.period) * Math.PI * 2 + p.phase);
      fieldCtx.fillStyle = rgba(text, p.lo + (p.hi - p.lo) * breath);
      fieldCtx.beginPath();
      fieldCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      fieldCtx.fill();
    }
  }

  function branch(ctx, x, y, angle, len, depth, seed, dist, elapsed, record) {
    const lean = record ? 0 : Math.sin(elapsed * 0.0005 + seed * 6.3) * 0.028 * (DEPTH - depth);
    const drift = record ? 0 : mouseEased * 0.009 * (DEPTH - depth);
    const a = angle + lean + drift;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    const d1 = dist + len;

    ctx.lineWidth = Math.max(0.4, depth * 0.28);
    ctx.strokeStyle = rgba(text, 0.03 + depth * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (record) {
      segments.push(x, y, x2, y2, dist, d1);
    } else if (pulseDist >= dist && pulseDist <= d1) {
      const k = (pulseDist - dist) / len;
      dots.push(x + (x2 - x) * k, y + (y2 - y) * k);
    }

    const childDepth = depth - 1;
    const childLen = len * (0.73 + seeded(seed) * 0.05);

    if (childDepth < 1 || childLen < 1.3) {
      if (record) {
        tips.push(x2, y2, d1);
      } else {
        const past = pulseDist - d1;
        const glow = past >= 0 && past < TIP_GLOW ? (1 - past / TIP_GLOW) * 0.64 : 0;
        ctx.fillStyle = rgba(text, 0.16 + glow);
        ctx.beginPath();
        ctx.arc(x2, y2, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    branch(ctx, x2, y2, a - (0.28 + seeded(seed + 0.37) * 0.24), childLen, childDepth, seed * 2, d1, elapsed, record);
    branch(ctx, x2, y2, a + (0.28 + seeded(seed + 0.71) * 0.24), childLen, childDepth, seed * 2 + 1, d1, elapsed, record);
  }

  function buildCache() {
    if (!treeCtx) return;
    cache.width = tree.width;
    cache.height = tree.height;
    cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cacheCtx.clearRect(0, 0, treeW, treeH);
    segments = [];
    tips = [];
    branch(cacheCtx, treeW / 2, treeH + 16, -Math.PI / 2, treeH * 0.17, DEPTH, 1, 0, 0, true);
  }

  function drawTips() {
    const hot = [];
    treeCtx.fillStyle = rgba(text, 0.16);
    treeCtx.beginPath();
    for (let i = 0; i < tips.length; i += 3) {
      const past = pulseDist - tips[i + 2];
      if (past >= 0 && past < TIP_GLOW) {
        hot.push(i);
        continue;
      }
      treeCtx.moveTo(tips[i] + 1, tips[i + 1]);
      treeCtx.arc(tips[i], tips[i + 1], 1, 0, Math.PI * 2);
    }
    treeCtx.fill();

    for (const i of hot) {
      treeCtx.fillStyle = rgba(text, 0.16 + (1 - (pulseDist - tips[i + 2]) / TIP_GLOW) * 0.64);
      treeCtx.beginPath();
      treeCtx.arc(tips[i], tips[i + 1], 1, 0, Math.PI * 2);
      treeCtx.fill();
    }
  }

  function drawCachedPulse() {
    if (pulseDist < 0) return;
    treeCtx.fillStyle = rgba(accent, 1);
    treeCtx.beginPath();
    for (let i = 0; i < segments.length; i += 6) {
      const d0 = segments[i + 4];
      const d1 = segments[i + 5];
      if (pulseDist < d0 || pulseDist > d1) continue;
      const k = (pulseDist - d0) / (d1 - d0);
      const x = segments[i] + (segments[i + 2] - segments[i]) * k;
      const y = segments[i + 1] + (segments[i + 3] - segments[i + 1]) * k;
      treeCtx.moveTo(x + 1.5, y);
      treeCtx.arc(x, y, 1.5, 0, Math.PI * 2);
    }
    treeCtx.fill();
  }

  function setBand(index) {
    if (index === activeBand) return;
    activeBand = index;
    for (let i = 0; i < labels.length; i++) labels[i].classList.toggle("lit", i === index);
  }

  function drawTree(elapsed) {
    if (!treeCtx) return;
    treeCtx.clearRect(0, 0, treeW, treeH);

    const reach = treeH * 0.62;
    if (mode === "none") {
      pulseDist = -1;
      setBand(-1);
    } else {
      const span = mode === "pulse" ? PULSE_TRAVEL * 2 : PULSE_TRAVEL;
      const phase = elapsed % (span + PULSE_PAUSE);
      const running = phase < span;
      pulseDist = running ? (phase / span) * reach : -1;
      setBand(running ? Math.min(5, Math.floor((pulseDist / reach) * 6)) : -1);
    }

    if (still) {
      treeCtx.save();
      treeCtx.setTransform(1, 0, 0, 1, 0, 0);
      treeCtx.drawImage(cache, 0, 0);
      treeCtx.restore();
      drawTips();
      drawCachedPulse();
      return;
    }

    const entrance = Math.min(1, elapsed / ENTRANCE);
    treeCtx.globalAlpha = 1 - Math.pow(1 - entrance, 3);

    dots.length = 0;
    const grow = Math.min(1, scrollEased / (window.innerHeight * 2));
    branch(treeCtx, treeW / 2, treeH + 16, -Math.PI / 2, treeH * (0.17 + 0.09 * grow), DEPTH, 1, 0, elapsed, false);

    treeCtx.fillStyle = rgba(accent, 1);
    for (let i = 0; i < dots.length; i += 2) {
      treeCtx.beginPath();
      treeCtx.arc(dots[i], dots[i + 1], 1.5, 0, Math.PI * 2);
      treeCtx.fill();
    }

    treeCtx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(now - last, 50);
    last = now;
    const elapsed = now - started;
    if (!still) {
      mouseEased += (mouseTarget - mouseEased) * (1 - Math.exp(-dt / 250));
      scrollEased += (scrollTarget - scrollEased) * (1 - Math.exp(-dt / 180));
      stepField(dt);
      drawField(elapsed);
    }
    drawTree(elapsed);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId || mode === "none") return;
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
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = sizeCanvas(field, fieldCtx);
    w = rect.width;
    h = rect.height;
    if (treeCtx) {
      const treeRect = sizeCanvas(tree, treeCtx);
      treeW = treeRect.width;
      treeH = treeRect.height;
    }

    mode = reduceMotion.matches ? "none" : smallScreen.matches ? "pulse" : "full";
    still = mode !== "full";

    build();
    if (still) {
      mouseEased = 0;
      mouseTarget = 0;
      buildCache();
      drawField(0);
      drawTree(0);
    }
    start();
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 150);
  });

  window.addEventListener("scroll", () => {
    scrollTarget = window.scrollY;
  }, { passive: true });

  window.addEventListener("mousemove", (e) => {
    if (!still) mouseTarget = (e.clientX / window.innerWidth) * 2 - 1;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  reduceMotion.addEventListener("change", setup);
  smallScreen.addEventListener("change", setup);

  document.documentElement.classList.add("js");

  const observer = new IntersectionObserver((entries) => {
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (order > 0 && order < 6) entry.target.classList.add("s" + order);
      entry.target.classList.add("shown");
      observer.unobserve(entry.target);
      order++;
    }
  }, { threshold: 0.15 });

  for (const el of document.querySelectorAll(".reveal")) observer.observe(el);

  scrollTarget = window.scrollY;
  scrollEased = scrollTarget;
  setup();
})();
