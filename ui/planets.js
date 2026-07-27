/** Terran deep-space FX for #ducky-fx-root (appearance.effects). */
(function () {
  var mount = window.__duckyAppearanceFxMount;
  var root = (mount && mount.root) || document.getElementById("ducky-fx-root");
  var key = (mount && mount.key) || "galaxycraft::planets";
  if (!root) return;

  var reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.createElement("canvas");
  canvas.className = "ducky-fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  root.replaceChildren(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var stars = [];
  var dust = [];
  var raf = 0;
  var start = performance.now();
  var gridOff = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    dust = [];
    var n = Math.floor((w * h) / 9000);
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        a: 0.2 + Math.random() * 0.7,
        s: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
        twSpeed: 0.0008 + Math.random() * 0.0025,
      });
    }
    for (var d = 0; d < 40; d++) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 40 + Math.random() * 120,
        a: 0.015 + Math.random() * 0.03,
      });
    }
  }

  function drawGrid(w, h, t) {
    if (!reduced) gridOff = (t * 0.01) % 48;
    ctx.save();
    ctx.strokeStyle = "rgba(14,165,233,0.045)";
    ctx.lineWidth = 1;
    var step = 48;
    var ox = -gridOff;
    var oy = -gridOff * 0.55;
    for (var x = ox; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (var y = oy; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(245,158,11,0.035)";
    for (var mx = ox; mx < w; mx += step * 4) {
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw(ts) {
    raf = window.requestAnimationFrame(draw);
    var w = window.innerWidth;
    var h = window.innerHeight;
    var cx = w * 0.5;
    var cy = h * 0.5;
    var t = ts - start;

    // Deep Terran void
    var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
    bg.addColorStop(0, "#0a141e");
    bg.addColorStop(0.55, "#040d14");
    bg.addColorStop(1, "#020508");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawGrid(w, h, t);

    for (var i = 0; i < dust.length; i++) {
      var du = dust[i];
      var dg = ctx.createRadialGradient(du.x, du.y, 0, du.x, du.y, du.r);
      dg.addColorStop(0, "rgba(14,165,233," + du.a + ")");
      dg.addColorStop(1, "transparent");
      ctx.fillStyle = dg;
      ctx.fillRect(du.x - du.r, du.y - du.r, du.r * 2, du.r * 2);
    }

    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var twinkle = reduced
        ? st.a
        : st.a * (0.5 + 0.5 * Math.sin(st.tw + t * st.twSpeed));
      ctx.fillStyle = "rgba(148,180,210," + twinkle + ")";
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }

    // Soft amber / blue nebula wash (no cartoon planets)
    var neb = ctx.createRadialGradient(
      cx * 0.7,
      cy * 0.6,
      10,
      cx,
      cy,
      Math.min(w, h) * 0.5
    );
    neb.addColorStop(0, "rgba(14,165,233,0.06)");
    neb.addColorStop(0.45, "rgba(245,158,11,0.03)");
    neb.addColorStop(1, "transparent");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

    // Faint green terminal bloom at bottom (command console feel)
    var bloom = ctx.createLinearGradient(0, h * 0.7, 0, h);
    bloom.addColorStop(0, "transparent");
    bloom.addColorStop(1, "rgba(74,222,128,0.03)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);
  }

  resize();
  raf = window.requestAnimationFrame(draw);
  window.addEventListener("resize", resize);

  window.__duckyAppearanceFxCleanups = window.__duckyAppearanceFxCleanups || {};
  window.__duckyAppearanceFxCleanups[key] = function () {
    window.cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    root.replaceChildren();
  };
})();
