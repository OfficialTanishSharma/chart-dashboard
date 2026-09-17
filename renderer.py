#!/usr/bin/env python3
"""Local chart-dashboard renderer — zero dependencies (Python 3 stdlib only).

Endpoints:
  GET  /api/health  -> {"ok": true, "service": "data-to-chart", ...}
  POST /api/chart   -> Chart.js config built from {type, xAxis, yAxis, rows}
  GET  /            -> serves the dashboard (index.html) + static files

Run:   python renderer.py
Open:  http://localhost:8787
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

PORT = int(os.environ.get("PORT", "8787"))
ROOT = os.path.dirname(os.path.abspath(__file__))
MAX_BODY = 20 * 1024 * 1024  # 20 MB

PALETTE = [
    "#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#06b6d4",
    "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#8b5cf6",
]

VALID_TYPES = {"bar", "line", "pie", "scatter", "area"}

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ico": "image/x-icon",
    ".png": "image/png",
}


def to_number(value):
    """Parse a CSV cell to float, or None if it is not numeric."""
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def aggregate(rows, x_axis, y_axis):
    """Group rows by the X-axis value and sum the numeric Y column."""
    order, sums = [], {}
    for row in rows:
        key = str(row.get(x_axis, "")).strip()
        if key not in sums:
            sums[key] = 0.0
            order.append(key)
        num = to_number(row.get(y_axis))
        if num is not None:
            sums[key] += num
    return order, [sums[k] for k in order]


def common_options(chart_type):
    grid, ticks = {"color": "rgba(148,163,184,.18)"}, {"color": "#94a3b8"}
    options = {
        "responsive": True,
        "maintainAspectRatio": False,
        "plugins": {
            "legend": {
                "position": "right" if chart_type == "pie" else "top",
                "labels": {"color": "#cbd5e1", "padding": 14, "usePointStyle": True},
            },
            "tooltip": {
                "backgroundColor": "#1e293b", "titleColor": "#f1f5f9",
                "bodyColor": "#cbd5e1", "borderColor": "#334155",
                "borderWidth": 1, "padding": 10,
            },
        },
    }
    if chart_type not in ("pie", "scatter"):
        options["scales"] = {
            "x": {"grid": grid, "ticks": ticks},
            "y": {"grid": grid, "ticks": ticks, "beginAtZero": True},
        }
    return options


def build_config(payload):
    """Validate the request payload and build a Chart.js config.
    Returns (status_code, body_dict)."""
    chart_type = payload.get("type")
    x_axis = payload.get("xAxis")
    y_axis = payload.get("yAxis")
    rows = payload.get("rows")

    if chart_type not in VALID_TYPES:
        return 400, {"error": "invalid 'type' (expected one of: %s)" % ", ".join(sorted(VALID_TYPES))}
    if not isinstance(x_axis, str) or not x_axis.strip():
        return 400, {"error": "'xAxis' must be a non-empty string"}
    if not isinstance(y_axis, str) or not y_axis.strip():
        return 400, {"error": "'yAxis' must be a non-empty string"}
    if not isinstance(rows, list):
        return 400, {"error": "'rows' must be an array of objects"}

    color = PALETTE[0]
    options = common_options(chart_type)

    if chart_type in ("bar", "line", "area", "pie"):
        labels, values = aggregate(rows, x_axis, y_axis)
        if chart_type == "pie":
            data = {"labels": labels, "datasets": [{
                "label": y_axis, "data": values,
                "backgroundColor": [PALETTE[i % len(PALETTE)] for i in range(len(labels))],
                "borderColor": "#0f172a", "borderWidth": 2,
            }]}
        elif chart_type == "bar":
            data = {"labels": labels, "datasets": [{
                "label": y_axis, "data": values,
                "backgroundColor": color, "borderColor": color,
                "borderWidth": 1.5, "borderRadius": 6,
            }]}
        else:  # line or area
            data = {"labels": labels, "datasets": [{
                "label": y_axis, "data": values,
                "borderColor": color, "backgroundColor": color + "33",
                "borderWidth": 2.5, "tension": 0.35,
                "fill": chart_type == "area",
                "pointRadius": 3, "pointBackgroundColor": color,
            }]}
    else:  # scatter — needs a numeric X column
        points = []
        for row in rows:
            x = to_number(row.get(x_axis))
            y = to_number(row.get(y_axis))
            if x is None:
                return 400, {"error": "'scatter' needs a numeric X column — '%s' is not numeric" % x_axis}
            if y is None:
                continue
            points.append({"x": x, "y": y})
        data = {"datasets": [{
            "label": "%s vs %s" % (y_axis, x_axis),
            "data": points,
            "backgroundColor": color, "borderColor": color,
        }]}

    return 200, {"type": chart_type, "data": data, "options": options}


class Handler(BaseHTTPRequestHandler):
    """HTTP handler: renderer API + static file serving."""

    def _add_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

    def _send_json(self, status, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._add_cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._add_cors()
        self.end_headers()

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/health":
            self._send_json(200, {"ok": True, "service": "chart-dashboard", "version": "2.0"})
            return
        if path == "/":
            path = "/index.html"
        safe = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not (safe == ROOT or safe.startswith(ROOT + os.sep)):
            self._send_json(403, {"error": "forbidden"})
            return
        if not os.path.isfile(safe):
            self._send_json(404, {"error": "not found"})
            return
        with open(safe, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(os.path.splitext(safe)[1].lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlparse(self.path).path != "/api/chart":
            self._send_json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            self._send_json(413, {"error": "payload too large"})
            return
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._send_json(400, {"error": "invalid JSON body"})
            return
        status, body = build_config(payload)
        self._send_json(status, body)

    def log_message(self, fmt, *args):
        sys.stderr.write("[renderer] " + (fmt % args) + "\n")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("chart-dashboard renderer running at http://localhost:%d" % PORT)
    print("  GET  /api/health")
    print("  POST /api/chart   { type, xAxis, yAxis, rows }")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down…")
        server.shutdown()


if __name__ == "__main__":
    main()

