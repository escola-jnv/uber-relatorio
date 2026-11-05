import assert from 'node:assert/strict';
import { completeOdo, fixOdoRows, rawOdo } from '../lib/odo.js';
let ok = 0;
const t = (n, f) => Promise.resolve().then(f).then(() => { ok++; console.log('  ✓', n); }, e => { console.error('  ✗', n, e.message); process.exitCode = 1; });
console.log('--- lib/odo.js ---');
await t('completeOdo', () => { assert.equal(completeOdo(469, 55459), 55469); assert.equal(completeOdo(5, 55990), 56005); assert.equal(completeOdo(469, null), null); });
await t('rawOdo lê A→B, odo N e valor', () => {
  assert.equal(rawOdo({ tipo: 'ganho', obs: 'x · odo 55514→55522' }), 55522);
  assert.equal(rawOdo({ tipo: 'despesa', obs: 'abastecimento · odo 55470' }), 55470);
  assert.equal(rawOdo({ tipo: 'odometro', valor: 55415 }), 55415);
});
await t('fixOdoRows completa odo de 3 dígitos usando a última leitura do banco', async () => {
  const sb = async () => [{ tipo: 'sessao_fim', valor: '55459', obs: '[🚗 UAX-7E23] turno' }];
  const rows = await fixOdoRows([{ tipo: 'odometro', valor: 469, obs: '[🚗 UAX-7E23]' }], sb, 'UAX-7E23');
  assert.equal(rows[0].valor, 55469);
  assert.ok(rows[0].obs.includes('odo lido 469'));
});
await t('fixOdoRows sem referência não grava 3 dígitos como odômetro', async () => {
  const rows = await fixOdoRows([{ tipo: 'odometro', valor: 469 }], async () => [], null);
  assert.equal(rows[0].valor, null);
});
console.log(ok + ' ok');
