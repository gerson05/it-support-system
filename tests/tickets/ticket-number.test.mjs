import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTicketNumber } from '../../src/tickets/ticket-number.js';

const TODAY = new Date().toISOString().slice(0, 10).replace(/-/g, '');

function makeDb({ last = null, deleted = [] } = {}) {
  const calls = [];
  return {
    calls,
    prepare: (sql) => ({
      get: async (...args) => { calls.push({ sql, args }); return last ? { ticket_number: last } : null; },
      all: async (...args) => { calls.push({ sql, args }); return deleted.map(n => ({ entity_number: n })); },
    }),
  };
}

test('nextTicketNumber: first ticket of the day → 001', async () => {
  assert.equal(await nextTicketNumber(makeDb()), `TK-${TODAY}-001`);
});

test('nextTicketNumber: continues after the last existing ticket', async () => {
  assert.equal(await nextTicketNumber(makeDb({ last: `TK-${TODAY}-003` })), `TK-${TODAY}-004`);
});

test('nextTicketNumber: does not reuse the number of a deleted ticket', async () => {
  const db = makeDb({ last: `TK-${TODAY}-003`, deleted: [`TK-${TODAY}-005`, `TK-${TODAY}-004`] });
  assert.equal(await nextTicketNumber(db), `TK-${TODAY}-006`);
});

test('nextTicketNumber: all tickets of the day deleted → continues after them', async () => {
  assert.equal(await nextTicketNumber(makeDb({ deleted: [`TK-${TODAY}-002`] })), `TK-${TODAY}-003`);
});

test('nextTicketNumber: queries are scoped to today and to deletions', async () => {
  const db = makeDb();
  await nextTicketNumber(db);
  assert.ok(db.calls.every(c => c.args[0] === `TK-${TODAY}-%`));
  assert.ok(db.calls.some(c => c.sql.includes("action = 'Ticket eliminado'")));
});
