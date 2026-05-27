import { spawn } from 'child_process';
import http from 'http';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetch(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const server = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, PORT: '3001' }
  });

  server.stdout.on('data', d => process.stdout.write(d));
  server.stderr.on('data', d => process.stderr.write(d));

  // Wait for server to start
  await sleep(3000);

  const endpoints = [
    '/api/agents',
    '/api/tickets',
    '/api/metrics',
    '/api/tickets/1'
  ];

  let allPass = true;

  for (const ep of endpoints) {
    try {
      const result = await fetch(ep);
      console.log(`${result.status === 200 ? '✓' : '✗'} ${ep} -> ${result.status}`);
      if (result.status !== 200) {
        allPass = false;
        console.log(`  Error: ${JSON.stringify(result.data).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`✗ ${ep} -> Error: ${e.message}`);
      allPass = false;
    }
  }

  // Test POST simulate
  try {
    const result = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ phone: '573001234567', message: 'hola' });
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/simulate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    console.log(`${result.status === 200 ? '✓' : '✗'} POST /api/simulate -> ${result.status}`);
    if (result.status === 200) {
      const parsed = JSON.parse(result.data);
      console.log(`  Response: ${parsed.response?.slice(0, 100)}...`);
    }
  } catch (e) {
    console.log(`✗ POST /api/simulate -> Error: ${e.message}`);
    allPass = false;
  }

  // Test full chatbot flow
  const flowMessages = [
    { phone: '573001234567', message: 'hola' },
    { phone: '573001234567', message: '5' },
    { phone: '573001234567', message: '1' },
    { phone: '573001234567', message: '2' },
    { phone: '573001234567', message: 'Mi software contable no abre correctamente' },
  ];

  console.log('\n--- Chatbot Flow Test ---');
  for (const msg of flowMessages) {
    try {
      const result = await new Promise((resolve, reject) => {
        const postData = JSON.stringify(msg);
        const req = http.request({
          hostname: 'localhost',
          port: 3001,
          path: '/api/simulate',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
      });
      if (result.status === 200) {
        const parsed = JSON.parse(result.data);
        console.log(`  User: "${msg.message}"`);
        console.log(`  Bot:  ${parsed.response?.slice(0, 80)}...`);
      }
    } catch (e) {
      console.log(`  Error at "${msg.message}": ${e.message}`);
      allPass = false;
    }
  }

  // Check that a ticket was created
  console.log('\n--- Checking created tickets ---');
  try {
    const tickets = await fetch('/api/tickets');
    console.log(`  Total tickets: ${tickets.data.total}`);
    if (tickets.data.tickets?.length > 0) {
      const t = tickets.data.tickets[0];
      console.log(`  Latest: ${t.ticket_number} - ${t.status} - ${t.area}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  server.kill();
  console.log('\n' + (allPass ? '✓ All tests passed!' : '✗ Some tests failed'));
  process.exit(allPass ? 0 : 1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
