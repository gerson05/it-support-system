import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhone } from '../../src/whatsapp/resolve-phone.js';

const lidMsg = (contact = { number: '237461234567890', id: { server: 'lid' } }) => ({
  from: '237461234567890@lid',
  getContact: async () => contact,
});

test('resolvePhone: LID → real number from getContactLidAndPhone', async () => {
  const client = { getContactLidAndPhone: async () => [{ lid: '237461234567890@lid', pn: '573001234567@c.us' }] };
  assert.equal(await resolvePhone(client, lidMsg()), '573001234567');
});

test('resolvePhone: LID without pn does not return LID digits from getContact', async () => {
  const client = { getContactLidAndPhone: async () => [{ lid: '237461234567890@lid', pn: undefined }] };
  const phone = await resolvePhone(client, lidMsg());
  // Sin número real disponible se cae al id del chat, pero nunca a contact.number de un LID
  assert.equal(phone, '237461234567890');
});

test('resolvePhone: LID lookup failure falls back to phone-type contact', async () => {
  const client = { getContactLidAndPhone: async () => { throw new Error('boom'); } };
  const msg = lidMsg({ number: '573009998877', id: { server: 'c.us' } });
  assert.equal(await resolvePhone(client, msg), '573009998877');
});

test('resolvePhone: classic @c.us chat uses contact number', async () => {
  const client = { getContactLidAndPhone: async () => { throw new Error('should not be called'); } };
  const msg = { from: '573001112233@c.us', getContact: async () => ({ number: '573001112233', id: { server: 'c.us' } }) };
  assert.equal(await resolvePhone(client, msg), '573001112233');
});

test('resolvePhone: getContact failure → digits of chatId', async () => {
  const msg = { from: '573004445566@c.us', getContact: async () => { throw new Error('x'); } };
  assert.equal(await resolvePhone({}, msg), '573004445566');
});
