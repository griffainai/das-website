/* =============================================
   DAS — Frequently Bought Together widget (public PDP)
   Loaded on product.html. Reads upsell_rules from /api/upsell-rules
   and renders an Amazon-style 3-checkbox bundle below add-to-cart.
   Pricing math follows the portal: 15% off 3 items / 12% off 2 items.
   ============================================= */

(function () {
  'use strict';

  function fmtMoney(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) Object.entries(props).forEach(function (entry) {
      const k = entry[0], v = entry[1];
      if (k === 'className')      node.className   = v;
      else if (k === 'innerHTML') node.innerHTML   = v;
      else if (k === 'dataset')   Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    });
    if (children) children.forEach(function (c) {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  async function loadRules(triggerSku) {
    try {
      const res = await fetch('/api/upsell-rules?placement=pdp_fbt&triggerSku=' + encodeURIComponent(triggerSku));
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.rules) ? data.rules : [];
    } catch (err) {
      console.warn('[fbt] failed to load rules', err);
      return [];
    }
  }

  function discountForCount(n) {
    // Mirrors the portal widget exactly
    if (n >= 3) return 0.15;
    if (n === 2) return 0.12;
    return 0;
  }

  function render(container, product, companions) {
    if (companions.length === 0) return;

    const state = { selected: new Set(companions.map(function (c) { return c.id; })) };

    function items() {
      return [product].concat(companions.filter(function (c) { return state.selected.has(c.id); }));
    }

    function totals() {
      const list = items();
      const sum   = list.reduce(function (s, p) { return s + Number(p.price); }, 0);
      const pct   = discountForCount(list.length);
      const price = Math.round(sum * (1 - pct) * 100) / 100;
      const save  = Math.round((sum - price) * 100) / 100;
      return { sum: sum, price: price, save: save, pct: pct, count: list.length };
    }

    function paint() {
      const t = totals();
      container.innerHTML = '';
      const wrap = el('div', { className: 'fbt-card' });

      wrap.appendChild(el('p', { className: 'fbt-eyebrow' }, ['Frequently Bought Together']));

      const row = el('div', { className: 'fbt-row' });
      // Main (always-on)
      row.appendChild(el('div', { className: 'fbt-tile fbt-tile-on' }, [
        product.image_url ? el('img', { src: product.image_url, alt: product.name }) : null,
        el('p', { className: 'fbt-name' },  [product.name]),
        el('p', { className: 'fbt-price' }, [fmtMoney(product.price)]),
      ]));

      companions.forEach(function (c) {
        row.appendChild(el('span', { className: 'fbt-plus' }, ['+']));
        const on = state.selected.has(c.id);
        const tile = el('button', {
          className: 'fbt-tile' + (on ? ' fbt-tile-on' : ' fbt-tile-off'),
          type: 'button',
          onclick: function () {
            if (state.selected.has(c.id)) state.selected.delete(c.id);
            else                          state.selected.add(c.id);
            paint();
          },
        }, [
          c.image_url ? el('img', { src: c.image_url, alt: c.name }) : null,
          el('p', { className: 'fbt-name' },  [c.name]),
          el('p', { className: 'fbt-price' }, [fmtMoney(c.price)]),
        ]);
        row.appendChild(tile);
      });
      wrap.appendChild(row);

      const cta = el('div', { className: 'fbt-cta-row' });
      const priceCol = el('div', { className: 'fbt-price-col' });
      const priceLine = el('div', { className: 'fbt-price-line' }, [
        el('span', { className: 'fbt-price-total' }, [fmtMoney(t.price)]),
        t.save > 0 ? el('span', { className: 'fbt-price-strike' }, [fmtMoney(t.sum)]) : null,
        t.save > 0 ? el('span', { className: 'fbt-price-save' },   ['Save ' + fmtMoney(t.save)]) : null,
      ]);
      priceCol.appendChild(priceLine);
      priceCol.appendChild(el('p', { className: 'fbt-count' }, ['for all ' + t.count + ' item' + (t.count === 1 ? '' : 's')]));
      cta.appendChild(priceCol);

      const button = el('button', {
        type: 'button',
        className: 'btn btn-primary fbt-add-btn',
        onclick: function () {
          // Add every selected item to the cart, including the focal product (it
          // may or may not already be in the cart from the main Add-to-Cart button).
          if (!window.Cart || typeof window.Cart.add !== 'function') {
            console.warn('[fbt] Cart manager not available');
            return;
          }
          items().forEach(function (p) {
            window.Cart.add({
              id:       p.id,
              sku:      p.sku,
              name:     p.name,
              price:    Number(p.price),
              qty:      Number(p.min_qty || 10),
              image:    p.image_url || null,
              category: p.category || null,
              bundle:   true, // tag so cart UI can show bundle origin if desired
            });
          });
          if (window.dasTrack && window.dasTrack.addToCart) {
            window.dasTrack.addToCart({ sku: 'BUNDLE-' + t.count, name: 'FBT bundle ' + t.count + ' items', price: t.price, qty: 1 });
          }
          // Surface confirmation via the existing cart UI
          if (typeof window.showToast === 'function') {
            window.showToast('Bundle added — saved ' + fmtMoney(t.save), 'success');
          } else {
            button.textContent = 'Added ✓';
            setTimeout(function () { button.textContent = 'Add ' + t.count + ' items to cart'; }, 1600);
          }
        },
      }, ['Add ' + t.count + ' item' + (t.count === 1 ? '' : 's') + ' to cart']);
      cta.appendChild(button);

      wrap.appendChild(cta);
      container.appendChild(wrap);
    }

    paint();
  }

  // ── Public init — called by product.html after the product is loaded ──
  window.DASFBTInit = async function (focalProduct) {
    if (!focalProduct || !focalProduct.sku) return;
    const container = document.getElementById('fbt-section');
    if (!container) return;

    const rules = await loadRules(focalProduct.sku);
    const companions = rules
      .map(function (r) { return r.upsell_product; })
      .filter(function (p) { return p && p.id && p.id !== focalProduct.id; })
      .slice(0, 2); // cap at 2 companions per Amazon FBT pattern

    if (companions.length > 0) {
      render(container, focalProduct, companions);
    }
  };
})();
