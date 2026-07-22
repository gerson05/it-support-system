import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const mockGetSession = mock.fn((token) => {
  if (token === 'valid')   return { id: 1, username: 'admin',  permissions: ['full'] };
  if (token === 'limited') return { id: 2, username: 'viewer', permissions: ['tickets:read'] };
  return null;
});

await mock.module('../../src/auth/auth-service.js', {
  exports: { getSession: mockGetSession },
});

const { requireAuth, requirePermission } = await import('../../src/auth/auth-middleware.js');

function makeReq(cookie = '') {
  return { headers: { cookie }, user: undefined, permissions: undefined };
}
function makeRes() {
  const res = {};
  res.status = (s) => { res._status = s; return res; };
  res.json   = (b) => { res._body   = b; return res; };
  return res;
}

// ── requireAuth ──────────────────────────────────────────────────────────────

test('requireAuth: no cookie → 401', () => {
  const res = makeRes(); let called = false;
  requireAuth(makeReq(''), res, () => { called = true; });
  assert.equal(res._status, 401);
  assert.equal(called, false);
});

test('requireAuth: invalid token → 401', () => {
  const res = makeRes(); let called = false;
  requireAuth(makeReq('it_session=bogus'), res, () => { called = true; });
  assert.equal(res._status, 401);
  assert.equal(called, false);
});

test('requireAuth: valid token → sets req.user and calls next', () => {
  const req = makeReq('it_session=valid');
  const res = makeRes(); let called = false;
  requireAuth(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.user.username, 'admin');
  assert.deepEqual(req.permissions, ['full']);
});

test('requireAuth: parses token from cookie with other fields', () => {
  const req = makeReq('path=/; it_session=valid; HttpOnly');
  const res = makeRes(); let called = false;
  requireAuth(req, res, () => { called = true; });
  assert.equal(called, true);
});

// ── requirePermission ────────────────────────────────────────────────────────

test('requirePermission: empty permissions → 403', () => {
  const res = makeRes(); let called = false;
  requirePermission('tickets:read')({ permissions: [] }, res, () => { called = true; });
  assert.equal(res._status, 403);
  assert.equal(called, false);
});

test('requirePermission: "full" permission → passes any check', () => {
  const res = makeRes(); let called = false;
  requirePermission('despacho:delete')({ permissions: ['full'] }, res, () => { called = true; });
  assert.equal(called, true);
});

test('requirePermission: exact permission match → passes', () => {
  const res = makeRes(); let called = false;
  requirePermission('tickets:read')({ permissions: ['tickets:read', 'sedes:read'] }, res, () => { called = true; });
  assert.equal(called, true);
});

test('requirePermission: wrong permission → 403', () => {
  const res = makeRes(); let called = false;
  requirePermission('despacho:edit')({ permissions: ['tickets:read'] }, res, () => { called = true; });
  assert.equal(res._status, 403);
  assert.equal(called, false);
});

test('requirePermission: undefined permissions → 403', () => {
  const res = makeRes(); let called = false;
  requirePermission('tickets:read')({ permissions: undefined }, res, () => { called = true; });
  assert.equal(res._status, 403);
  assert.equal(called, false);
});
