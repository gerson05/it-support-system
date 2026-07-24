import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllTickets, getTicketById, updateTicket, addMessage, addInternalNote,
} from '../../src/tickets/ticket-model.js';

// ── Mock DB factory ───────────────────────────────────────────────────────────

function makeMockDb(config = {}) {
  const calls = [];
  const db = {
    _calls: calls,
    prepare: (sql) => ({
      get:  (...args) => { calls.push({ op: 'get',  sql, args }); return config.get?.(sql, ...args) ?? null; },
      all:  (...args) => { calls.push({ op: 'all',  sql, args }); return config.all?.(sql, ...args) ?? [];   },
      run:  (...args) => { calls.push({ op: 'run',  sql, args }); return config.run?.(sql, ...args) ?? { changes: 1, lastInsertRowid: 1 }; },
    }),
  };
  return db;
}

// ── getAllTickets ─────────────────────────────────────────────────────────────

test('getAllTickets: no filters → returns paginated result', () => {
  const db = makeMockDb({
    get: (sql) => sql.includes('COUNT(*)') ? { total: 2 } : null,
    all: () => [
      { id: 1, area: 'cartera', ticket_number: 'TK-001', status: 'abierto' },
      { id: 2, area: 'farmacia', ticket_number: 'TK-002', status: 'resuelto' },
    ],
  });
  const result = getAllTickets(db);
  assert.equal(result.total, 2);
  assert.equal(result.tickets.length, 2);
  assert.equal(result.tickets[0].area_label, 'Cartera');
  assert.equal(result.tickets[1].area_label, 'Farmacia');
  assert.equal(result.page, 1);
});

test('getAllTickets: status_group=activos → filters active statuses', () => {
  const db = makeMockDb({
    get: () => ({ total: 0 }),
    all: () => [],
  });
  getAllTickets(db, { status_group: 'activos' });
  const countCall = db._calls.find(c => c.op === 'get' && c.sql.includes('COUNT(*)'));
  assert.ok(countCall.sql.includes('IN ('));
  assert.ok(countCall.sql.includes('abierto') || countCall.sql.includes('?'));
});

test('getAllTickets: status_group=archivo → filters archive statuses', () => {
  const db = makeMockDb({ get: () => ({ total: 0 }), all: () => [] });
  getAllTickets(db, { status_group: 'archivo' });
  const countCall = db._calls.find(c => c.op === 'get');
  assert.ok(countCall.sql.includes('IN ('));
});

test('getAllTickets: specific status filter', () => {
  const db = makeMockDb({ get: () => ({ total: 0 }), all: () => [] });
  getAllTickets(db, { status: 'resuelto' });
  const call = db._calls.find(c => c.op === 'get');
  assert.ok(call.sql.includes('t.status = ?'));
});

test('getAllTickets: priority filter', () => {
  const db = makeMockDb({ get: () => ({ total: 0 }), all: () => [] });
  getAllTickets(db, { priority: 'alta' });
  const call = db._calls.find(c => c.op === 'get');
  assert.ok(call.sql.includes('t.priority = ?'));
});

test('getAllTickets: search filter adds LIKE clauses', () => {
  const db = makeMockDb({ get: () => ({ total: 0 }), all: () => [] });
  getAllTickets(db, { search: 'excel' });
  const call = db._calls.find(c => c.op === 'get');
  assert.ok(call.sql.includes('LIKE ?'));
});

test('getAllTickets: assigned_to=null → IS NULL clause', () => {
  const db = makeMockDb({ get: () => ({ total: 0 }), all: () => [] });
  getAllTickets(db, { assigned_to: 'null' });
  const call = db._calls.find(c => c.op === 'get');
  assert.ok(call.sql.includes('IS NULL'));
});

test('getAllTickets: assigned_to=5 → numeric filter', () => {
  const db = makeMockDb({ get: () => ({ total: 0 }), all: () => [] });
  getAllTickets(db, { assigned_to: '5' });
  const call = db._calls.find(c => c.op === 'get');
  assert.ok(call.sql.includes('t.assigned_to = ?'));
});

test('getAllTickets: pagination → correct total_pages', () => {
  const db = makeMockDb({ get: () => ({ total: 25 }), all: () => [] });
  const result = getAllTickets(db, { page: 2, limit: 10 });
  assert.equal(result.total_pages, 3);
  assert.equal(result.page, 2);
});

test('getAllTickets: unknown area_label → falls back to area code', () => {
  const db = makeMockDb({
    get: () => ({ total: 1 }),
    all: () => [{ id: 1, area: 'unknown_area', ticket_number: 'TK-X' }],
  });
  const result = getAllTickets(db);
  assert.equal(result.tickets[0].area_label, 'unknown_area');
});

// ── getTicketById ─────────────────────────────────────────────────────────────

test('getTicketById: found → returns ticket with messages and notes', () => {
  const db = makeMockDb({
    get: (sql) => sql.includes('WHERE t.id') ? { id: 1, area: 'farmacia', ticket_number: 'TK-001' } : null,
    all: (sql) => sql.includes('messages') ? [{ id: 10, content: 'Hola' }]
                : sql.includes('internal_notes') ? [{ id: 20, content: 'Nota' }]
                : [],
  });
  const ticket = getTicketById(db, 1);
  assert.equal(ticket.id, 1);
  assert.equal(ticket.area_label, 'Farmacia');
  assert.equal(ticket.messages.length, 1);
  assert.equal(ticket.notes.length, 1);
});

test('getTicketById: not found → null', () => {
  const db = makeMockDb({ get: () => null });
  assert.equal(getTicketById(db, 999), null);
});

// ── updateTicket ─────────────────────────────────────────────────────────────

test('updateTicket: empty data → returns false', () => {
  const db = makeMockDb();
  const result = updateTicket(db, 1, {});
  assert.equal(result, false);
  assert.equal(db._calls.length, 0);
});

test('updateTicket: status=resuelto → includes resolved_at', () => {
  const db = makeMockDb();
  updateTicket(db, 1, { status: 'resuelto' });
  const call = db._calls.find(c => c.op === 'run');
  assert.ok(call.sql.includes('resolved_at = datetime'));
  assert.ok(!call.sql.includes('resolved_at = NULL'));
});

test('updateTicket: status=abierto → sets resolved_at NULL', () => {
  const db = makeMockDb();
  updateTicket(db, 1, { status: 'abierto' });
  const call = db._calls.find(c => c.op === 'run');
  assert.ok(call.sql.includes('resolved_at = NULL'));
});

test('updateTicket: priority update → correct field', () => {
  const db = makeMockDb();
  updateTicket(db, 1, { priority: 'alta' });
  const call = db._calls.find(c => c.op === 'run');
  assert.ok(call.sql.includes('priority = ?'));
});

test('updateTicket: assigned_to=null → stores NULL', () => {
  const db = makeMockDb();
  updateTicket(db, 1, { assigned_to: null });
  const call = db._calls.find(c => c.op === 'run');
  assert.ok(call.sql.includes('assigned_to = ?'));
  assert.ok(call.args.includes(null));
});

test('updateTicket: changes=0 → returns false', () => {
  const db = makeMockDb({ run: () => ({ changes: 0 }) });
  const result = updateTicket(db, 999, { status: 'abierto' });
  assert.equal(result, false);
});

test('updateTicket: changes=1 → returns true', () => {
  const db = makeMockDb({ run: () => ({ changes: 1 }) });
  const result = updateTicket(db, 1, { status: 'abierto' });
  assert.equal(result, true);
});

// ── addMessage ────────────────────────────────────────────────────────────────

test('addMessage: inserts message and updates ticket timestamp', () => {
  const db = makeMockDb();
  const result = addMessage(db, 1, 'agent', 'IT', 'Mensaje de prueba');
  assert.equal(result, true);
  const insert = db._calls.find(c => c.op === 'run' && c.sql.includes('INSERT INTO messages'));
  const update = db._calls.find(c => c.op === 'run' && c.sql.includes('UPDATE tickets'));
  assert.ok(insert, 'should insert message');
  assert.ok(update, 'should update ticket timestamp');
});

test('addMessage: changes=0 → returns false', () => {
  const db = makeMockDb({ run: () => ({ changes: 0 }) });
  const result = addMessage(db, 1, 'agent', 'IT', 'Prueba');
  assert.equal(result, false);
});

// ── addInternalNote ───────────────────────────────────────────────────────────

test('addInternalNote: inserts note and updates ticket timestamp', () => {
  const db = makeMockDb();
  const result = addInternalNote(db, 1, 5, 'Admin', 'Nota privada');
  assert.equal(result, true);
  const insert = db._calls.find(c => c.op === 'run' && c.sql.includes('INSERT INTO internal_notes'));
  const update = db._calls.find(c => c.op === 'run' && c.sql.includes('UPDATE tickets'));
  assert.ok(insert, 'should insert note');
  assert.ok(update, 'should update ticket timestamp');
});

// ── getAllTickets: area filter (lines 68-72) ───────────────────────────────────

test('getAllTickets: area filter adds WHERE clause', () => {
  const db = makeMockDb({ get: () => ({ total: 0 }), all: () => [] });
  getAllTickets(db, { area: 'farmacia' });
  const call = db._calls.find(c => c.op === 'get' && c.sql.includes('COUNT(*)'));
  assert.ok(call.sql.includes('t.area = ?'));
});

// ── updateTicket: requester_name and category (lines 193-201) ────────────────

test('updateTicket: requester_name field included in update', () => {
  const db = makeMockDb();
  updateTicket(db, 1, { requester_name: 'Ana García' });
  const call = db._calls.find(c => c.op === 'run');
  assert.ok(call.sql.includes('requester_name = ?'));
  assert.ok(call.args.includes('Ana García'));
});

test('updateTicket: category field included in update', () => {
  const db = makeMockDb();
  updateTicket(db, 1, { category: 'hardware' });
  const call = db._calls.find(c => c.op === 'run');
  assert.ok(call.sql.includes('category = ?'));
  assert.ok(call.args.includes('hardware'));
});

// ── error propagation (catch blocks) ─────────────────────────────────────────

test('getAllTickets: db error propagates', () => {
  const db = { prepare: () => ({ get: () => { throw new Error('DB fail'); }, all: () => [] }) };
  assert.throws(() => getAllTickets(db), /DB fail/);
});

test('getTicketById: db error propagates', () => {
  const db = { prepare: () => ({ get: () => { throw new Error('DB fail'); }, all: () => [] }) };
  assert.throws(() => getTicketById(db, 1), /DB fail/);
});

test('updateTicket: db error propagates', () => {
  const db = { prepare: () => ({ run: () => { throw new Error('DB fail'); } }) };
  assert.throws(() => updateTicket(db, 1, { status: 'abierto' }), /DB fail/);
});

test('addMessage: db error propagates', () => {
  const db = { prepare: () => ({ run: () => { throw new Error('DB fail'); } }) };
  assert.throws(() => addMessage(db, 1, 'agent', 'IT', 'msg'), /DB fail/);
});

test('addInternalNote: db error propagates', () => {
  const db = { prepare: () => ({ run: () => { throw new Error('DB fail'); } }) };
  assert.throws(() => addInternalNote(db, 1, 1, 'Admin', 'note'), /DB fail/);
});
