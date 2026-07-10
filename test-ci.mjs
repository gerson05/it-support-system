import { spawn } from 'child_process';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

const PORT = process.env.PORT || 3001;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let sessionCookie = '';

function request(method, path, payload) {
  return new Promise((resolve, reject) => {
    const raw = payload ? JSON.stringify(payload) : null;
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        ...(raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } : {}),
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

const get  = path         => request('GET',  path);
const post = (path, data) => request('POST', path, data);

let failed = false;
function check(label, pass, detail = '') {
  console.log(`${pass ? '✓' : '✗'} ${label}${detail ? ` [${detail}]` : ''}`);
  if (!pass) failed = true;
}

async function main() {
  const server = spawn('node', ['server.js'], {
    stdio: 'pipe',
    env: { ...process.env, PORT },
  });
  server.stdout.on('data', d => process.stdout.write(d));
  server.stderr.on('data', d => process.stderr.write(d));

  console.log('Waiting for server to start...');
  await sleep(5000);

  // Seed test sede so chatbot city lookup works
  try {
    const dbPath = process.env.DATABASE_PATH || 'database/tickets.db';
    if (fs.existsSync(dbPath)) {
      const seedDb = new DatabaseSync(dbPath);
      const count = seedDb.prepare('SELECT COUNT(*) AS n FROM sedes').get().n;
      if (count === 0) {
        seedDb.prepare("INSERT INTO sedes (ciudad, nombre_punto) VALUES ('Cali', 'SEDE PRINCIPAL')").run();
        console.log('Seeded test sede: Cali / SEDE PRINCIPAL');
      }
      seedDb.close();
    }
  } catch (e) { console.warn('Seed warning:', e.message); }

  // Health (no auth required)
  const health = await get('/api/health').catch(e => ({ status: 0, body: e.message }));
  check('Health check', health.status === 200, `HTTP ${health.status}`);

  // Login to get session cookie
  const login = await post('/api/auth/login', {
    username: 'admin',
    password: process.env.INIT_ADMIN_PASS,
  }).catch(e => ({ status: 0, body: e.message }));
  console.log(`  login response: ${JSON.stringify(login.body)}`);
  console.log(`  session cookie: ${sessionCookie || '(none)'}`);
  check('Admin login', login.status === 200, `HTTP ${login.status}`);

  // Authenticated endpoints
  for (const [path, label] of [
    ['/api/tickets', 'Tickets list'],
    ['/api/metrics', 'Metrics'],
  ]) {
    const r = await get(path).catch(e => ({ status: 0, body: e.message }));
    check(label, r.status === 200, `HTTP ${r.status}`);
  }

  // Chatbot flow — creates a ticket
  console.log('\n--- Chatbot flow ---');
  const flow = [
    { phone: '573001234567', message: 'hola' },
    { phone: '573001234567', message: '1' },          // Problema técnico
    { phone: '573001234567', message: 'Cali' },       // Ciudad → auto-selecciona SEDE PRINCIPAL
    { phone: '573001234567', message: 'Juan Test' },  // Nombre
    { phone: '573001234567', message: 'Software contable no abre' }, // Problema → crea ticket
  ];
  for (const msg of flow) {
    const r = await post('/api/simulate', msg).catch(e => ({ status: 0, body: e.message }));
    const reply = r.body?.response?.slice(0, 100) || JSON.stringify(r.body).slice(0, 100);
    check(`simulate "${msg.message}"`, r.status === 200, `HTTP ${r.status}`);
    console.log(`  bot: ${reply}`);
    await sleep(200);
  }

  // Verify ticket was created (authenticated)
  const tickets = await get('/api/tickets').catch(e => ({ status: 0, body: {} }));
  console.log(`  tickets response: HTTP ${tickets.status} body=${JSON.stringify(tickets.body).slice(0, 200)}`);
  check('Ticket was created', (tickets.body?.total ?? 0) > 0, `total=${tickets.body?.total}`);

  server.kill();
  console.log('\n' + (failed ? '✗ Some tests FAILED' : '✓ All tests passed'));
  process.exit(failed ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
