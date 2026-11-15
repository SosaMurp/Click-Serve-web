import test from 'node:test';
import assert from 'node:assert/strict';
import { leerRetornoStripe } from '../stripeRetorno.ts';

test('regreso exitoso desde una URL del teléfono', () => {
  assert.deepEqual(
    leerRetornoStripe('click-serve://tarjetas?tarjeta=ok&session_id=cs_test_a1B2c3'),
    { estado: 'ok', sessionId: 'cs_test_a1B2c3' },
  );
  assert.deepEqual(
    leerRetornoStripe('exp://192.168.1.5:8081/--/tarjetas?session_id=cs_test_X9&tarjeta=ok#frag'),
    { estado: 'ok', sessionId: 'cs_test_X9' },
  );
});

test('cancelado no devuelve session_id', () => {
  assert.deepEqual(leerRetornoStripe('click-serve://tarjetas?tarjeta=cancelada&session_id=cs_test_1'), { estado: 'cancelada', sessionId: null });
});

test('sin parámetros o con valores raros no hace nada', () => {
  assert.deepEqual(leerRetornoStripe('click-serve://tarjetas'), { estado: 'ninguno', sessionId: null });
  assert.deepEqual(leerRetornoStripe(null), { estado: 'ninguno', sessionId: null });
  assert.deepEqual(leerRetornoStripe('x://t?tarjeta=hack'), { estado: 'ninguno', sessionId: null });
});

test('un session_id que no es de Stripe se descarta', () => {
  assert.deepEqual(leerRetornoStripe('x://t?tarjeta=ok&session_id=../../admin'), { estado: 'ok', sessionId: null });
  assert.deepEqual(leerRetornoStripe('x://t?tarjeta=ok&session_id=%E0%A4%A'), { estado: 'ok', sessionId: null });
});

test('acepta los parámetros ya leídos por el router (web)', () => {
  assert.deepEqual(leerRetornoStripe({ tarjeta: 'ok', session_id: 'cs_live_Z' }), { estado: 'ok', sessionId: 'cs_live_Z' });
  assert.deepEqual(leerRetornoStripe({ tarjeta: ['ok'], session_id: ['cs_test_A', 'cs_test_B'] }), { estado: 'ok', sessionId: 'cs_test_A' });
});
