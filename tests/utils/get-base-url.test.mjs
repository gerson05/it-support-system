import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getBaseUrl } from '../../src/utils/get-base-url.js';

function makeReq(headers = {}, protocol = 'https') {
  return { protocol, headers };
}

afterEach(() => {
  delete process.env.APP_URL;
  delete process.env.PUBLIC_TUNNEL_URL;
});

// ── env var priority ──────────────────────────────────────────────────────────

test('getBaseUrl: returns APP_URL with trailing slash stripped', () => {
  process.env.APP_URL = 'https://myapp.example.com/';
  assert.equal(getBaseUrl(makeReq()), 'https://myapp.example.com');
});

test('getBaseUrl: returns APP_URL without trailing slash unchanged', () => {
  process.env.APP_URL = 'https://myapp.example.com';
  assert.equal(getBaseUrl(makeReq()), 'https://myapp.example.com');
});

test('getBaseUrl: returns PUBLIC_TUNNEL_URL when APP_URL not set', () => {
  process.env.PUBLIC_TUNNEL_URL = 'https://tunnel.example.com';
  assert.equal(getBaseUrl(makeReq()), 'https://tunnel.example.com');
});

test('getBaseUrl: APP_URL takes precedence over PUBLIC_TUNNEL_URL', () => {
  process.env.APP_URL = 'https://app.example.com';
  process.env.PUBLIC_TUNNEL_URL = 'https://tunnel.example.com';
  assert.equal(getBaseUrl(makeReq()), 'https://app.example.com');
});

// ── x-forwarded-host ──────────────────────────────────────────────────────────

test('getBaseUrl: uses x-forwarded-host with request protocol', () => {
  const req = makeReq({ 'x-forwarded-host': 'proxy.example.com' }, 'https');
  assert.equal(getBaseUrl(req), 'https://proxy.example.com');
});

test('getBaseUrl: picks first value from multi-value x-forwarded-host', () => {
  const req = makeReq({ 'x-forwarded-host': 'first.com, second.com' }, 'http');
  assert.equal(getBaseUrl(req), 'http://first.com');
});

test('getBaseUrl: x-forwarded-host strips surrounding whitespace', () => {
  const req = makeReq({ 'x-forwarded-host': '  trimmed.com  , other.com' }, 'https');
  assert.equal(getBaseUrl(req), 'https://trimmed.com');
});

// ── host header fallback ──────────────────────────────────────────────────────

test('getBaseUrl: falls back to host header for production domain', () => {
  const req = makeReq({ host: 'production.example.com' }, 'https');
  assert.equal(getBaseUrl(req), 'https://production.example.com');
});

test('getBaseUrl: empty headers produces protocol+empty-host', () => {
  const req = makeReq({}, 'http');
  assert.equal(getBaseUrl(req), 'http://');
});

// ── localhost → networkInterfaces branch (lines 15-21) ───────────────────────

test('getBaseUrl: localhost host enters network interface resolution', () => {
  const req = makeReq({ host: 'localhost:3000' }, 'http');
  const result = getBaseUrl(req);
  assert.ok(result.startsWith('http://'));
  assert.ok(result.includes(':3000'));
});

test('getBaseUrl: 127.0.0.1 host triggers local resolution path', () => {
  const req = makeReq({ host: '127.0.0.1:8080' }, 'http');
  const result = getBaseUrl(req);
  assert.ok(result.startsWith('http://'));
  assert.ok(result.includes(':8080'));
});
