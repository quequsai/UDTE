(function () {
  var PAGE = document.body.dataset.page || 'doc';

  var CSS = [
    /* ── Entrance animations (overlay covers page → animates to reveal) ── */
    /* UDTE landing: white circle contracts — arriving from warp */
    '@keyframes enter-udte { from{background:#ffffff;clip-path:circle(150% at 50% 50%)} to{background:#ffffff;clip-path:circle(0% at 50% 50%)} }',
    /* Sim pages: black fade out */
    '@keyframes enter-sim  { from{background:#000000;opacity:1} to{background:#000000;opacity:0} }',
    /* Doc pages: dark navy panel sweeps down off screen */
    '@keyframes enter-doc  { from{background:rgba(2,6,23,0.97);transform:translateY(0)} to{background:rgba(2,6,23,0.97);transform:translateY(100%)} }',

    /* ── Exit animations (overlay hidden → covers page) ── */
    /* → Hub (portfolio): warp burst */
    '@keyframes exit-warp     { from{background:#ffffff;clip-path:circle(0% at 50% 50%)} to{background:#ffffff;clip-path:circle(150% at 50% 50%)} }',
    /* → Sim pages: black fade in */
    '@keyframes exit-to-sim   { from{background:#000000;opacity:0} to{background:#000000;opacity:1} }',
    /* → Doc/Report pages: dark panel slides in from top */
    '@keyframes exit-to-doc   { from{background:rgba(2,6,23,0.97);transform:translateY(-100%)} to{background:rgba(2,6,23,0.97);transform:translateY(0)} }',
    /* Sim→Sim directional slides */
    '@keyframes exit-slide-r  { from{background:#000000;transform:translateX(100%)} to{background:#000000;transform:translateX(0)} }',
    '@keyframes exit-slide-l  { from{background:#000000;transform:translateX(-100%)} to{background:#000000;transform:translateX(0)} }',
    /* default */
    '@keyframes exit-default  { from{background:#000000;opacity:0} to{background:#000000;opacity:1} }',
  ].join('\n');

  var s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);

  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;will-change:transform,opacity;';
  document.body.appendChild(ov);

  /* ── entrance ── */
  var ENTER = {
    'udte-landing': 'enter-udte 700ms ease forwards',
    sim:            'enter-sim  400ms ease forwards',
    doc:            'enter-doc  400ms ease forwards',
  };
  var entAnim = ENTER[PAGE];
  if (entAnim) {
    ov.style.animation = entAnim;
    ov.addEventListener('animationend', function () {
      ov.style.animation = '';
      ov.style.opacity   = '0';
    }, { once: true });
  }

  /* sim order for directional slides */
  var SIM_ORDER = { 'sun-venus': 0, 'n-body': 1, 'barnes-hut': 2 };
  function currentSimIndex() {
    var p = location.pathname;
    if (/sun-venus/.test(p))  return 0;
    if (/n-body/.test(p))     return 1;
    if (/barnes-hut/.test(p)) return 2;
    return -1;
  }

  /* ── exit ── */
  function getExit(href) {
    /* back to portfolio hub */
    if (/quequsai\.github\.io\/?$/.test(href) || /quequsai\.github\.io\/?[?#]/.test(href)) {
      return 'exit-warp 550ms ease forwards';
    }
    /* sim → sim: directional slide */
    if (/sun-venus|n-body|barnes-hut/.test(href)) {
      var destOrder = /sun-venus/.test(href) ? 0 : /n-body/.test(href) ? 1 : 2;
      var currOrder = currentSimIndex();
      if (currOrder >= 0) {
        return destOrder > currOrder
          ? 'exit-slide-l 350ms ease forwards'
          : 'exit-slide-r 350ms ease forwards';
      }
      return 'exit-to-sim 350ms ease forwards';
    }
    /* → any simulation */
    if (/\/UDTE\//.test(href) && /sun-venus|n-body|barnes-hut/.test(href)) {
      return 'exit-to-sim 350ms ease forwards';
    }
    /* → report or docs */
    if (/\/report\b|\/docs\b/.test(href)) {
      return 'exit-to-doc 400ms ease forwards';
    }
    /* → UDTE landing or any sim from doc/landing */
    if (/\/UDTE\/?$/.test(href) || /\/UDTE\/?(index\.html)?$/.test(href)) {
      return 'exit-to-sim 350ms ease forwards';
    }
    return 'exit-default 400ms ease forwards';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#' || /^mailto:|^tel:/.test(raw)) return;
    if (a.target === '_blank') return;
    e.preventDefault();
    var dest = a.href || new URL(raw, location.href).href;
    ov.style.opacity   = '';
    ov.style.animation = getExit(dest);
    ov.addEventListener('animationend', function () {
      window.location.href = dest;
    }, { once: true });
  });
})();
