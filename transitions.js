(function () {
  var PAGE = document.body.dataset.page || 'doc';

  /* ── Particle helpers ── */
  function makeParticle(W, H) {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(0.6 + Math.random() * 1.0),
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.022 + Math.random() * 0.028,
      r: 1.2 + Math.random() * 2.2,
      alpha: 0.45 + Math.random() * 0.45,
      born: null,
      lifespan: 1400 + Math.random() * 800,
    };
  }

  function tickParticle(ctx, p, now) {
    if (!p.born) p.born = now;
    var age = (now - p.born) / p.lifespan;
    if (age >= 1) return false;

    p.wobble += p.wobbleSpeed;
    p.x += p.vx + Math.sin(p.wobble) * 0.25;
    p.y += p.vy;

    var fade = age < 0.15 ? age / 0.15 : age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1;
    var a = p.alpha * fade;
    if (a <= 0.01) return true;

    var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.8);
    g.addColorStop(0,    'rgba(255,255,255,' + a + ')');
    g.addColorStop(0.35, 'rgba(185,220,255,' + (a * 0.55) + ')');
    g.addColorStop(1,    'rgba(100,160,255,0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    return true;
  }

  /* ── Bfcache cleanup: remove any canvas left over when browser restores from cache ── */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      document.querySelectorAll('canvas.tr-overlay').forEach(function (c) { c.remove(); });
      ov.style.animation = '';
      ov.style.opacity   = '0';
    }
  });

  /* ── Star-bubble exit: particles pop up and float across the page ── */
  function playStarBubble(destUrl) {
    var W = window.innerWidth, H = window.innerHeight;
    var cvs = document.createElement('canvas');
    cvs.className = 'tr-overlay';
    cvs.width = W; cvs.height = H;
    cvs.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
    document.body.appendChild(cvs);
    var ctx = cvs.getContext('2d');

    var particles = [];
    var DURATION = 700;
    var start = null;
    var lastSpawn = 0;

    function frame(now) {
      if (!start) { start = now; lastSpawn = now; }
      var t = Math.min((now - start) / DURATION, 1);

      ctx.clearRect(0, 0, W, H);

      /* Accelerating spawn — more stars appear as transition progresses */
      var target = Math.round(t * t * 75 + t * 25);
      if (particles.length < target && now - lastSpawn > 8) {
        particles.push(makeParticle(W, H));
        lastSpawn = now;
      }

      for (var i = particles.length - 1; i >= 0; i--) {
        if (!tickParticle(ctx, particles[i], now)) particles.splice(i, 1);
      }

      if (t < 1) requestAnimationFrame(frame);
      else if ('startViewTransition' in document) {
        document.startViewTransition(function () { window.location.href = destUrl; });
      } else {
        window.location.href = destUrl;
      }
    }

    requestAnimationFrame(frame);
  }

  /* ── Star-reveal entrance: pre-seeded particles drift away to reveal page ── */
  function playStarReveal() {
    var W = window.innerWidth, H = window.innerHeight;
    var cvs = document.createElement('canvas');
    cvs.className = 'tr-overlay';
    cvs.width = W; cvs.height = H;
    cvs.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
    document.body.appendChild(cvs);
    var ctx = cvs.getContext('2d');

    var particles = [];
    var now0 = performance.now();

    /* Scatter 100 particles at various stages of their life so the screen
       feels already full of stars and they gradually drift away */
    for (var i = 0; i < 100; i++) {
      var p = makeParticle(W, H);
      p.born = now0 - Math.random() * 800;
      particles.push(p);
    }

    function frame(now) {
      ctx.clearRect(0, 0, W, H);

      for (var i = particles.length - 1; i >= 0; i--) {
        if (!tickParticle(ctx, particles[i], now)) particles.splice(i, 1);
      }

      if (particles.length > 0) requestAnimationFrame(frame);
      else cvs.remove();
    }

    requestAnimationFrame(frame);
  }

  /* ── CSS keyframes for non-warp transitions + View Transitions API ── */
  var CSS = [
    '@keyframes enter-doc  { from{background:rgba(2,6,23,.97);transform:translateY(0)} to{background:rgba(2,6,23,.97);transform:translateY(100%)} }',
    '@keyframes exit-to-doc   { from{background:rgba(2,6,23,.97);transform:translateY(-100%)} to{background:rgba(2,6,23,.97);transform:translateY(0)} }',
    '@keyframes exit-slide-r  { from{background:#000;transform:translateX(100%)} to{background:#000;transform:translateX(0)} }',
    '@keyframes exit-slide-l  { from{background:#000;transform:translateX(-100%)} to{background:#000;transform:translateX(0)} }',
    '@keyframes exit-default  { from{background:#000;opacity:0} to{background:#000;opacity:1} }',
    '@keyframes vt-depart { to   { opacity:0; transform:scale(0.96); filter:blur(3px); } }',
    '@keyframes vt-arrive { from { opacity:0; transform:scale(1.04); filter:blur(3px); } }',
    '::view-transition-old(root) { animation: 320ms ease-in  vt-depart; }',
    '::view-transition-new(root) { animation: 320ms ease-out vt-arrive; }',
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;will-change:transform,opacity;';
  document.body.appendChild(ov);

  /* ── Entrance ── */
  if (PAGE === 'udte-landing' || PAGE === 'sim') {
    playStarReveal();
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

    var goingToSim  = /sun-venus|n-body|barnes-hut/.test(dest);
    var goingToUdte = /\/UDTE\/?($|index)/.test(dest) && !goingToSim;

    if (goingToSim || goingToUdte) {
      playStarBubble(dest);
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

    /* Back to portfolio hub */
    if (/quequsai\.github\.io\/?$/.test(dest)) {
      playStarBubble(dest);
      return;
    }

    /* Default */
    ov.style.opacity   = '';
    ov.style.animation = 'exit-default 400ms ease forwards';
    ov.addEventListener('animationend', function () { window.location.href = dest; }, { once: true });
  });
})();
