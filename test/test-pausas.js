import assert from 'node:assert/strict';

// mock de storage (a store do front lê localStorage ao ser importada)
for (const k of ['localStorage', 'sessionStorage']) {
  if (typeof globalThis[k] === 'undefined') {
    const s = {};
    globalThis[k] = new Proxy({ getItem: x => s[x] ?? null, setItem: (x, v) => { s[x] = String(v); } }, {
      get: (t, p) => (p in t ? t[p] : s[p]), set: (t, p, v) => { s[p] = String(v); return true; }
    });
  }
}

const { parseLine, parseText } = await import('../lib/parse.js');
const { computeMetrics } = await import('../public/js/services/metrics-service.js');

const now = new Date('2026-11-04T18:00:00Z'); // 15:00 em São Paulo
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('parser: "pausa" e "voltei"', () => {
  assert.equal(parseLine('pausa', now).tipo, 'pausa_ini');
  assert.equal(parseLine('Pausa', now).valor, null);
  assert.equal(parseLine('voltei', now).tipo, 'pausa_fim');
  assert.equal(parseLine('fim da pausa', now).tipo, 'pausa_fim');
  assert.equal(parseLine('intervalo', now).tipo, 'pausa_ini');
});
t('parser: pausa com horário', () => {
  const r = parseLine('pausa 12:00', now);
  assert.equal(r.tipo, 'pausa_ini');
  assert.equal(r.ts, '2026-11-04T15:00:00.000Z'); // 12:00 BRT
});
t('parser: "pausa 20min" gera início e fim', () => {
  const rows = parseText('pausa 20min', now);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.tipo), ['pausa_ini', 'pausa_fim']);
  assert.equal((new Date(rows[1].ts) - new Date(rows[0].ts)) / 6e4, 20);
});
t('parser: não quebra despesa/turno existentes', () => {
  assert.equal(parseLine('almoço 25', now).tipo, 'despesa');
  assert.equal(parseLine('fim 45230', now).tipo, 'sessao_fim');
  assert.equal(parseLine('inicio 45100', now).tipo, 'sessao_ini');
});
t('métricas: pausa é descontada das horas da sessão', () => {
  const rows = [
    { tipo: 'sessao_ini', ts: '2026-11-03T10:00:00Z', valor: 45000 },
    { tipo: 'ganho', ts: '2026-11-03T10:30:00Z', valor: 20 },
    { tipo: 'pausa_ini', ts: '2026-11-03T12:00:00Z' },
    { tipo: 'pausa_fim', ts: '2026-11-03T12:40:00Z' },
    { tipo: 'ganho', ts: '2026-11-03T13:00:00Z', valor: 30 },
    { tipo: 'sessao_fim', ts: '2026-11-03T14:00:00Z', valor: 45100 }
  ];
  const m = computeMetrics(rows);
  assert.equal(m.sess.length, 1);
  assert.equal(Math.round(m.sess[0].pausaMin), 40);
  const d = Object.values(m.days)[0];
  assert.equal(Math.round(d.min), 200);      // 240 − 40
  assert.equal(Math.round(d.pausaMin), 40);
  assert.equal(m.pausaAtiva, null);
});
t('métricas: pausa aberta aparece como ativa', () => {
  const ini = new Date(Date.now() - 15 * 6e4).toISOString();
  const rows = [
    { tipo: 'sessao_ini', ts: new Date(Date.now() - 2 * 36e5).toISOString(), valor: 45000 },
    { tipo: 'pausa_ini', ts: ini }
  ];
  const m = computeMetrics(rows);
  assert.ok(m.pausaAtiva);
  assert.ok(m.sess[0].pausaMin >= 14 && m.sess[0].pausaMin <= 16);
});
t('métricas: pausa_fim solto é ignorado', () => {
  const m = computeMetrics([{ tipo: 'pausa_fim', ts: '2026-11-03T12:00:00Z' }]);
  assert.equal(m.pausas.length, 0);
});
console.log(`\n${n} testes de pausas OK`);
