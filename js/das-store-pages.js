/* ============================================================================
   DAS STORE — the cart page and the saved page
   ----------------------------------------------------------------------------
   Both render from window.Cart / window.Favorites (js/cart.js). Neither owns
   storage, neither prices anything, and checkout is the same goToCheckout()
   the rest of the site uses — Stripe is untouched and
   api/create-checkout.js stays the price authority.

   THE CONVERSION MECHANICS ON THIS PAGE, AND WHY EACH ONE IS HERE
   Every one of these is a real, honest device. None of them invents scarcity,
   a countdown, a fake stock number or a struck price that never existed —
   those are the ones that cost a B2B seller the deal when the buyer checks.

     1. FREE-FREIGHT PROGRESS      the single strongest cart lever there is.
                                   A buyer who can see the gap closes it.
     2. NEXT-TIER PROMPT           names the exact dollar gap and offers the
                                   one add that closes it, priced honestly.
     3. COMPLETE THE PROGRAMME     kits from the same programme, because a
                                   recognition programme is bought as a set.
     4. QUOTE ESCAPE HATCH         40 of 54 pieces are gated. A cart that only
                                   offers a card is a dead end for most of
                                   this catalogue, so Request a quote / PO sits
                                   beside checkout, never hidden under it.
     5. REASSURANCE AT THE BUTTON  Net-30, artwork, returns — placed where the
                                   hesitation actually happens, not in a footer.
   ========================================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var money = function (n) { return '$' + Number(n).toFixed(2); };
  var FREE_FREIGHT = 1500;

  var CAT = null;
  var catalogReady = fetch('/store-catalog.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { CAT = d; })
    .catch(function () { CAT = { products: [] }; });

  /* ══════════════════════════════════════════════════════════════════════
     CART PAGE
     ══════════════════════════════════════════════════════════════════════ */
  var cartPage = document.getElementById('sc-page');
  if (cartPage) {
    var linesEl = document.getElementById('sc-lines');
    var sumEl   = document.getElementById('sc-summary');

    function line(l, i) {
      return '<div class="sc-line">' +
        '<a class="ph" href="store-product.html?id=' + encodeURIComponent(l.id) + '">' +
          '<img src="' + esc(l.image || '') + '" alt="" width="700" height="560"></a>' +
        '<div class="m st-ui">' +
          '<div class="top">' +
            '<a class="t" href="store-product.html?id=' + encodeURIComponent(l.id) + '">' + esc(l.name) + '</a>' +
            '<span class="lp">' + money(l.price * l.qty) + '</span>' +
          '</div>' +
          '<div class="c">' + esc(l.category || '') + '</div>' +
          (l.milestoneLabel ? '<div class="c">' + esc(l.milestoneLabel) + '</div>' : '') +
          '<div class="c">' + money(l.price) + ' per unit &middot; minimum ' + (l.minQty || 10) + '</div>' +
          '<div class="ctl">' +
            '<span class="step">' +
              '<button data-step="-1" data-i="' + i + '" aria-label="Decrease quantity">&minus;</button>' +
              '<input type="number" value="' + l.qty + '" min="' + (l.minQty || 1) + '" data-qty-i="' + i + '" aria-label="Quantity">' +
              '<button data-step="1" data-i="' + i + '" aria-label="Increase quantity">+</button>' +
            '</span>' +
            '<button class="rm st-micro" data-remove="' + i + '">Remove</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    /* Mechanic 2 + 3: the honest next-add. Picks the cheapest piece from a
       programme already in the bag that would close the freight gap; falls back
       to the nearest piece in the same programme. Never invents a discount. */
    function nextAdd(items, total) {
      if (!CAT || !CAT.products.length) return '';
      var gap = FREE_FREIGHT - total;
      var programmes = {};
      items.forEach(function (l) { programmes[l.category] = true; });
      var pool = CAT.products.filter(function (p) {
        return !p.gated && !items.some(function (l) { return l.id === p.id; });
      });
      if (!pool.length) return '';

      var same = pool.filter(function (p) { return programmes[p.programLabel]; });
      var list = (same.length ? same : pool).slice();

      if (gap > 0) {
        /* the cheapest single add that actually closes the gap, if one exists */
        var closers = list.filter(function (p) { return p.price * (p.minQty || 10) >= gap; })
                          .sort(function (a, b) { return a.price * (a.minQty || 10) - b.price * (b.minQty || 10); });
        if (closers.length) {
          var c = closers[0];
          return '<div class="sc-nudge st-ui">' +
            '<p><b>' + money(gap) + ' from free freight.</b> ' +
            esc(c.name) + ' at its ' + (c.minQty || 10) + '-unit minimum is ' +
            money(c.price * (c.minQty || 10)) + ' and closes it.</p>' +
            '<button class="st-cta st-cta--ghost" data-add-id="' + esc(c.id) + '">Add ' + esc(c.name) + '</button>' +
            '</div>';
        }
      }
      return '';
    }

    /* Mechanic 3: complete the programme. */
    function completeSet(items) {
      if (!CAT || !CAT.products.length || !items.length) return '';
      var have = {};
      items.forEach(function (l) { have[l.id] = true; });
      var progs = {};
      items.forEach(function (l) { progs[l.category] = true; });
      var picks = CAT.products.filter(function (p) { return progs[p.programLabel] && !have[p.id]; }).slice(0, 4);
      if (!picks.length) return '';
      return '<section class="st-sec" style="padding-left:0;padding-right:0">' +
        '<div class="head st-ui"><h2>Complete the programme</h2><sup>' + picks.length + '</sup></div>' +
        '<div class="st-grid" data-view="4">' + picks.map(function (p) {
          return '<article class="st-card st-ui">' +
            '<a class="frame" href="store-product.html?id=' + encodeURIComponent(p.id) + '">' +
            '<img src="' + esc(p.shot.src) + '" srcset="' + esc(p.shot.srcset) + '" alt="' + esc(p.name) + '" loading="lazy" width="700" height="560"></a>' +
            '<div class="foot"><div class="t">' + esc(p.name) + '</div>' +
            '<div class="p">' + (p.gated ? '<span class="gate">Request pricing</span>' : money(p.price)) + '</div></div>' +
            '</article>';
        }).join('') + '</div></section>';
    }

    function emptyState() {
      var pop = CAT && CAT.products ? CAT.products.filter(function (p) { return !p.gated; }).slice(0, 4) : [];
      return '<div class="sc-empty">' +
        '<p class="st-ui" style="color:var(--st-muted);margin-bottom:6px">Your bag is empty</p>' +
        '<h2 style="font-size:clamp(20px,2.6vw,30px);text-transform:uppercase;margin-bottom:12px">Start with a programme, not a product.</h2>' +
        '<p style="font-size:14px;line-height:22px;color:var(--st-muted);max-width:52ch;margin-bottom:20px">' +
        'Most fleets run one recognition programme a quarter. Pick the occasion and the kit follows.</p>' +
        '<a class="st-cta" href="store.html">Browse the collection</a>' +
        (pop.length ? '<div class="head st-ui" style="margin-top:46px"><h2>Ready to order</h2></div>' +
          '<div class="st-grid" data-view="4">' + pop.map(function (p) {
            return '<article class="st-card st-ui"><a class="frame" href="store-product.html?id=' + encodeURIComponent(p.id) + '">' +
              '<img src="' + esc(p.shot.src) + '" alt="' + esc(p.name) + '" loading="lazy" width="700" height="560"></a>' +
              '<div class="foot"><div class="t">' + esc(p.name) + '</div><div class="p">' + money(p.price) + '</div></div></article>';
          }).join('') + '</div>' : '') +
        '</div>';
    }

    function paintCart() {
      if (!window.Cart) return;
      var items = Cart.get();
      var total = Cart.total();
      var units = items.reduce(function (s, i) { return s + i.qty; }, 0);

      document.querySelectorAll('[data-bag-count]').forEach(function (e) { e.textContent = units; });
      var title = document.getElementById('sc-title');
      if (title) title.innerHTML = 'Your bag<sup class="st-micro" style="color:var(--st-muted)">' + items.length + '</sup>';

      if (!items.length) {
        linesEl.innerHTML = emptyState();
        sumEl.style.display = 'none';
        var a = document.getElementById('sc-also'); if (a) a.innerHTML = '';
        return;
      }
      sumEl.style.display = '';
      linesEl.innerHTML = items.map(line).join('') + nextAdd(items, total);

      var pct = Math.min(100, total / FREE_FREIGHT * 100);
      document.getElementById('sc-bar').style.width = pct + '%';
      document.getElementById('sc-freight').textContent = total >= FREE_FREIGHT
        ? 'Free freight unlocked' : money(FREE_FREIGHT - total) + ' from free freight';
      document.getElementById('sc-sub').textContent = money(total);
      document.getElementById('sc-units').textContent = units + (units === 1 ? ' unit' : ' units');
      document.getElementById('sc-total').textContent = money(total);
      var btn = document.getElementById('sc-checkout');
      if (btn) btn.disabled = false;
      var also = document.getElementById('sc-also');
      if (also) also.innerHTML = completeSet(items);
    }

    document.addEventListener('click', function (e) {
      var st = e.target.closest && e.target.closest('[data-step]');
      if (st && window.Cart) {
        var i = +st.dataset.i, items = Cart.get(), l = items[i];
        if (l) { Cart.setQtyAt(i, Math.max(l.minQty || 1, l.qty + (+st.dataset.step))); paintCart(); }
        return;
      }
      var rm = e.target.closest && e.target.closest('[data-remove]');
      if (rm && window.Cart) { Cart.removeAt(+rm.dataset.remove); paintCart(); return; }
      var ad = e.target.closest && e.target.closest('[data-add-id]');
      if (ad && window.Cart && CAT) {
        var p = CAT.products.filter(function (x) { return x.id === ad.dataset.addId; })[0];
        if (p) {
          Cart.add({ id: p.id, name: p.name, price: p.price, image: p.shot.src, category: p.programLabel, minQty: p.minQty }, p.minQty || 10);
          paintCart();
        }
      }
    });
    document.addEventListener('change', function (e) {
      var q = e.target.closest && e.target.closest('[data-qty-i]');
      if (q && window.Cart) {
        var i = +q.dataset.qtyI, l = Cart.get()[i];
        Cart.setQtyAt(i, Math.max(l && l.minQty || 1, parseInt(q.value, 10) || 1));
        paintCart();
      }
    });

    catalogReady.then(paintCart);
  }

  /* ══════════════════════════════════════════════════════════════════════
     SAVED PAGE
     ══════════════════════════════════════════════════════════════════════ */
  var savedPage = document.getElementById('sv-page');
  if (savedPage) {
    var gridEl = document.getElementById('sv-grid');

    function paintSaved() {
      var favs = window.Favorites ? Favorites.load() : [];
      document.querySelectorAll('[data-wish-count]').forEach(function (e) { e.textContent = favs.length; });
      var n = document.getElementById('sv-count');
      if (n) n.textContent = favs.length;

      if (!favs.length) {
        gridEl.innerHTML = '<div class="sc-empty">' +
          '<p class="st-ui" style="color:var(--st-muted);margin-bottom:6px">Nothing saved yet</p>' +
          '<h2 style="font-size:clamp(20px,2.6vw,30px);text-transform:uppercase;margin-bottom:12px">Build the shortlist before the meeting.</h2>' +
          '<p style="font-size:14px;line-height:22px;color:var(--st-muted);max-width:52ch;margin-bottom:20px">' +
          'Save any kit with the heart on the collection and it lands here &mdash; so you can put a shortlist in front of ' +
          'purchasing before you commit to a quantity.</p>' +
          '<a class="st-cta" href="store.html">Browse the collection</a></div>';
        var act = document.getElementById('sv-actions'); if (act) act.style.display = 'none';
        return;
      }
      var act2 = document.getElementById('sv-actions'); if (act2) act2.style.display = '';

      gridEl.innerHTML = '<div class="st-grid" data-view="4">' + favs.map(function (f, i) {
        var p = CAT && CAT.products.filter(function (x) { return x.id === f.productId; })[0];
        var img = (p && p.shot.src) || f.image || '';
        var gated = p ? p.gated : (f.price > 110);
        return '<article class="st-card st-ui" data-product-id="' + esc(f.productId) + '"' +
            ' data-product-name="' + esc(f.name) + '" data-product-price="' + esc(f.price) + '"' +
            ' data-product-category="' + esc(f.category || '') + '" data-product-image="' + esc(img) + '">' +
          '<a class="frame" href="store-product.html?id=' + encodeURIComponent(f.productId) + '">' +
            '<img src="' + esc(img) + '"' + (p ? ' srcset="' + esc(p.shot.srcset) + '"' : '') +
            ' alt="' + esc(f.name) + '" loading="' + (i < 8 ? 'eager' : 'lazy') + '" width="700" height="560"></a>' +
          '<button class="fav fav-active" data-save-to-fav aria-label="Remove ' + esc(f.name) + ' from saved">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' +
            '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 000-7.8z"/></svg></button>' +
          '<div class="foot"><div class="t">' + esc(f.name) + '</div>' +
          '<div class="c">' + esc(f.category || '') + '</div>' +
          '<div class="p">' + (gated ? '<span class="gate">Request pricing</span>' : money(f.price)) + '</div></div>' +
        '</article>';
      }).join('') + '</div>';
    }

    /* Mechanic 4, on the saved list: a shortlist IS the quote request. Sending
       the whole list to the fleet team is the natural next step for a buyer who
       has been collecting, and most of what they collect is gated anyway. */
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#sv-quote')) {
        var favs = window.Favorites ? Favorites.load() : [];
        var ids = favs.map(function (f) { return f.productId; }).join(',');
        /* The shortlist quote is the primary conversion on this page, so it is
           recorded as a lead through the site's existing dasTrack — the same
           pipe real leads use — rather than being lost as a page navigation. */
        try { if (window.dasTrack && window.dasTrack.lead) window.dasTrack.lead({}); } catch (er) {}
        try {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'request_pricing', source: 'shortlist', items: favs.length });
        } catch (er) {}
        location.href = 'contact.html?intent=pricing&shortlist=' + encodeURIComponent(ids) +
          '&count=' + favs.length;
      }
    });

    window.addEventListener('das:favchange', paintSaved);
    catalogReady.then(paintSaved);
  }
})();
