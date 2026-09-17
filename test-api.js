'use strict';

/* Self-contained integration test: boots the renderer, exercises both
   endpoints + static serving, then exits. Run with:  node test-api.js  */
const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        host: '127.0.0.1', port: PORT, path: pathname, method,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
  child.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

  const rows = [
    { Category: 'Electronics', Revenue: '15200' },
    { Category: 'Fashion', Revenue: '9800' },
    { Category: 'Home', Revenue: '12400' },
  ];

  let failures = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) failures++;
  };

  try {
    await new Promise((r) => setTimeout(r, 500));

    const health = await req('GET', '/api/health');
    check('GET /api/health', health.status === 200 && JSON.parse(health.body).ok === true);

    const bar = await req('POST', '/api/chart', { type: 'bar', xAxis: 'Category', yAxis: ['Revenue'], rows });
    const barBody = JSON.parse(bar.body || '{}');
    check(
      'POST /api/chart (bar)',
      bar.status === 200 && barBody.type === 'bar' && barBody.data.labels.length === 3,
      `labels=${barBody.data ? barBody.data.labels.length : 0}`
    );

    const line = await req('POST', '/api/chart', { type: 'line', xAxis: 'Category', yAxis: ['Revenue'], rows });
    check('POST /api/chart (line)', line.status === 200 && JSON.parse(line.body).type === 'line');

    const pie = await req('POST', '/api/chart', { type: 'pie', xAxis: 'Category', yAxis: ['Revenue'], rows });
    check('POST /api/chart (pie)', pie.status === 200 && JSON.parse(pie.body).data.datasets.length === 1);

    const multi = await req('POST', '/api/chart', { type: 'bar', xAxis: 'Category', yAxis: ['Revenue', 'Units'], rows: rows.map((r) => ({ ...r, Units: '10' })) });
    check('POST /api/chart (multi-series)', multi.status === 200 && JSON.parse(multi.body).data.datasets.length === 2);

    const bad = await req('POST', '/api/chart', { type: 'nope', xAxis: 'x', yAxis: ['y'], rows: [] });
    check('POST /api/chart rejects bad type', bad.status === 400);

    const home = await req('GET', '/');
    check('GET / serves index.html', home.status === 200 && home.body.includes('DataViz'));
  } catch (err) {
    console.error('ERROR', err);
    failures++;
  } finally {
    child.kill();
  }

  console.log(failures === 0 ? '\nAll tests passed ✔' : `\n${failures} test(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
})();
