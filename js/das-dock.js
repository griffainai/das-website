/* ============================================================================
   THE ACTION DOCK — one owner for the bottom-right corner.

   Born from a real defect: chat.js pinned #das-scout-btn at bottom:24 right:24
   z-index:9999 while quote.js pinned #das-quote-pill at bottom:18 right:18
   z-index:9000. Two independent widgets claiming the same corner, Scout winning
   on z-index — so a fleet buyer who had assembled a multi-item quote could not
   see or click the button that submits it. Verified before the fix:
   elementFromPoint() at the dead centre of the quote pill returned the Scout
   button, not the pill.

   z-index tuning would have made this look fixed until the next widget arrives.
   Instead the corner gets a single owner: anything that wants to live there
   becomes a CHILD of #das-dock and they stack in a flex column. Collision
   becomes impossible by construction rather than by coordination.

   Contract for any future widget:
       DASDock.mount(el, order)   // lower order sits higher up the stack
   Never position-fix anything to the bottom-right again.
   ============================================================================ */
(function () {
  'use strict';

  var DOCK_ID = 'das-dock';

  function styles() {
    if (document.getElementById('das-dock-styles')) return;
    var s = document.createElement('style');
    s.id = 'das-dock-styles';
    s.textContent = [
      '#das-dock{position:fixed;right:24px;bottom:24px;z-index:9999;',
      '  display:flex;flex-direction:column;align-items:flex-end;gap:10px;',
      /* the dock itself must never swallow clicks in the gaps between children */
      '  pointer-events:none}',
      '#das-dock>*{pointer-events:auto}',
      /* while the Scout panel is open the quote pill hides: the panel would
         cover it anyway, and two competing CTAs in one corner is the original
         defect wearing a different hat */
      /* the dock owns layout for its children; quote.js used to set these
         inline, which outranked every rule here */
      '#das-dock #das-quote-pill{display:inline-flex;align-items:center;gap:8px}',
      '#das-dock[data-panel="1"] #das-quote-pill{display:none}',
      '@media (max-width:560px){',
      '  #das-dock{right:12px;bottom:12px}',
      /* two full-width pills stacked is too much furniture on a phone, so Scout
         drops its label whenever a live quote is sharing the corner */
      '  #das-dock[data-quote="1"] #das-scout-btn{padding:14px;gap:0}',
      '  #das-dock[data-quote="1"] #das-scout-btn span{display:none}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function dock() {
    var d = document.getElementById(DOCK_ID);
    if (!d) {
      styles();
      d = document.createElement('div');
      d.id = DOCK_ID;
      document.body.appendChild(d);
    }
    return d;
  }

  function reorder(d) {
    var kids = Array.prototype.slice.call(d.children);
    kids.sort(function (a, b) {
      return (+a.dataset.dockOrder || 50) - (+b.dataset.dockOrder || 50);
    });
    kids.forEach(function (k) { d.appendChild(k); });
    d.dataset.quote = document.getElementById('das-quote-pill') ? '1' : '0';
  }

  window.DASDock = {
    /* Move an element into the dock. Strips the fixed positioning it arrived
       with, because inside a flex column those coordinates are what caused the
       collision in the first place. */
    mount: function (el, order) {
      if (!el) return el;
      var d = dock();
      el.dataset.dockOrder = order == null ? 50 : order;
      el.style.position = 'static';
      el.style.right = '';
      el.style.bottom = '';
      el.style.left = '';
      el.style.top = '';
      el.style.zIndex = '';
      if (el.parentNode !== d) d.appendChild(el);
      reorder(d);
      return el;
    },
    /* Scout tells the dock when its panel opens so the quote pill can step
       aside rather than be covered. */
    setPanelOpen: function (open) {
      dock().dataset.panel = open ? '1' : '0';
    },
    el: dock
  };
})();
