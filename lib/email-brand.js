/* ============================================================================
   DAS EMAIL BRAND SHELL (2026-08-27)

   One visual system for every customer email: navy hero with the Anton
   wordmark (a rendered PNG — email clients can't be trusted with webfonts),
   brass eyebrow, optional catalog-photo band, white body, the illustration
   strip (kit · semi · medal, the same PNGs the site's sprite drawings render
   to), a brass engraved rule, and a navy footer.

   Email-safe by construction: tables, inline styles, hosted HTTPS images,
   solid colors with bgcolor fallbacks. @import Anton is progressive — Apple
   Mail gets the true face for live-text headlines, everyone else gets the
   condensed fallback stack.
   ============================================================================ */
'use strict';

const SITE = 'https://www.driverappreciationsolutions.com';
const NAVY = '#0C1840';
const NAVY2 = '#16264F';
const BRASS = '#C8A14B';
const BRASS_DEEP = '#9A7B2E';
const INK = '#0B1020';
const MUTED = '#67718A';
const HAIR = '#E3E8F2';

const HEAD_FONT = "'Anton','Arial Narrow',Impact,'Helvetica Neue',Arial,sans-serif";
const UI_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Navy block CTA — the site's Secure-Checkout button, email-safe. */
function btn(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
    <td bgcolor="${NAVY}" style="background:${NAVY}">
      <a href="${href}" style="display:inline-block;padding:15px 34px;font-family:${UI_FONT};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;text-decoration:none">${label}</a>
    </td></tr></table>`;
}

/* The illustration strip — kit · semi · medal. */
function strip() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:26px 0 2px">
    <img src="${SITE}/images/email/das-ill-kit.png" height="36" style="height:36px;width:auto;vertical-align:middle" alt="">
    <span style="display:inline-block;width:30px">&nbsp;</span>
    <img src="${SITE}/images/email/das-ill-semi.png" height="32" style="height:32px;width:auto;vertical-align:middle" alt="">
    <span style="display:inline-block;width:30px">&nbsp;</span>
    <img src="${SITE}/images/email/das-ill-medal.png" height="38" style="height:38px;width:auto;vertical-align:middle" alt="">
  </td></tr></table>`;
}

/* The brass engraved rule — the site's "Our Standard" divider. */
function brassRule() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td align="center" style="padding:18px 0 0">
      <table role="presentation" cellpadding="0" cellspacing="0" width="320"><tr>
        <td height="2" bgcolor="${BRASS}" style="height:2px;line-height:2px;font-size:0;background:linear-gradient(90deg,${BRASS_DEEP},${BRASS} 30%,#E8C766 50%,${BRASS} 70%,${BRASS_DEEP})">&nbsp;</td>
      </tr></table>
    </td></tr></table>`;
}

/* Light-gray info box (the cart's rp-box). */
function grayBox(innerHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;border:1px solid ${HAIR}"><tr><td style="padding:16px 18px">${innerHtml}</td></tr></table>`;
}

/**
 * The full branded document.
 * @param {object} o
 *   preheader   hidden preview text
 *   eyebrow     brass uppercase line in the hero
 *   title       hero headline (Anton stack, white, uppercase)
 *   sub         optional hero subline
 *   photo       optional catalog photo URL (full-width band under the hero)
 *   bodyRows    HTML for the white body area (divs/tables, NOT <tr>s)
 *   footNote    optional small line above the footer contact
 */
function brandShell(o) {
  const photoBand = o.photo
    ? `<tr><td style="line-height:0;font-size:0"><img src="${o.photo}" width="600" style="width:100%;max-width:600px;height:auto;display:block" alt=""></td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>@import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');

/* ── DARK MODE ────────────────────────────────────────────────────────────────
   Reported 2026-08-31: the hero title looked GREY in dark mode. It is #ffffff in
   the source — the client was dimming it. Gmail and Apple Mail rewrite an email's
   colours in dark mode and routinely knock pure white down to grey on a dark
   ground, so "make it white" cannot be fixed by setting it white again.

   Two declarations do the work:
     · color-scheme / supported-color-schemes tell the client this email handles
       its own colours, which stops the blunt auto-inversion outright.
     · the rules below re-assert the hero colours for the clients that invert
       anyway. Gmail rewrites the DOM and stamps [data-ogsc] (text) and
       [data-ogsb] (background) on the elements it touched — targeting those
       attributes is the only way to reach it.

   Light mode is deliberately untouched. These rules only fire in dark contexts. */
:root { color-scheme: light dark; supported-color-schemes: light dark; }

@media (prefers-color-scheme: dark) {
  .das-hero-title { color: #ffffff !important; }
  .das-hero-sub   { color: #ffffff !important; }
  .das-hero-eyebrow { color: #E8C766 !important; }   /* the lighter brass — the deep one muddies on dark */
}
[data-ogsc] .das-hero-title,
[data-ogsb] .das-hero-title { color: #ffffff !important; }
[data-ogsc] .das-hero-sub,
[data-ogsb] .das-hero-sub   { color: #ffffff !important; }
[data-ogsc] .das-hero-eyebrow,
[data-ogsb] .das-hero-eyebrow { color: #E8C766 !important; }
</style>
</head>
<body style="margin:0;padding:0;background:#EEF1F7">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(o.preheader || '')}</div>
  <div style="background:#EEF1F7;padding:28px 12px;font-family:${UI_FONT}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${HAIR}">

      <!-- HERO -->
      <tr><td bgcolor="${NAVY}" style="background:${NAVY};background-image:linear-gradient(160deg,${NAVY},${NAVY2});padding:34px 40px 30px;text-align:center">
        <img src="${SITE}/images/email/das-wordmark-white.png" width="200" style="width:200px;height:auto;display:inline-block" alt="Driver Appreciation Solutions">
        ${o.eyebrow ? `<div class="das-hero-eyebrow" style="font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${BRASS};margin:22px 0 10px">${o.eyebrow}</div>` : '<div style="height:18px"></div>'}
        ${o.title ? `<div class="das-hero-title" style="font-family:${HEAD_FONT};font-size:30px;line-height:1.05;text-transform:uppercase;letter-spacing:.01em;color:#ffffff;font-weight:400">${o.title}</div>` : ''}
        ${/* was rgba(255,255,255,.88) — 88% white is already grey-ish, and a dark-mode
              client dims it further. Solid white here; the navy ground carries the
              hierarchy without needing the text to be faint. */''}
        ${o.sub ? `<div class="das-hero-sub" style="font-size:14px;line-height:1.65;color:#ffffff;margin-top:12px;max-width:400px;display:inline-block">${o.sub}</div>` : ''}
      </td></tr>

      ${photoBand}

      <!-- BODY -->
      ${o.tableRows || `<tr><td style="background:#ffffff;padding:32px 40px 8px">
        ${o.bodyRows || ''}
      </td></tr>`}

      <!-- RULE + FOOTNOTE (illustrations removed from email per Jayden 2026-08-27) -->
      <tr><td style="background:#ffffff;padding:0 40px 28px">
        ${brassRule()}
        ${o.footNote ? `<div style="text-align:center;font-size:12px;color:#3D4763;margin-top:16px;line-height:1.65">${o.footNote}</div>` : ''}
      </td></tr>

      <!-- FOOTER -->
      <tr><td bgcolor="${NAVY}" style="background:${NAVY};padding:24px 40px;text-align:center">
        <div style="font-size:11px;color:rgba(255,255,255,.75);line-height:1.8">
          <a href="mailto:info@driverappreciationsolutions.com" style="color:#ffffff;text-decoration:underline">info@driverappreciationsolutions.com</a>
          &nbsp;&middot;&nbsp; <a href="tel:3026810995" style="color:#ffffff;text-decoration:underline">302.681.0995</a><br>
          <a href="${SITE}/shop.html" style="color:rgba(255,255,255,.75);text-decoration:underline">Shop</a>
          &nbsp;&middot;&nbsp; <a href="${SITE}/ideas.html" style="color:rgba(255,255,255,.75);text-decoration:underline">Insights</a>
          &nbsp;&middot;&nbsp; <a href="${SITE}/contact.html" style="color:rgba(255,255,255,.75);text-decoration:underline">Contact</a>
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,.45);margin-top:12px">&copy; 2026 Driver Appreciation Solutions Inc. &middot; driverappreciationsolutions.com</div>
      </td></tr>

    </table>
  </div>
</body></html>`;
}

module.exports = { brandShell, btn, strip, brassRule, grayBox, esc, SITE, NAVY, BRASS, INK, MUTED, HAIR, UI_FONT, HEAD_FONT };
