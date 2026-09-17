'use strict';

/* Local "data-to-chart" renderer — zero dependencies (Node built-ins only).
   Endpoints:
     GET  /api/health  -> { ok, service, version }
     POST /api/chart   -> Chart.js config built from { type, xAxis, yAxis, rows }
   Also serves the dashboard on http://localhost:8787 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildConfig } = require('./chart-config');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 20e6) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) { req.destroy(); reject(new Error('payload too large')); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }

    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, service: 'data-to-chart', version: '1.0' });
    }

    if (url.pathname === '/api/chart' && req.method === 'POST') {
      let body;
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'invalid JSON body' });
      }

      const { type, xAxis, yAxis, rows } = body;
      if (!['bar', 'line', 'pie'].includes(type))
        return sendJson(res, 400, { error: "invalid 'type' (expected bar | line | pie)" });
      if (typeof xAxis !== 'string' || !xAxis)
        return sendJson(res, 400, { error: "'xAxis' must be a non-empty string" });
      if (!Array.isArray(yAxis) || !yAxis.length)
        return sendJson(res, 400, { error: "'yAxis' must be a non-empty string[]" });
      if (!Array.isArray(rows))
        return sendJson(res, 400, { error: "'rows' must be an object[]" });

      return sendJson(res, 200, buildConfig({ type, xAxis, yAxis, rows }));
    }

    // static files (dashboard)
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(ROOT, pathname);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      return sendJson(res, 403, { error: 'forbidden' });
    }
    fs.readFile(filePath, (err, buf) => {
      if (err) return sendJson(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`data-to-chart renderer running at http://localhost:${PORT}`);
  console.log('  GET  /api/health');
  console.log('  POST /api/chart   { type, xAxis, yAxis, rows }');
});
