/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Cart Manager — localStorage-backed cart
   ============================================= */

const CART_KEY = 'das_cart_v1';
const FAV_KEY  = 'das_favorites_v1';

/* ---- Favorites ---- */
const Favorites = {
  load()  { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } },
  _save(l) {
    localStorage.setItem(FAV_KEY, JSON.stringify(l));
    this._updateNav();
    window.dispatchEvent(new CustomEvent('das:favchange', { detail: { count: l.length } }));
  },
  has(id)  { return this.load().some(f => f.productId === id); },
  add(item) {
    const list = this.load();
    if (!this.has(item.productId)) { list.push(item); this._save(list); }
  },
  remove(productId) { this._save(this.load().filter(f => f.productId !== productId)); },
  toggle(item) {
    if (this.has(item.productId)) { this.remove(item.productId); return false; }
    this.add(item); return true;
  },
  _updateNav() {
    const count = this.load().length;
    document.querySelectorAll('.fav-count').forEach(el => {
      el.textContent = count;
      el.classList.toggle('visible', count > 0);
    });
  },
};

const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  },

  save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    this._updateBadge();
    window.dispatchEvent(new CustomEvent('das:cartchange', { detail: { cart: items } }));
  },

  add(product, qty) {
    const items = this.get();
    const existing = items.find(i => i.id === product.id);
    const minQty = product.minQty || 10;
    if (existing) {
      existing.qty += qty;
      if (existing.qty < minQty) existing.qty = minQty;
    } else {
      items.push({ ...product, qty: Math.max(qty, minQty) });
    }
    this.save(items);
    showToast(`${product.name} added to cart`, 'success');
  },

  remove(productId) {
    this.save(this.get().filter(i => i.id !== productId));
    showToast('Item removed', 'info');
  },

  setQty(productId, qty) {
    const items = this.get();
    const item = items.find(i => i.id === productId);
    if (item) {
      item.qty = Math.max(parseInt(qty) || item.minQty || 10, item.minQty || 10);
      this.save(items);
    }
  },

  clear() {
    localStorage.removeItem(CART_KEY);
    this._updateBadge();
    window.dispatchEvent(new CustomEvent('das:cartchange', { detail: { cart: [] } }));
  },

  total()  { return this.get().reduce((s, i) => s + (i.price * i.qty), 0); },
  count()  { return this.get().length; },  // number of distinct products
  units()  { return this.get().reduce((s, i) => s + i.qty, 0); },

  _updateBadge() {
    const count = this.count();
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = count;
      el.classList.toggle('visible', count > 0);
    });
  },
};

/* ---- Toast ---- */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  t.innerHTML = `<span style="font-weight:800">${icon}</span><span>${message}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 280);
  }, 3000);
}

/* ---- Sync save-button visual state ---- */
function syncFavBtn(btn, productId) {
  const saved = Favorites.has(productId);
  const svg = btn.querySelector('svg');
  if (svg) svg.style.fill = saved ? 'currentColor' : 'none';
  btn.setAttribute('aria-label', saved ? 'Remove from saved kits' : 'Save for later');
  btn.classList.toggle('fav-active', saved);
}

/* ---- Init on every page ---- */
document.addEventListener('DOMContentLoaded', () => {
  Cart._updateBadge();
  Favorites._updateNav();

  /* Sync any pre-rendered save buttons (e.g. shop page) */
  document.querySelectorAll('[data-save-to-fav]').forEach(btn => {
    const card = btn.closest('[data-product-id]');
    if (card) syncFavBtn(btn, card.dataset.productId);
  });

  /* Delegated save-to-favorites handler */
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-save-to-fav]');
    if (!btn) return;
    const card = btn.closest('[data-product-id]');
    if (!card) return;
    const item = {
      productId: card.dataset.productId,
      name:      card.dataset.productName      || '',
      price:     parseFloat(card.dataset.productPrice) || 0,
      category:  card.dataset.productCategory  || '',
      image:     card.dataset.productImage     || '',
      tierLabel: 'Standard',
      tier:      'standard',
    };
    const saved = Favorites.toggle(item);
    syncFavBtn(btn, item.productId);
    showToast(saved ? 'Saved to your kits' : 'Removed from saved kits', saved ? 'success' : 'info');
  });

  /* ----- Mobile nav ----- */
  const toggle  = document.querySelector('.nav-mobile-toggle');
  const overlay = document.querySelector('.mobile-overlay');
  const drawer  = document.querySelector('.mobile-drawer');
  const closeBtn= document.querySelector('.mobile-close-btn');

  function openNav()  { overlay?.classList.add('open'); drawer?.classList.add('open'); document.body.style.overflow='hidden'; }
  function closeNav() { overlay?.classList.remove('open'); drawer?.classList.remove('open'); document.body.style.overflow=''; }

  toggle?.addEventListener('click', openNav);
  overlay?.addEventListener('click', closeNav);
  closeBtn?.addEventListener('click', closeNav);

  /* ----- Scroll-to-top ----- */
  const topBtn = document.querySelector('.scroll-top');
  if (topBtn) {
    window.addEventListener('scroll', () => topBtn.classList.toggle('visible', window.scrollY > 500), { passive: true });
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ----- Add-to-cart buttons ----- */
  document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('[data-product-id]');
      if (!card) return;
      const product = {
        id:       card.dataset.productId,
        name:     card.dataset.productName,
        price:    parseFloat(card.dataset.productPrice),
        category: card.dataset.productCategory || '',
        image:    card.dataset.productImage    || '',
        minQty:   parseInt(card.dataset.productMinQty) || 10,
      };
      const qtyInput = card.querySelector('.qty-input');
      const qty = qtyInput ? (parseInt(qtyInput.value) || product.minQty) : product.minQty;
      Cart.add(product, qty);

      /* visual feedback */
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Added';
      btn.style.cssText = 'background:var(--success);border-color:var(--success);color:#fff;';
      setTimeout(() => { btn.innerHTML = orig; btn.style.cssText = ''; }, 1600);
    });
  });

  /* ----- Qty +/- buttons ----- */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const control = btn.closest('.qty-control');
    const input   = control?.querySelector('.qty-input');
    if (!input) return;
    const min  = parseInt(input.min) || 10;
    const step = parseInt(input.dataset.step) || 1;
    const cur  = parseInt(input.value) || min;
    const delta = btn.dataset.dir === 'up' ? step : -step;
    input.value = Math.max(min, cur + delta);

    /* if on cart page, update total */
    if (typeof renderCart === 'function') renderCart();
  });
});

/* ---- Stripe Checkout ---- */
async function goToCheckout() {
  const items = Cart.get();
  if (!items.length) { showToast('Your cart is empty', 'error'); return; }

  const btn = document.getElementById('checkout-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }

  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (data.url) {
      Cart.clear();
      window.location.href = data.url;
    } else {
      throw new Error(data.error || `Server error ${res.status}`);
    }
  } catch (err) {
    console.error('[checkout]', err.message);
    showToast(err.message || 'Checkout error — please try again', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Proceed to Checkout'; }
  }
}
