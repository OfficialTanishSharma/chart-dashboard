#!/usr/bin/env python3
"""Self-contained test for the Python renderer: boots it on a test port,
exercises every endpoint + static serving, prints results, then exits.
Run:  python test-renderer.py"""
import json
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import renderer

PORT = 8788  # separate port so we don't clash with a running instance
ROWS = [
    {"Month": "Jan", "Sales": "100", "Expenses": "60"},
    {"Month": "Feb", "Sales": "150", "Expenses": "80"},
    {"Month": "Mar", "Sales": "120", "Expenses": "70"},
]
failures = 0


def check(name, ok, extra=""):
    global failures
    print(("PASS  " if ok else "FAIL  ") + name + ((" — " + extra) if extra else ""))
    if not ok:
        failures += 1


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (PORT, path), data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), renderer.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    try:
        status, body = request("GET", "/api/health")
        check("GET /api/health", status == 200 and json.loads(body)["ok"] is True)

        for kind in ("bar", "line", "pie", "area"):
            status, body = request("POST", "/api/chart", {"type": kind, "xAxis": "Month", "yAxis": "Sales", "rows": ROWS})
            cfg = json.loads(body)
            check(
                "POST /api/chart (%s)" % kind,
                status == 200 and cfg.get("type") == kind and len(cfg["data"]["labels"]) == 3,
                "labels=%s" % len(cfg.get("data", {}).get("labels", [])),
            )

        status, body = request("POST", "/api/chart", {"type": "scatter", "xAxis": "Sales", "yAxis": "Expenses", "rows": ROWS})
        cfg = json.loads(body)
        check(
            "POST /api/chart (scatter)",
            status == 200 and len(cfg["data"]["datasets"][0]["data"]) == 3,
            "points=%s" % len(cfg["data"]["datasets"][0]["data"]),
        )

        status, _ = request("POST", "/api/chart", {"type": "scatter", "xAxis": "Month", "yAxis": "Sales", "rows": ROWS})
        check("scatter rejects non-numeric X", status == 400)

        status, _ = request("POST", "/api/chart", {"type": "nope", "xAxis": "x", "yAxis": "y", "rows": []})
        check("POST /api/chart rejects bad type", status == 400)

        status, body = request("GET", "/")
        check("GET / serves index.html", status == 200 and "DataViz" in body)
    finally:
        server.shutdown()

    print("\nAll tests passed ✔" if failures == 0 else "\n%d test(s) failed" % failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
