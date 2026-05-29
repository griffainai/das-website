/* =============================================================
   DRIVER APPRECIATION SOLUTIONS
   Shared newsletter renderer  —  js/pub-render.js

   ONE source of truth for the publication layout. Used by:
     1. account.html  → live builder preview (browser global PubRender)
     2. pub.html      → public share/view page (browser global PubRender)
     3. api/publications-generate.js → server-side PDF (Node require())

   buildNewsletterHTML(pub) returns a COMPLETE, self-contained
   <!DOCTYPE html> string (inline CSS, print-ready) so Puppeteer can
   print it to PDF and the browser can drop it straight into an iframe.

   Data shape (matches das_publications row — migration 024):
     pub = {
       title, format ('magazine'|'mailer'), quarter, year, page_count,
       status,
       settings: { company_name, letter, modules:{…} },
       drivers:  [ { name, driver_type, milestone, years_of_service,
                     safe_miles, accident_free_years, home_terminal,
                     quote, favorite_route, family_note,
                     special_achievements, photo_url,
                     is_veteran, is_mentor } ]
     }

   COLOR NOTE: this file is a standalone document — it does NOT use the
   site's inverted CSS variables (--black/--gold). Every color is an
   explicit hex, navy-forward, matching account.html (#1A2E6E / #0C1840).
   ============================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;            // Node — api/publications-generate.js
  } else {
    root.PubRender = api;            // Browser — account.html / pub.html
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- palette (explicit hex only) ---- */
  var C = {
    navy:     '#1A2E6E',
    navyDeep: '#0C1840',
    gold:     '#C8A24A',
    goldSoft: '#E7CE92',
    ink:      '#1F2937',
    muted:    '#6B7280',
    faint:    '#9CA3AF',
    line:     '#E5E7EB',
    paper:    '#FFFFFF',
    wash:     '#F4F6FA',
  };

  /* ---- format catalogue (ported from das-portal publications.ts) ---- */
  var PUBLICATION_FORMATS = {
    magazine: { id: 'magazine', label: 'Magazine', width_in: 8.5,  height_in: 11,   per_page: 2,
                description: 'Full-size 8.5 × 11 in quarterly magazine' },
    mailer:   { id: 'mailer',   label: 'Mailer',   width_in: 5.75, height_in: 8.75, per_page: 1,
                description: 'Compact 5.75 × 8.75 in mailer' },
  };
  var DEFAULT_FORMAT = 'magazine';
  var MIN_PAGE_COUNT = 8;
  var QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

  var DRIVER_TYPES = [
    { id: 'otr',            label: 'OTR (Over-the-Road)' },
    { id: 'regional',       label: 'Regional' },
    { id: 'local',          label: 'Local / P&D' },
    { id: 'dedicated',      label: 'Dedicated' },
    { id: 'owner_operator', label: 'Owner-Operator' },
    { id: 'team',           label: 'Team Driver' },
    { id: 'flatbed',        label: 'Flatbed' },
    { id: 'tanker',         label: 'Tanker' },
    { id: 'reefer',         label: 'Reefer' },
    { id: 'hazmat',         label: 'Hazmat' },
  ];

  /* ---- modules: which sections render. always:true = not toggleable ---- */
  var MODULES = [
    { id: 'cover',      label: 'Cover',                   always: true },
    { id: 'toc',        label: 'Table of Contents' },
    { id: 'letter',     label: 'Letter from Management' },
    { id: 'spotlights', label: 'Driver Spotlights',       always: true },
    { id: 'milestones', label: 'Milestones & Anniversaries' },
    { id: 'safety',     label: 'Safety Honor Roll' },
    { id: 'archive',    label: 'Back-Cover Note' },
  ];
  var DEFAULT_MODULES = {
    cover: true, toc: true, letter: true, spotlights: true,
    milestones: true, safety: true, archive: true,
  };

  /* ====================== small helpers ====================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function num(n) {
    var v = Number(n);
    return isFinite(v) ? v.toLocaleString('en-US') : '';
  }
  function driverTypeLabel(id) {
    for (var i = 0; i < DRIVER_TYPES.length; i++) if (DRIVER_TYPES[i].id === id) return DRIVER_TYPES[i].label;
    return id ? String(id) : '';
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '–';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function issueLabel(pub) {
    pub = pub || {};
    var q = pub.quarter, y = pub.year;
    if (q && y) return q + ' ' + y;
    if (y) return String(y);
    if (q) return String(q);
    return 'Special Issue';
  }
  function isDriverContentFilled(d) {
    if (!d || !String(d.name || '').trim()) return false;
    return !!(d.quote || d.milestone || d.years_of_service || d.safe_miles ||
              d.accident_free_years || d.photo_url || d.special_achievements ||
              d.home_terminal || d.favorite_route || d.family_note);
  }
  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /* ---- page-budget estimate (drives the builder's "fits in N pages" hint) ---- */
  function estimatePageBudget(opts) {
    opts = opts || {};
    var pageCount     = Math.max(MIN_PAGE_COUNT, Number(opts.pageCount) || MIN_PAGE_COUNT);
    var filledDrivers = Math.max(0, Number(opts.filledDrivers) || 0);
    var perPage       = Number(opts.perPage) || 2;
    var includeToC    = !!opts.includeToC;
    var includeMsg    = !!opts.includeMsg;
    var includeArchive = !!opts.includeArchive;
    var includeMilestones = !!opts.includeMilestones;
    var includeSafety = !!opts.includeSafety;

    var reserved = 1 /* cover */ + 1 /* back */;
    if (includeToC)        reserved += 1;
    if (includeMsg)        reserved += 1;
    if (includeMilestones) reserved += 1;
    if (includeSafety)     reserved += 1;
    // archive note shares the back cover, so no extra page

    var driverPages = Math.ceil(filledDrivers / perPage);
    var used        = reserved + driverPages;
    var target      = pageCount;
    var remaining   = target - used;

    var status, message;
    if (used > target) {
      status = 'over_budget';
      message = 'Content needs ' + used + ' pages — ' + (used - target) + ' over the ' + target + '-page target.';
    } else if (used < target) {
      status = 'blank_pages';
      message = 'Content fills ' + used + ' of ' + target + ' pages — ' + remaining + ' would be blank.';
    } else {
      status = 'ok';
      message = 'Content fits the ' + target + '-page target exactly.';
    }
    return { reserved: reserved, driverPages: driverPages, used: used, target: target,
             remaining: remaining, status: status, message: message };
  }

  /* ====================== page builders ====================== */

  function runner(company, issue) {
    return '' +
      '<div class="runner">' +
        '<span class="runner-co">' + esc(company) + '</span>' +
        '<span class="runner-issue">' + esc(issue) + '</span>' +
      '</div>';
  }
  function pageFoot(company) {
    return '' +
      '<div class="foot">' +
        '<span class="foot-dot"></span>' +
        '<span>' + esc(company) + ' &nbsp;·&nbsp; Driver Recognition</span>' +
      '</div>';
  }

  function coverPage(o) {
    return '' +
    '<section class="page cover">' +
      '<div class="cover-frame">' +
        '<div class="cover-top">' +
          '<span class="cover-eyebrow">Driver Appreciation</span>' +
          '<span class="cover-issue">' + esc(o.issue) + '</span>' +
        '</div>' +
        '<div class="cover-mid">' +
          '<div class="cover-rule"></div>' +
          '<h1 class="cover-title">' + esc(o.title) + '</h1>' +
          '<p class="cover-co">' + esc(o.company) + '</p>' +
          '<div class="cover-rule"></div>' +
        '</div>' +
        '<div class="cover-bottom">' +
          '<span>A recognition publication celebrating the men &amp; women behind the wheel.</span>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function tocPage(o, entries) {
    var rows = entries.map(function (e, i) {
      return '<li><span class="toc-n">' + String(i + 1).padStart(2, '0') + '</span>' +
             '<span class="toc-label">' + esc(e) + '</span>' +
             '<span class="toc-dots"></span></li>';
    }).join('');
    return '' +
    '<section class="page sheet">' +
      runner(o.company, o.issue) +
      '<div class="sheet-body">' +
        '<header class="sec-head"><span class="sec-kicker">Inside this issue</span>' +
          '<h2 class="sec-title">Contents</h2></header>' +
        '<ol class="toc">' + rows + '</ol>' +
      '</div>' +
      pageFoot(o.company) +
    '</section>';
  }

  function letterPage(o, letter) {
    var paras = String(letter).split(/\n{2,}/).map(function (p) {
      return '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>';
    }).join('');
    return '' +
    '<section class="page sheet">' +
      runner(o.company, o.issue) +
      '<div class="sheet-body">' +
        '<header class="sec-head"><span class="sec-kicker">From the front office</span>' +
          '<h2 class="sec-title">A Letter to Our Drivers</h2></header>' +
        '<div class="letter">' + paras + '</div>' +
        '<div class="letter-sign">— The team at ' + esc(o.company) + '</div>' +
      '</div>' +
      pageFoot(o.company) +
    '</section>';
  }

  function driverCard(d) {
    var photo = String(d.photo_url || '').trim();
    var media = photo
      ? '<div class="dc-photo" style="background-image:url(\'' + esc(photo).replace(/'/g, '%27') + '\')"></div>'
      : '<div class="dc-photo dc-photo--mono">' + esc(initials(d.name)) + '</div>';

    var badges = '';
    if (d.driver_type) badges += '<span class="chip chip--gold">' + esc(driverTypeLabel(d.driver_type)) + '</span>';
    if (d.is_veteran)  badges += '<span class="chip chip--navy">Veteran</span>';
    if (d.is_mentor)   badges += '<span class="chip chip--navy">Mentor</span>';

    var stats = [];
    if (d.years_of_service)   stats.push({ k: 'Years of Service',  v: num(d.years_of_service) });
    if (d.safe_miles)         stats.push({ k: 'Safe Miles',        v: num(d.safe_miles) });
    if (d.accident_free_years) stats.push({ k: 'Accident-Free',    v: num(d.accident_free_years) + ' yr' });
    if (d.home_terminal)      stats.push({ k: 'Home Terminal',     v: esc(d.home_terminal) });
    var statHtml = stats.length
      ? '<div class="dc-stats">' + stats.map(function (s) {
          return '<div class="dc-stat"><div class="dc-stat-v">' + s.v + '</div>' +
                 '<div class="dc-stat-k">' + esc(s.k) + '</div></div>';
        }).join('') + '</div>'
      : '';

    var quote = String(d.quote || '').trim()
      ? '<blockquote class="dc-quote">' + esc(d.quote) + '</blockquote>' : '';

    var extras = '';
    if (d.milestone)            extras += metaLine('Milestone', d.milestone);
    if (d.favorite_route)       extras += metaLine('Favorite Route', d.favorite_route);
    if (d.special_achievements) extras += metaLine('Recognized For', d.special_achievements);
    if (d.family_note)          extras += metaLine('Off the Clock', d.family_note);
    var extraHtml = extras ? '<div class="dc-meta">' + extras + '</div>' : '';

    return '' +
    '<article class="dc">' +
      media +
      '<div class="dc-body">' +
        '<div class="dc-badges">' + badges + '</div>' +
        '<h3 class="dc-name">' + esc(d.name) + '</h3>' +
        (d.milestone ? '<p class="dc-milestone">' + esc(d.milestone) + '</p>' : '') +
        statHtml +
        quote +
        extraHtml +
      '</div>' +
    '</article>';
  }
  function metaLine(k, v) {
    return '<p class="dc-metaline"><span>' + esc(k) + '</span>' + esc(v) + '</p>';
  }

  function spotlightPage(o, group, idx, total) {
    var label = total > 1 ? 'Driver Spotlights (' + (idx + 1) + '/' + total + ')' : 'Driver Spotlights';
    return '' +
    '<section class="page sheet">' +
      runner(o.company, o.issue) +
      '<div class="sheet-body">' +
        '<header class="sec-head"><span class="sec-kicker">Behind the wheel</span>' +
          '<h2 class="sec-title">' + esc(label) + '</h2></header>' +
        '<div class="dc-grid dc-grid--' + group.length + '">' +
          group.map(driverCard).join('') +
        '</div>' +
      '</div>' +
      pageFoot(o.company) +
    '</section>';
  }

  function honorPage(o, kicker, title, rows) {
    return '' +
    '<section class="page sheet">' +
      runner(o.company, o.issue) +
      '<div class="sheet-body">' +
        '<header class="sec-head"><span class="sec-kicker">' + esc(kicker) + '</span>' +
          '<h2 class="sec-title">' + esc(title) + '</h2></header>' +
        '<ul class="honor">' + rows + '</ul>' +
      '</div>' +
      pageFoot(o.company) +
    '</section>';
  }

  function backCover(o, note) {
    return '' +
    '<section class="page cover cover--back">' +
      '<div class="cover-frame">' +
        '<div class="cover-mid">' +
          '<div class="cover-rule"></div>' +
          (note
            ? '<p class="back-note">' + esc(note) + '</p>'
            : '<p class="back-note">Thank you for keeping our promises moving — one safe mile at a time.</p>') +
          '<div class="cover-rule"></div>' +
        '</div>' +
        '<div class="cover-bottom">' +
          '<span class="back-co">' + esc(o.company) + '</span>' +
          '<span class="back-by">Published with Driver Appreciation Solutions</span>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ====================== document shell ====================== */
  function styles(fmt) {
    var W = fmt.width_in, H = fmt.height_in;
    var pad = fmt.id === 'mailer' ? 0.5 : 0.62;
    return '' +
'@page{ size:' + W + 'in ' + H + 'in; margin:0; }' +
'*{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
'html,body{ margin:0; padding:0; background:' + C.wash + '; color:' + C.ink + ';' +
  ' font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
  ' -webkit-font-smoothing:antialiased; }' +
'.page{ position:relative; width:' + W + 'in; height:' + H + 'in; background:' + C.paper + ';' +
  ' margin:0 auto; overflow:hidden; page-break-after:always; break-after:page; }' +
'.page:last-child{ page-break-after:auto; break-after:auto; }' +
/* screen-only separation between pages (ignored in print) */
'@media screen{ body{ padding:18px 0; } .page{ margin:0 auto 18px; box-shadow:0 8px 30px rgba(12,24,64,.14); border-radius:4px; } }' +

/* ---- runner / footer ---- */
'.sheet{ padding:' + pad + 'in; display:flex; flex-direction:column; }' +
'.sheet-body{ flex:1 1 auto; min-height:0; }' +
'.runner{ display:flex; justify-content:space-between; align-items:center;' +
  ' font-size:8.5pt; letter-spacing:.14em; text-transform:uppercase; color:' + C.faint + ';' +
  ' padding-bottom:8px; margin-bottom:18px; border-bottom:1px solid ' + C.line + '; }' +
'.runner-co{ font-weight:700; color:' + C.navy + '; }' +
'.foot{ display:flex; align-items:center; gap:8px; margin-top:14px; padding-top:8px;' +
  ' border-top:1px solid ' + C.line + '; font-size:8pt; letter-spacing:.12em;' +
  ' text-transform:uppercase; color:' + C.faint + '; }' +
'.foot-dot{ width:6px; height:6px; border-radius:50%; background:' + C.gold + '; display:inline-block; }' +

/* ---- section headers ---- */
'.sec-head{ margin-bottom:18px; }' +
'.sec-kicker{ display:inline-block; font-size:9pt; letter-spacing:.18em; text-transform:uppercase;' +
  ' color:' + C.gold + '; font-weight:700; margin-bottom:4px; }' +
'.sec-title{ font-family:Georgia,"Times New Roman",serif; font-size:24pt; line-height:1.05;' +
  ' margin:0; color:' + C.navy + '; font-weight:700; }' +

/* ---- cover ---- */
'.cover{ background:' + C.navy + '; background:linear-gradient(160deg,' + C.navy + ' 0%,' + C.navyDeep + ' 100%); color:#fff; }' +
'.cover-frame{ position:absolute; inset:' + pad + 'in; border:1px solid rgba(255,255,255,.22);' +
  ' display:flex; flex-direction:column; justify-content:space-between; padding:' + (pad * 0.7) + 'in; }' +
'.cover-top{ display:flex; justify-content:space-between; align-items:center;' +
  ' font-size:9.5pt; letter-spacing:.2em; text-transform:uppercase; }' +
'.cover-eyebrow{ color:' + C.goldSoft + '; font-weight:700; }' +
'.cover-issue{ color:rgba(255,255,255,.75); }' +
'.cover-mid{ text-align:center; }' +
'.cover-rule{ width:54px; height:3px; background:' + C.gold + '; margin:0 auto; border-radius:2px; }' +
'.cover-title{ font-family:Georgia,"Times New Roman",serif; font-weight:700;' +
  ' font-size:' + (fmt.id === 'mailer' ? '30pt' : '42pt') + '; line-height:1.04; margin:22px 0 14px;' +
  ' color:#fff; letter-spacing:-.01em; }' +
'.cover-co{ font-size:12pt; letter-spacing:.22em; text-transform:uppercase;' +
  ' color:' + C.goldSoft + '; margin:0 0 22px; font-weight:600; }' +
'.cover-bottom{ text-align:center; font-size:9.5pt; color:rgba(255,255,255,.7);' +
  ' line-height:1.5; max-width:74%; margin:0 auto; }' +
'.cover--back .cover-frame{ justify-content:center; gap:26px; }' +
'.back-note{ font-family:Georgia,"Times New Roman",serif; font-style:italic;' +
  ' font-size:15pt; line-height:1.6; color:#fff; text-align:center; margin:22px 0; max-width:80%; }' +
'.back-co{ display:block; font-size:12pt; letter-spacing:.2em; text-transform:uppercase;' +
  ' color:' + C.goldSoft + '; font-weight:700; margin-bottom:4px; }' +
'.back-by{ display:block; font-size:8.5pt; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.55); }' +

/* ---- table of contents ---- */
'.toc{ list-style:none; margin:0; padding:0; }' +
'.toc li{ display:flex; align-items:baseline; gap:12px; padding:13px 0; border-bottom:1px solid ' + C.line + '; }' +
'.toc-n{ font-family:Georgia,serif; font-size:13pt; color:' + C.gold + '; font-weight:700; width:30px; }' +
'.toc-label{ font-size:12.5pt; color:' + C.ink + '; font-weight:600; }' +
'.toc-dots{ flex:1; border-bottom:1px dotted ' + C.line + '; transform:translateY(-3px); }' +

/* ---- letter ---- */
'.letter{ font-size:11.5pt; line-height:1.72; color:' + C.ink + '; }' +
'.letter p{ margin:0 0 13px; }' +
'.letter p:first-child:first-letter{ font-family:Georgia,serif; font-size:30pt; font-weight:700;' +
  ' color:' + C.navy + '; float:left; line-height:.8; padding:4px 8px 0 0; }' +
'.letter-sign{ margin-top:18px; font-family:Georgia,serif; font-style:italic; font-size:12pt; color:' + C.navy + '; }' +

/* ---- driver spotlight cards ---- */
'.dc-grid{ display:grid; gap:' + (fmt.id === 'mailer' ? '14px' : '20px') + '; }' +
'.dc-grid--1{ grid-template-columns:1fr; }' +
'.dc-grid--2{ grid-template-columns:1fr 1fr; }' +
'.dc{ border:1px solid ' + C.line + '; border-radius:12px; overflow:hidden; background:' + C.paper + ';' +
  ' display:flex; flex-direction:column; break-inside:avoid; page-break-inside:avoid; }' +
'.dc-photo{ width:100%; height:' + (fmt.id === 'mailer' ? '150px' : '188px') + '; background-size:cover;' +
  ' background-position:center; background-color:' + C.wash + '; }' +
'.dc-photo--mono{ display:flex; align-items:center; justify-content:center;' +
  ' font-family:Georgia,serif; font-size:46pt; font-weight:700; color:#fff;' +
  ' background:linear-gradient(150deg,' + C.navy + ',' + C.navyDeep + '); }' +
'.dc-body{ padding:14px 15px 16px; flex:1 1 auto; }' +
'.dc-badges{ display:flex; flex-wrap:wrap; gap:5px; margin-bottom:7px; }' +
'.chip{ display:inline-block; font-size:7.5pt; letter-spacing:.08em; text-transform:uppercase;' +
  ' font-weight:700; padding:3px 8px; border-radius:999px; }' +
'.chip--gold{ background:rgba(200,162,74,.16); color:#8A6A1E; }' +
'.chip--navy{ background:rgba(26,46,110,.1); color:' + C.navy + '; }' +
'.dc-name{ font-family:Georgia,serif; font-size:16pt; margin:0; color:' + C.navy + '; line-height:1.1; }' +
'.dc-milestone{ font-size:9.5pt; color:' + C.gold + '; font-weight:700; margin:3px 0 0;' +
  ' letter-spacing:.02em; }' +
'.dc-stats{ display:flex; flex-wrap:wrap; gap:10px 18px; margin:11px 0; padding:10px 0;' +
  ' border-top:1px solid ' + C.line + '; border-bottom:1px solid ' + C.line + '; }' +
'.dc-stat-v{ font-family:Georgia,serif; font-size:14pt; font-weight:700; color:' + C.navy + '; line-height:1; }' +
'.dc-stat-k{ font-size:7.5pt; letter-spacing:.1em; text-transform:uppercase; color:' + C.faint + '; margin-top:3px; }' +
'.dc-quote{ font-family:Georgia,serif; font-style:italic; font-size:10.5pt; line-height:1.5;' +
  ' color:' + C.ink + '; margin:11px 0 0; padding-left:12px; border-left:3px solid ' + C.gold + '; }' +
'.dc-meta{ margin-top:11px; }' +
'.dc-metaline{ font-size:9pt; line-height:1.5; color:' + C.ink + '; margin:0 0 4px; }' +
'.dc-metaline span{ display:inline-block; min-width:96px; color:' + C.faint + ';' +
  ' font-size:7.5pt; letter-spacing:.08em; text-transform:uppercase; font-weight:700; }' +

/* ---- honor lists (milestones / safety) ---- */
'.honor{ list-style:none; margin:0; padding:0; }' +
'.honor li{ display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid ' + C.line + '; }' +
'.honor-badge{ flex:0 0 auto; width:42px; height:42px; border-radius:50%;' +
  ' background:linear-gradient(150deg,' + C.navy + ',' + C.navyDeep + '); color:#fff;' +
  ' display:flex; align-items:center; justify-content:center; font-family:Georgia,serif;' +
  ' font-weight:700; font-size:13pt; }' +
'.honor-main{ flex:1 1 auto; }' +
'.honor-name{ font-size:12pt; font-weight:700; color:' + C.navy + '; }' +
'.honor-sub{ font-size:9pt; color:' + C.muted + '; margin-top:1px; }' +
'.honor-val{ font-family:Georgia,serif; font-size:13pt; font-weight:700; color:' + C.gold + '; white-space:nowrap; }';
  }

  function buildNewsletterHTML(pub) {
    pub = pub || {};
    var settings = pub.settings || {};
    var modules  = {};
    var k;
    for (k in DEFAULT_MODULES) modules[k] = DEFAULT_MODULES[k];
    if (settings.modules) for (k in settings.modules) modules[k] = settings.modules[k];

    var fmt     = PUBLICATION_FORMATS[pub.format] || PUBLICATION_FORMATS[DEFAULT_FORMAT];
    var company = String(settings.company_name || '').trim() || 'Driver Appreciation Solutions';
    var title   = String(pub.title || '').trim() || 'Driver Recognition Issue';
    var issue   = issueLabel(pub);
    var o = { company: company, title: title, issue: issue, fmt: fmt };

    var drivers = (Array.isArray(pub.drivers) ? pub.drivers : [])
      .filter(function (d) { return d && String(d.name || '').trim(); });

    /* build the contents list first so the ToC matches what actually renders */
    var letterText = String(settings.letter || '').trim();
    var milestoneDrivers = drivers.filter(function (d) { return d.milestone || d.years_of_service; });
    var safetyDrivers    = drivers.filter(function (d) { return d.accident_free_years || d.safe_miles; });

    var sections = [];
    if (modules.letter && letterText)              sections.push('A Letter to Our Drivers');
    if (modules.spotlights !== false && drivers.length) sections.push('Driver Spotlights');
    if (modules.milestones && milestoneDrivers.length) sections.push('Milestones & Anniversaries');
    if (modules.safety && safetyDrivers.length)    sections.push('Safety Honor Roll');

    var pages = [];
    pages.push(coverPage(o));
    if (modules.toc && sections.length) pages.push(tocPage(o, sections));
    if (modules.letter && letterText)   pages.push(letterPage(o, letterText));

    if (modules.spotlights !== false && drivers.length) {
      var groups = chunk(drivers, fmt.per_page);
      groups.forEach(function (g, i) { pages.push(spotlightPage(o, g, i, groups.length)); });
    } else if (modules.spotlights !== false) {
      // graceful empty-state so a brand-new issue still previews as a real magazine
      pages.push(spotlightEmpty(o));
    }

    if (modules.milestones && milestoneDrivers.length) {
      var mRows = milestoneDrivers.map(function (d) {
        var val = d.years_of_service ? (num(d.years_of_service) + ' yrs') : 'New milestone';
        return '<li><span class="honor-badge">' + esc(initials(d.name)) + '</span>' +
               '<span class="honor-main"><span class="honor-name">' + esc(d.name) + '</span>' +
               '<span class="honor-sub">' + esc(d.milestone || driverTypeLabel(d.driver_type)) + '</span></span>' +
               '<span class="honor-val">' + val + '</span></li>';
      }).join('');
      pages.push(honorPage(o, 'Years on the road', 'Milestones & Anniversaries', mRows));
    }

    if (modules.safety && safetyDrivers.length) {
      var sRows = safetyDrivers.map(function (d) {
        var val = d.accident_free_years ? (num(d.accident_free_years) + ' yr safe')
                : (num(d.safe_miles) + ' mi');
        return '<li><span class="honor-badge">' + esc(initials(d.name)) + '</span>' +
               '<span class="honor-main"><span class="honor-name">' + esc(d.name) + '</span>' +
               '<span class="honor-sub">' +
                 (d.safe_miles ? (num(d.safe_miles) + ' safe miles') : 'Accident-free record') +
               '</span></span>' +
               '<span class="honor-val">' + val + '</span></li>';
      }).join('');
      pages.push(honorPage(o, 'Eyes on safety', 'Safety Honor Roll', sRows));
    }

    pages.push(backCover(o, modules.archive ? String(settings.back_note || '').trim() : ''));

    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' — ' + esc(issue) + '</title>' +
      '<style>' + styles(fmt) + '</style></head>' +
      '<body>' + pages.join('') + '</body></html>';
  }

  function spotlightEmpty(o) {
    return '' +
    '<section class="page sheet">' +
      runner(o.company, o.issue) +
      '<div class="sheet-body">' +
        '<header class="sec-head"><span class="sec-kicker">Behind the wheel</span>' +
          '<h2 class="sec-title">Driver Spotlights</h2></header>' +
        '<div style="border:1px dashed ' + C.line + '; border-radius:12px; padding:40px 24px;' +
          ' text-align:center; color:' + C.muted + '; font-size:11pt;">' +
          'Add drivers in the builder to fill this section with spotlight cards.' +
        '</div>' +
      '</div>' +
      pageFoot(o.company) +
    '</section>';
  }

  /* ====================== public API ====================== */
  return {
    buildNewsletterHTML: buildNewsletterHTML,
    PUBLICATION_FORMATS: PUBLICATION_FORMATS,
    DEFAULT_FORMAT: DEFAULT_FORMAT,
    MIN_PAGE_COUNT: MIN_PAGE_COUNT,
    QUARTERS: QUARTERS,
    DRIVER_TYPES: DRIVER_TYPES,
    MODULES: MODULES,
    DEFAULT_MODULES: DEFAULT_MODULES,
    issueLabel: issueLabel,
    driverTypeLabel: driverTypeLabel,
    isDriverContentFilled: isDriverContentFilled,
    estimatePageBudget: estimatePageBudget,
  };
});
