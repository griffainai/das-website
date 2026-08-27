/* ============================================================================
   DAS ILLUSTRATION SPRITE — INLINE LOADER

   Why this file exists: iOS Safari has NEVER supported external SVG <use>
   references (use href="/images/sprite.svg#id"). Chrome resolves them; Safari
   silently renders nothing — which is why every sprite mark on the site showed
   as an empty chip on iPhones even after the sprite file itself was fixed
   (2026-08-27, the double-hyphen XML bug).

   The universal pattern: fetch the sprite ONCE, inject it inline at the top of
   <body>, and reference symbols with LOCAL fragments (use href="#das-kit").
   Local use resolves everywhere, and resolves retroactively — marks already in
   the DOM light up the moment the symbols arrive.
   ============================================================================ */
(function () {
  'use strict';
  var SPRITE_URL = '/images/das-illustrations.svg?v=2';
  var HOST_ID = 'das-sprite-host';

  function inject() {
    if (document.getElementById(HOST_ID)) return;
    fetch(SPRITE_URL)
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (txt) {
        if (document.getElementById(HOST_ID)) return;
        var host = document.createElement('div');
        host.id = HOST_ID;
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        host.innerHTML = txt;
        document.body.insertBefore(host, document.body.firstChild);
      })
      .catch(function () { /* icons degrade to empty space; never break the page */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
  window.DASSpriteInject = inject;
})();
