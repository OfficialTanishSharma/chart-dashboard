# DataViz — CSV/Excel to Charts dashboard

[![Python](https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-zero-0EA5E9)](#tech-stack)

Drop a CSV or Excel file, pick a chart type, and get a live chart. The file is
parsed in the browser and only the resulting rows are sent to a local renderer
that builds the Chart.js config. Nothing is uploaded anywhere.

## Screenshot

<!-- Add screenshot here -->

## Features

- CSV and Excel support — `.csv`, `.xls`, and `.xlsx` (multi-sheet workbooks
  show a sheet picker)
- Drag-and-drop or browse; a one-click sample dataset is included
- Five chart types: bar, line, pie, scatter, and area
- Live data preview table — first 10 rows, sticky header
- Human-designed dark UI (Linear / Vercel inspired), keyboard friendly
- Zero dependencies — the server is Python 3 standard library only
- Data stays in your browser — no external upload

## Quick start

```bash
git clone https://github.com/OfficialTanishSharma/chart-dashboard.git
cd chart-dashboard
python renderer.py
# open http://localhost:8787
```

Then drop a file (or press `⌘K` / `Ctrl+K`), choose a chart type, and press
**Generate Chart**.

> The page needs internet on first load — Tailwind, Chart.js, SheetJS, and
> Lucide load from a CDN. No build step, no `npm install`, no `pip install`.

## How it works

1. `index.html` reads the file with `FileReader`, parsing CSV directly and
   Excel via SheetJS. Rows stay in memory; a 10-row preview table is drawn.
2. On **Generate Chart**, the selected rows are `POST`ed to `renderer.py`
   as JSON: `{ type, xAxis, yAxis, rows }`.
3. `renderer.py` aggregates the rows and returns a ready-to-draw Chart.js
   config, which the page draws on a canvas.

```
browser (index.html)  --HTTP-->  renderer.py  -->  Chart.js config
```

## Chart types

| Type    | Use when                                              |
| ------- | ----------------------------------------------------- |
| bar     | comparing values across categories                    |
| line    | change over time or an ordered sequence               |
| pie     | parts of a whole (uses the first numeric Y column)    |
| scatter | correlation between two numeric values (X must be numeric) |
| area    | volume or magnitude over time                         |

For bar, line, pie, and area, duplicate X-axis values are summed
automatically.

## Keyboard shortcuts

| Shortcut       | Action                          |
| -------------- | ------------------------------- |
| `⌘K` / `Ctrl+K`| open the file picker            |
| `Esc`          | close menus and dismiss toasts  |

## Development

```bash
python test-renderer.py   # boots a test server on :8788 and runs 9 checks
```

Requirements: Python 3.10+. No npm, no pip, no build step.

## Tech stack

- HTML + Tailwind CSS (CDN) — UI
- Chart.js (CDN) — chart rendering
- SheetJS (CDN) — Excel parsing
- Lucide (CDN) — icons
- Python 3 stdlib — local renderer and static server

## Planned features

- PNG export of the generated chart (`Chart.js toBase64Image()`)
- Offline fallback that builds the chart config in the browser when the
  renderer is not running

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Tanish Sharma.
