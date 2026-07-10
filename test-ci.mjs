import { spawn } from 'child_process';
import http from 'http';

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: process.env.PORT || 3001,
      path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) },
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

let failed = false;

function check(label, pass, detail = '') {
  const mark = pass ? '✓' : '✗';
  console.log(`${mark} ${label}${detail ? ` [${detail}]` : ''}`);
  if (!pass) failed = true;
}

async function main() {
  const server = spawn('node', ['server.js'], {
    stdio: 'pipe',
    env: { ...process.env, PORT: process.env.PORT || '3001' },
  });
  server.stdout.on('data', d => process.stdout.write(d));
  server.stderr.on('data', d => process.stderr.write(d));

  console.log('Waiting for server to start...');
  await sleep(5000);

  // Basic endpoints
  for (const [path, label, acceptedStatuses] of [
    ['/api/health', 'Health check', [200]],
    ['/api/tickets', 'Tickets list', [200]],
    ['/api/metrics', 'Metrics', [200]],
  ]) {
    const r = await get(path).catch(e => ({ status: 0, body: e.message }));
    check(label, acceptedStatuses.includes(r.status), `HTTP ${r.status}`);
  }

  // Chatbot flow — creates a ticket
  console.log('\n--- Chatbot flow ---');
  const flow = [
    { phone: '573001234567', message: 'hola' },
    { phone: '573001234567', message: '5' },
    { phone: '573001234567', message: '1' },
    { phone: '573001234567', message: '2' },
    { phone: '573001234567', message: 'Software contable no abre' },
  ];
  for (const msg of flow) {
    const r = await post('/api/simulate', msg).catch(e => ({ status: 0, body: e.message }));
    check(`simulate "${msg.message}"`, r.status === 200, `HTTP ${r.status}`);
    await sleep(200);
  }

  // Ticket created
  const tickets = await get('/api/tickets').catch(e => ({ status: 0, body: {} }));
  check('Ticket was created', (tickets.body?.total ?? 0) > 0, `total=${tickets.body?.total}`);

  server.kill();
  console.log('\n' + (failed ? '✗ Some tests FAILED' : '✓ All tests passed'));
  process.exit(failed ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
