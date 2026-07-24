import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrap } from '../../src/utils/async-handler.js';

function makeReq() { return {}; }
function makeRes() {
  const res = {};
  res.status = (s) => { res._status = s; return res; };
  res.json   = (b) => { res._body   = b; return res; };
  return res;
}

test('wrap: passes req/res/next to handler', async () => {
  let received = null;
  const handler = wrap(async (req, res, next) => { received = { req, res, next }; });
  const req = makeReq(), res = makeRes();
  const next = () => {};
  await handler(req, res, next);
  assert.equal(received.req, req);
  assert.equal(received.res, res);
  assert.equal(received.next, next);
});

test('wrap: calls next(err) when handler throws', async () => {
  const error = new Error('boom');
  const handler = wrap(async () => { throw error; });
  let caughtErr = null;
  await handler(makeReq(), makeRes(), (err) => { caughtErr = err; });
  assert.equal(caughtErr, error);
});

test('wrap: does not call next when handler resolves normally', async () => {
  const handler = wrap(async (_req, res) => { res.json({ ok: true }); });
  let nextCalled = false;
  const res = makeRes();
  await handler(makeReq(), res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.deepEqual(res._body, { ok: true });
});

test('wrap: works with sync-returning handler', async () => {
  const handler = wrap((_req, res) => { res.json({ sync: true }); });
  const res = makeRes();
  await handler(makeReq(), res, () => {});
  assert.deepEqual(res._body, { sync: true });
});
