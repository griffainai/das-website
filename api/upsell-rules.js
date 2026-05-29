/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Upsell rules API — Vercel Serverless Function
   GET  /api/upsell-rules?placement=pdp_fbt&triggerSku=DAS-DAK-001
   GET  /api/upsell-rules?placement=cart_modal&triggerSku=DAS-DAK-001

   Returns the active upsell rules + joined product data so the public
   marketing site can render the same bundle/cross-sell logic as the
   authenticated portal. Read-only, no auth — RLS allows public read.
   ============================================= */

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin',  allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60'); // 5-min CDN cache

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[upsell-rules] Supabase env vars missing');
    return res.status(500).json({ error: 'Service not configured' });
  }

  const placement  = (req.query.placement  || '').toString();
  const triggerSku = (req.query.triggerSku || '').toString();

  const validPlacements = new Set(['pdp_fbt', 'cart_modal', 'order_bump', 'post_purchase']);
  if (!validPlacements.has(placement)) {
    return res.status(400).json({ error: 'Invalid placement' });
  }

  try {
    // Resolve trigger SKU → product id (if provided)
    let triggerProductId = null;
    if (triggerSku) {
      const lookupUrl = `${supabaseUrl}/rest/v1/das_products?select=id&sku=eq.${encodeURIComponent(triggerSku)}&active=eq.true&limit=1`;
      const lookupRes = await fetch(lookupUrl, {
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      });
      const lookupData = await lookupRes.json();
      if (Array.isArray(lookupData) && lookupData[0]) {
        triggerProductId = lookupData[0].id;
      }
    }

    // Query upsell_rules with joined upsell product
    // PostgREST embed:  upsell_product:das_products!upsell_product_id(*)
    let url = `${supabaseUrl}/rest/v1/upsell_rules?`
      + `select=*,upsell_product:das_products!upsell_product_id(id,sku,name,price,description,image_url,min_qty)`
      + `&placement=eq.${encodeURIComponent(placement)}`
      + `&active=eq.true`
      + `&order=priority.desc`;
    if (triggerProductId) {
      url += `&trigger_product_id=eq.${triggerProductId}`;
    } else {
      // No specific trigger — global rules only
      url += '&trigger_product_id=is.null';
    }

    const rulesRes = await fetch(url, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    });
    if (!rulesRes.ok) {
      console.error('[upsell-rules] supabase error', await rulesRes.text());
      return res.status(502).json({ error: 'Upstream error' });
    }
    const rules = await rulesRes.json();

    return res.status(200).json({
      placement,
      triggerSku,
      rules: Array.isArray(rules) ? rules : [],
    });
  } catch (err) {
    console.error('[upsell-rules]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
