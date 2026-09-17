'use strict';

/* CSV parsing helpers (exposed as browser globals). */

// Embedded sample so "Load sample data" works even from file://
const SAMPLE_CSV = [
  'Category,Revenue,Units,Returns',
  'Electronics,15200,410,32',
  'Fashion,9800,760,45',
  'Home & Kitchen,12400,520,18',
  'Beauty,7300,690,12',
  'Sports,8900,305,9',
  'Toys,5400,480,22',
  'Books,6700,950,5',
].join('\n');

// RFC-4180 style parser: handles quoted fields, "" escapes, CRLF.
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, ''); // strip BOM
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQuotes) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip CR */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// CSV text -> { headers: string[], rows: object[] }
function csvToData(text) {
  const grid = parseCSV(text);
  if (grid.length < 2) throw new Error('need a header row + at least one data row');
  const headers = grid[0].map((h, i) => String(h).trim() || `column_${i + 1}`);
  const rows = grid.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
  return { headers, rows };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
