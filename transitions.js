(function () {
  var PAGE = document.body.dataset.page || 'doc';

  /* ── Seeded RNG (matches UDTE/hub starfield, seed 42) ── */
  function seededRng(seed) {
    var s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  /* ── Canvas hyperspace: stars stretch outward, fade to dark ── */
  function playHyperspace(destUrl) {
    var W = window.innerWidth, H = window.innerHeight;
    var cx = W / 2, cy = H / 2;
    var maxDim = Math.sqrt(W * W + H * H);

    var cvs = document.createElement('canvas');
    cvs.width = W;
    cvs.height = H;
    cvs.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
    document.body.appendChild(cvs);
    var ctx = cvs.getContext('2d');

    var rng = seededRng(42);
    var stars = [];
    for (var i = 0; i < 500; i++) {
      var sx = rng() * W, sy = rng() * H;
      var sr = rng() * 1.2 + 0.2, sa = rng() * 0.6 + 0.1;
      var angle = Math.atan2(sy - cy, sx - cx);
      stars.push({ ox: sx, oy: sy, angle: angle, r: sr, a: sa });
    }

    var DURATION = 1400;
    var start = null;

    function ease(t) {
      return t < 0.35 ? t * t * 0.816 : 0.1 + Math.pow((t - 0.35) / 0.65, 2.6) * 0.9;
    }

    function frame(now) {
      if (!start) start = now;
      var t = Math.min((now - start) / DURATION, 1);
      var e = ease(t);

      var bgA = 0.08 + e * 0.65;
      ctx.fillStyle = 'rgba(0,0,12,' + bgA + ')';
      ctx.fillRect(0, 0, W, H);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var travel   = e * maxDim * 1.5;
        var hx = s.ox + Math.cos(s.angle) * travel;
        var hy = s.oy + Math.sin(s.angle) * travel;
        var trailLen = Math.max(0, e - 0.08) * maxDim * 0.55;
        var tx = s.ox + Math.cos(s.angle) * Math.max(0, travel - trailLen);
        var ty = s.oy + Math.sin(s.angle) * Math.max(0, travel - trailLen);
        if (travel - trailLen > maxDim * 1.6) continue;
        var alpha = s.a * Math.min(1, e * 8 + 0.25);
        if (e < 0.1) {
          ctx.beginPath();
          ctx.arc(s.ox, s.oy, s.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,' + (s.a * (0.3 + e / 0.1 * 0.7)) + ')';
          ctx.fill();
        } else {
          var grad = ctx.createLinearGradient(tx, ty, hx, hy);
          grad.addColorStop(0,   'rgba(100,190,255,0)');
          grad.addColorStop(0.3, 'rgba(160,215,255,' + (alpha * 0.45) + ')');
          grad.addColorStop(1,   'rgba(255,255,255,' + alpha + ')');
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
          ctx.strokeStyle = grad;
          ctx.lineWidth = s.r * 1.1;
          ctx.stroke();
        }
      }

      if (t > 0.87) {
        ctx.fillStyle = 'rgba(0,0,12,' + ((t - 0.87) / 0.13) + ')';
        ctx.fillRect(0, 0, W, H);
      }

      if (t < 1) { requestAnimationFrame(frame); }
      else { window.location.href = destUrl; }
    }

    requestAnimationFrame(frame);
  }

  /* ── Canvas deceleration: streaks contract to dots, canvas fades out ── */
  function playDeceleration() {
    var W = window.innerWidth, H = window.innerHeight;
    var cx = W / 2, cy = H / 2;
    var maxDim = Math.sqrt(W * W + H * H);

    var cvs = document.createElement('canvas');
    cvs.width = W;
    cvs.height = H;
    cvs.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;transition:opacity 0.35s ease;';
    document.body.appendChild(cvs);
    var ctx = cvs.getContext('2d');

    /* Fill immediately so the page doesn't flash before animation starts */
    ctx.fillStyle = '#00000f';
    ctx.fillRect(0, 0, W, H);

    var rng = seededRng(42);
    var stars = [];
    for (var i = 0; i < 500; i++) {
      var sx = rng() * W, sy = rng() * H;
      var sr = rng() * 1.2 + 0.2, sa = rng() * 0.6 + 0.1;
      var angle = Math.atan2(sy - cy, sx - cx);
      stars.push({ ox: sx, oy: sy, angle: angle, r: sr, a: sa });
    }

    var DURATION = 950;
    var start = null;

    /* Decelerating: fast start, slow end */
    function easeOut(t) {
      return 1 - Math.pow(1 - t, 2.8);
    }

    function frame(now) {
      if (!start) start = now;
      var t = Math.min((now - start) / DURATION, 1);
      var e = easeOut(t); /* e: 0→1, fast then slow */

      /* Background fades from opaque to transparent as stars settle */
      var bgA = 0.9 - e * 0.88;
      ctx.fillStyle = 'rgba(0,0,12,' + Math.max(0, bgA) + ')';
      ctx.fillRect(0, 0, W, H);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];

        /* Streaks start far out and contract toward resting positions */
        var remaining = (1 - e);
        var travel    = remaining * maxDim * 1.3;
        var trailLen  = remaining * maxDim * 0.5;

        var hx = s.ox + Math.cos(s.angle) * travel;
        var hy = s.oy + Math.sin(s.angle) * travel;
        var tx = s.ox + Math.cos(s.angle) * Math.max(0, travel - trailLen);
        var ty = s.oy + Math.sin(s.angle) * Math.max(0, travel - trailLen);

        var alpha = s.a * Math.min(1, remaining * 5);

        if (e > 0.82) {
          /* Near rest: transition to dot */
          var dotA = s.a * Math.min(1, (1 - e) * 8);
          ctx.beginPath();
          ctx.arc(s.ox, s.oy, s.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,' + dotA + ')';
          ctx.fill();
        } else {
          var grad = ctx.createLinearGradient(hx, hy, tx, ty);
          grad.addColorStop(0,   'rgba(255,255,255,' + alpha + ')');
          grad.addColorStop(0.5, 'rgba(160,215,255,' + (alpha * 0.5) + ')');
          grad.addColorStop(1,   'rgba(100,190,255,0)');
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
          ctx.strokeStyle = grad;
          ctx.lineWidth = s.r * 1.1;
          ctx.stroke();
        }
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        /* Fade canvas out over 0.35s to reveal the page */
        cvs.style.opacity = '0';
        cvs.addEventListener('transitionend', function () { cvs.remove(); }, { once: true });
      }
    }

    requestAnimationFrame(frame);
  }

  /* ── CSS keyframes for non-warp transitions ── */
  var CSS = [
    '@keyframes enter-doc  { from{background:rgba(2,6,23,.97);transform:translateY(0)} to{background:rgba(2,6,23,.97);transform:translateY(100%)} }',
    '@keyframes exit-to-doc   { from{background:rgba(2,6,23,.97);transform:translateY(-100%)} to{background:rgba(2,6,23,.97);transform:translateY(0)} }',
    '@keyframes exit-slide-r  { from{background:#000;transform:translateX(100%)} to{background:#000;transform:translateX(0)} }',
    '@keyframes exit-slide-l  { from{background:#000;transform:translateX(-100%)} to{background:#000;transform:translateX(0)} }',
    '@keyframes exit-default  { from{background:#000;opacity:0} to{background:#000;opacity:1} }',
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;will-change:transform,opacity;';
  document.body.appendChild(ov);

  /* ── Entrance ── */
  if (PAGE === 'udte-landing' || PAGE === 'sim') {
    playDeceleration();
  } else if (PAGE === 'doc') {
    ov.style.animation = 'enter-doc 400ms ease forwards';
    ov.addEventListener('animationend', function () {
      ov.style.animation = '';
      ov.style.opacity   = '0';
    }, { once: true });
  }

  /* ── Sim order for directional slides ── */
  function currentSimIndex() {
    var p = location.pathname;
    if (/sun-venus/.test(p))  return 0;
    if (/n-body/.test(p))     return 1;
    if (/barnes-hut/.test(p)) return 2;
    return -1;
  }

  /* ── Exit click handler ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#' || /^mailto:|^tel:/.test(raw)) return;
    if (a.target === '_blank') return;
    e.preventDefault();
    var dest = a.href || new URL(raw, location.href).href;

    /* Navigating to a simulation or UDTE landing from docs/report → warp */
    var goingToSim = /sun-venus|n-body|barnes-hut/.test(dest);
    var goingToUdte = /\/UDTE\/?($|index)/.test(dest) && !goingToSim;

    if (goingToSim || goingToUdte) {
      playHyperspace(dest);
      return;
    }

    /* Directional slide between sim pages */
    if (goingToSim && PAGE === 'sim') {
      var destOrder = /sun-venus/.test(dest) ? 0 : /n-body/.test(dest) ? 1 : 2;
      var currOrder = currentSimIndex();
      var slideAnim = currOrder >= 0 && destOrder > currOrder
        ? 'exit-slide-l 350ms ease forwards'
        : 'exit-slide-r 350ms ease forwards';
      ov.style.opacity   = '';
      ov.style.animation = slideAnim;
      ov.addEventListener('animationend', function () { window.location.href = dest; }, { once: true });
      return;
    }

    /* Doc/report pages */
    if (/\/report\b|\/docs\b/.test(dest)) {
      ov.style.opacity   = '';
      ov.style.animation = 'exit-to-doc 400ms ease forwards';
      ov.addEventListener('animationend', function () { window.location.href = dest; }, { once: true });
      return;
    }

    /* Back to portfolio hub: warp out */
    if (/quequsai\.github\.io\/?$/.test(dest)) {
      playHyperspace(dest);
      return;
    }

    /* Default */
    ov.style.opacity   = '';
    ov.style.animation = 'exit-default 400ms ease forwards';
    ov.addEventListener('animationend', function () { window.location.href = dest; }, { once: true });
  });
})();
