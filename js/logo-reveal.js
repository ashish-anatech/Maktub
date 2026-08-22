/* ==========================================================================
   Maktub Mobile Notary - logo reveal intro
   --------------------------------------------------------------------------
   A fountain pen draws the existing logo artwork. Nothing about the logo is
   redrawn: the real artwork is revealed through an SVG mask whose brush runs
   along the logo's own centrelines, so the ink appears exactly behind the nib.

   The beats below are authored against a 3000ms reference timeline. RUNTIME
   sets how long it actually takes on screen; every beat scales with it, so
   changing that one number is all it takes to retime the whole reveal.

   Timeline (reference ms)                               total 3000
     0    -  200   pen enters from the left
     200  -  466   left stem of the M, drawn upward
     466  -  697   inner diagonal, drawn down-right
     697  -  767   pen lift
     767  -  944   right stem, drawn upward
     944  - 1300   long diagonal - the M is complete at 1300
     1300 - 1655   the same stroke sweeps on into the left infinity loop
     1655 - 1745   pen lift
     1745 - 2250   right infinity loop, finishing at the nib
     2250 - 2560   pen-nib detail and the gold sparkle
     2550 - 2830   MAKTUB
     2790 - 3000   MOBILE NOTARY, opening from the centre
   ========================================================================== */

(function () {
  "use strict";

  var STAGE = document.getElementById("logoReveal");
  if (!STAGE) return;

  var root = document.documentElement;

  /* the head script did not arm it (e.g. scripting blocked mid-load): drop the
     markup rather than leaving a hidden overlay in the document */
  if (!root.classList.contains("lr-armed")) {
    if (STAGE.parentNode) STAGE.parentNode.removeChild(STAGE);
    return;
  }

  var canvas = STAGE.querySelector(".lr-canvas");
  var pen = STAGE.querySelector(".lr-pen");
  var glow = STAGE.querySelector(".lr-tip-glow");
  var nibMask = STAGE.querySelector(".lr-nib-mask");
  var sparkle = STAGE.querySelector(".lr-sparkle");
  var wordmark = STAGE.querySelector(".lr-wordmark");
  var tagline = STAGE.querySelector(".lr-tagline");
  var skipBtn = STAGE.querySelector(".lr-skip");
  var paths = [].slice.call(STAGE.querySelectorAll(".lr-mask-stroke"));

  var REFERENCE = 3000;   /* the timeline the beats above are written against */
  var RUNTIME = 2200;     /* how long the reveal actually runs on screen */
  var SCALE = RUNTIME / REFERENCE;
  var NIB_MASK_R = 58;
  var finished = false;
  var rafId = null;

  /* ---------------------------------------------------------------- helpers */

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* mostly-linear so the pen keeps its momentum, with a soft start and stop */
  function penEase(t) {
    var s = t * t * (3 - 2 * t);
    return 0.22 * s + 0.78 * t;
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) {
    var c = 1.5;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  function span(now, a, b) { return clamp01((now - a) / (b - a)); }

  /* ------------------------------------------------------- geometry / setup */

  var lens = paths.map(function (p) {
    var L = p.getTotalLength();
    p.style.strokeDasharray = L + " " + (L + 2);
    p.style.strokeDashoffset = L;
    return L;
  });

  function pointOn(i, frac) {
    return paths[i].getPointAtLength(lens[i] * clamp01(frac));
  }

  /* draw phases: [pathIndex, tStart, tEnd, fracStart, fracEnd] */
  var DRAW = [
    [0, 200, 466, 0, 1],
    [1, 466, 697, 0, 1],
    [2, 767, 944, 0, 1],
    [3, 944, 1300, 0, 0.47],
    [3, 1300, 1655, 0.47, 1],
    [4, 1745, 2250, 0, 1]
  ];

  /* pen lifts: [tStart, tEnd, fromPath, fromFrac, toPath, toFrac, arc] */
  var LIFTS = [
    [697, 767, 1, 1, 2, 0, 30],
    [1655, 1745, 3, 1, 4, 0, 38]
  ];

  var ENTRY_FROM = { x: -70, y: 150 };
  var HOME = pointOn(0, 0);

  /* ------------------------------------------------------------- rendering */

  function placePen(x, y, angle, scale, opacity) {
    pen.setAttribute(
      "transform",
      "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" +
        angle.toFixed(2) + ") scale(" + scale.toFixed(3) + ")"
    );
    pen.style.opacity = opacity;
    glow.setAttribute("transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")");
    glow.style.opacity = opacity * 0.85;
  }

  /* a little sway so the pen reads as held, not as a spinning sprite */
  function swayFor(i, frac) {
    var L = lens[i];
    var d = Math.max(1.5, L * 0.004);
    var at = L * clamp01(frac);
    var a = paths[i].getPointAtLength(Math.max(0, at - d));
    var b = paths[i].getPointAtLength(Math.min(L, at + d));
    var deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    /* map the tangent to a narrow band of wrist rotation */
    return Math.max(-9, Math.min(9, Math.sin(deg * Math.PI / 180) * 9));
  }

  function frame(elapsed) {
    var t = clamp01(elapsed / RUNTIME);
    var now = elapsed / SCALE;   /* real time -> reference-timeline time */

    /* --- ink: every stroke's dash offset ---------------------------------- */
    for (var d = 0; d < DRAW.length; d++) {
      var ph = DRAW[d];
      var p = span(now, ph[1], ph[2]);
      if (now < ph[1]) continue;
      var frac = ph[3] + (ph[4] - ph[3]) * penEase(p);
      paths[ph[0]].style.strokeDashoffset = (lens[ph[0]] * (1 - frac)).toFixed(2);
    }

    /* --- pen ------------------------------------------------------------- */
    if (now < 200) {
      var e = easeOut(span(now, 0, 200));
      placePen(
        ENTRY_FROM.x + (HOME.x - ENTRY_FROM.x) * e,
        ENTRY_FROM.y + (HOME.y - ENTRY_FROM.y) * e,
        26 + (1 - e) * 10,
        0.94 + e * 0.06,
        e
      );
    } else if (now <= 2250) {
      var placed = false;
      for (var l = 0; l < LIFTS.length && !placed; l++) {
        var lf = LIFTS[l];
        if (now >= lf[0] && now < lf[1]) {
          var q = span(now, lf[0], lf[1]);
          var s = pointOn(lf[2], lf[3]);
          var f = pointOn(lf[4], lf[5]);
          var lift = Math.sin(Math.PI * q) * lf[6];
          placePen(
            s.x + (f.x - s.x) * q,
            s.y + (f.y - s.y) * q - lift,
            26 + Math.sin(Math.PI * q) * 6,
            0.94 + Math.sin(Math.PI * q) * 0.09,
            1
          );
          glow.style.opacity = 0.18;
          placed = true;
        }
      }
      for (var k = 0; k < DRAW.length && !placed; k++) {
        var pd = DRAW[k];
        if (now >= pd[1] && now <= pd[2]) {
          var pf = pd[3] + (pd[4] - pd[3]) * penEase(span(now, pd[1], pd[2]));
          var pt = pointOn(pd[0], pf);
          placePen(pt.x, pt.y, 26 + swayFor(pd[0], pf), 1, 1);
          placed = true;
        }
      }
      if (!placed) {
        var last = pointOn(4, 1);
        placePen(last.x, last.y, 26, 1, 1);
      }
    } else {
      /* settle and lift away from the finished nib */
      var o = 1 - easeOut(span(now, 2270, 2500));
      var end = pointOn(4, 1);
      placePen(end.x + (1 - o) * 16, end.y - (1 - o) * 26, 26 - (1 - o) * 5, 1 - (1 - o) * 0.08, o);
    }

    /* --- pen-nib detail + gold sparkle ----------------------------------- */
    if (now >= 2200) {
      nibMask.setAttribute("r", (NIB_MASK_R * easeOut(span(now, 2200, 2500))).toFixed(2));
    }
    if (now >= 2250) {
      var sp = span(now, 2250, 2560);
      sparkle.style.opacity = clamp01(sp * 1.6);
      var sc = 0.35 + 0.65 * easeOutBack(sp);
      sparkle.style.transform = "scale(" + sc.toFixed(3) + ") rotate(" + (-24 + 24 * easeOut(sp)).toFixed(2) + "deg)";
    }

    /* --- wordmark -------------------------------------------------------- */
    if (now >= 2550) {
      var w = easeOut(span(now, 2550, 2830));
      wordmark.style.opacity = w;
      wordmark.style.transform = "translateY(" + (10 * (1 - w)).toFixed(2) + "px)";
      wordmark.style.filter = "blur(" + (4 * (1 - w)).toFixed(2) + "px)";
    }
    if (now >= 2790) {
      var g = easeOut(span(now, 2790, 3000));
      tagline.style.opacity = clamp01(g * 1.4);
      var inset = (50 * (1 - g)).toFixed(2) + "%";
      tagline.style.clipPath = "inset(0 " + inset + " 0 " + inset + ")";
      tagline.style.webkitClipPath = tagline.style.clipPath;
    }

    return t >= 1;
  }

  /* ------------------------------------------------------------ final state */

  function settle() {
    for (var i = 0; i < paths.length; i++) paths[i].style.strokeDashoffset = "0";
    nibMask.setAttribute("r", NIB_MASK_R);
    pen.style.opacity = 0;
    glow.style.opacity = 0;
    sparkle.style.opacity = 1;
    sparkle.style.transform = "scale(1) rotate(0deg)";
    wordmark.style.opacity = 1;
    wordmark.style.transform = "none";
    wordmark.style.filter = "none";
    tagline.style.opacity = 1;
    tagline.style.clipPath = "inset(0 0 0 0)";
    tagline.style.webkitClipPath = "inset(0 0 0 0)";
  }

  /* ---------------------------------------------------------------- teardown */

  function dismiss(holdMs) {
    if (finished) return;
    finished = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.setTimeout(function () {
      STAGE.classList.add("is-out");
      root.classList.remove("lr-armed");
      window.setTimeout(function () {
        if (STAGE.parentNode) STAGE.parentNode.removeChild(STAGE);
      }, 520);
    }, holdMs);
  }

  function skip() {
    settle();
    dismiss(120);
  }

  /* ------------------------------------------------------------------- run */

  function start() {
    canvas.classList.add("is-ready");

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settle();
      dismiss(520);
      return;
    }

    STAGE.classList.add("is-skippable");
    if (skipBtn) skipBtn.addEventListener("click", skip);
    STAGE.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Escape" || ev.key === "Enter" || ev.key === " ") {
        window.removeEventListener("keydown", onKey);
        skip();
      }
    });

    var t0 = null;
    rafId = requestAnimationFrame(function step(ts) {
      if (t0 === null) t0 = ts;
      var done = frame(ts - t0);
      if (done) {
        settle();
        dismiss(200);
      } else {
        rafId = requestAnimationFrame(step);
      }
    });

    /* safety net: never trap the visitor behind the overlay */
    window.setTimeout(function () { if (!finished) skip(); }, RUNTIME + 2600);
  }

  /* wait briefly for the artwork so the first frame is never a blank flash */
  var imgs = [].slice.call(STAGE.querySelectorAll("image, img"));
  var pending = 0;
  var launched = false;
  function launch() {
    if (launched) return;
    launched = true;
    start();
  }
  imgs.forEach(function (node) {
    var url = node.getAttribute("href") || node.getAttribute("src");
    if (!url) return;
    pending++;
    var probe = new Image();
    probe.onload = probe.onerror = function () { if (--pending === 0) launch(); };
    probe.src = url;
  });
  if (pending === 0) launch();
  window.setTimeout(launch, 900);
})();
