import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esChatIndividual } from '../../src/whatsapp/chat-filter.js';

const individual = (extra = {}) => ({
  from: '573001112233@c.us', to: '573009998877@c.us', id: { remote: '573001112233@c.us' },
  getChat: async () => ({ isGroup: false, id: { _serialized: '573001112233@c.us' } }),
  ...extra,
});

test('esChatIndividual: accepts private chats (phone and LID)', async () => {
  assert.equal(await esChatIndividual(individual()), true);
  assert.equal(await esChatIndividual(individual({ from: '237812345678@lid', id: { remote: '237812345678@lid' } })), true);
  assert.equal(await esChatIndividual({ from: '573001112233@c.us' }), true); // sin getChat
});

test('esChatIndividual: rejects groups by any signal', async () => {
  assert.equal(await esChatIndividual(individual({ from: '120363000000000000@g.us' })), false);
  assert.equal(await esChatIndividual(individual({ id: { remote: '120363000000000000@g.us' } })), false);
  assert.equal(await esChatIndividual(individual({ author: '237812345678@lid' })), false);
  assert.equal(await esChatIndividual(individual({ isGroupMsg: true })), false);
  // msg.from con LID del participante pero el chat real es un grupo
  assert.equal(await esChatIndividual(individual({
    from: '237812345678@lid', getChat: async () => ({ isGroup: true }),
  })), false);
  assert.equal(await esChatIndividual(individual({
    getChat: async () => ({ isGroup: false, id: { _serialized: '120363000000000000@g.us' } }),
  })), false);
});

test('esChatIndividual: rejects status, broadcasts, channels, own and empty messages', async () => {
  assert.equal(await esChatIndividual(individual({ from: 'status@broadcast' })), false);
  assert.equal(await esChatIndividual(individual({ isStatus: true })), false);
  assert.equal(await esChatIndividual(individual({ broadcast: true })), false);
  assert.equal(await esChatIndividual(individual({ from: '120363111@newsletter' })), false);
  assert.equal(await esChatIndividual(individual({ fromMe: true })), false);
  assert.equal(await esChatIndividual(individual({ from: 'raro' })), false);
  assert.equal(await esChatIndividual(null), false);
});

test('esChatIndividual: if getChat fails, falls back to the other signals', async () => {
  const msg = individual({ getChat: async () => { throw new Error('puppeteer'); } });
  assert.equal(await esChatIndividual(msg), true);
});
