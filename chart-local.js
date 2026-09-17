'use strict';

/* Offline fallback renderer — mirrors server-side chart-config.js so the
   dashboard still works when the local data-to-chart API is not running. */
const PALETTE = [
  '#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4',
  '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#8b5cf6',
];

function aggregateRows(rows, xAxis, yAxis) {
  const map = new Map();
  for (const r of rows) {
    const key = String(r[xAxis] ?? '');
    let agg = map.get(key);
    if (!agg) { agg = { key, sums: {} }; map.set(key, agg); }
    for (const y of yAxis) {
      const v = parseFloat(r[y]);
      if (!isNaN(v)) agg.sums[y] = (agg.sums[y] || 0) + v;
    }
  }
  return [...map.values()];
}

function buildLocalChartConfig({ type, xAxis, yAxis, rows }) {
  const agg = aggregateRows(rows, xAxis, yAxis);
  const labels = agg.map((a) => a.key);
  const grid = { color: 'rgba(148,163,184,.18)' };
  const ticks = { color: '#94a3b8' };
  const tooltip = { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', borderColor: '#334155', borderWidth: 1, padding: 10 };
  const legend = { position: type === 'pie' ? 'right' : 'top', labels: { color: '#cbd5e1', padding: 14, usePointStyle: true } };

  let data;
  if (type === 'pie') {
    const y = yAxis[0];
    data = {
      labels,
      datasets: [{
        label: y,
        data: agg.map((a) => a.sums[y] || 0),
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: '#0f172a', borderWidth: 2,
      }],
    };
  } else {
    data = {
      labels,
      datasets: yAxis.map((y, i) => {
        const color = PALETTE[i % PALETTE.length];
        if (type === 'bar') {
          return { label: y, data: agg.map((a) => a.sums[y] || 0), backgroundColor: color, borderColor: color, borderWidth: 1.5, borderRadius: 6 };
        }
        return { label: y, data: agg.map((a) => a.sums[y] || 0), borderColor: color, backgroundColor: color + '33', borderWidth: 2.5, tension: 0.35, fill: true, pointRadius: 3, pointBackgroundColor: color };
      }),
    };
  }

  return {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend, tooltip },
      ...(type === 'pie' ? {} : { scales: { x: { grid, ticks }, y: { grid, ticks, beginAtZero: true } } }),
    },
  };
}
