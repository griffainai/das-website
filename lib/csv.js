/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Minimal RFC-4180-ish CSV parser (UMD — browser + Node).

   Handles: commas inside quoted fields, embedded double-quotes via "", CRLF & LF
   line endings, leading BOM. Sized for admin-edited spreadsheets (a few hundred
   rows). Not a full library — swap in papaparse if multi-MB uploads appear.

   Ported from das-portal/src/lib/csv.ts.
   ============================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DASCsv = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  function parseCSV(text) {
    text = String(text == null ? '' : text);
    // strip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    var rows = [];
    var row = [];
    var field = '';
    var i = 0;
    var inQuotes = false;

    while (i < text.length) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }

      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }

    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

    while (rows.length > 0 && rows[rows.length - 1].every(function (c) { return c.trim() === ''; })) {
      rows.pop();
    }

    return rows;
  }

  function escapeField(value) {
    value = String(value == null ? '' : value);
    if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
    return value;
  }

  function toCSV(rows) {
    return rows.map(function (r) {
      return r.map(escapeField).join(',');
    }).join('\r\n');
  }

  return { parseCSV: parseCSV, toCSV: toCSV };
}));
