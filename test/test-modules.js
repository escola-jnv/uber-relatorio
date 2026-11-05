import assert from 'node:assert/strict';

// Mock simples de localStorage e sessionStorage para execução no ambiente Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
  globalThis.localStorage = new Proxy(globalThis.localStorage, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return store[prop];
    },
    set(target, prop, value) {
      store[prop] = String(value);
      return true;
    }
  });
}

if (typeof globalThis.sessionStorage === 'undefined') {
  const sStore = {};
  globalThis.sessionStorage = {
    getItem: k => sStore[k] ?? null,
    setItem: (k, v) => { sStore[k] = String(v); },
    removeItem: k => { delete sStore[k]; },
    clear: () => { for (const k in sStore) delete sStore[k]; }
  };
  globalThis.sessionStorage = new Proxy(globalThis.sessionStorage, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return sStore[prop];
    },
    set(target, prop, value) {
      sStore[prop] = String(value);
      return true;
    }
  });
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    Erro: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    Erro: ${err.message}`);
    failed++;
  }
}

console.log('\n--- Testando Utilitários de Formatação (public/js/utils/format.js) ---');

const { R, R0, N1, pad, dk, hm, weekStart, esc, parseNum, DS: DSFormat } = await import('../public/js/utils/format.js');

test('format.js exporta DS e abreviações dos dias da semana', () => {
  assert.ok(Array.isArray(DSFormat));
  assert.equal(DSFormat.length, 7);
  assert.equal(DSFormat[0], 'dom');
});

test('R() formata valor monetário com duas casas', () => {
  assert.equal(R(25.5), 'R$ 25,50');
  assert.equal(R(0), 'R$ 0,00');
  assert.equal(R(1234.56), 'R$ 1.234,56');
});

test('R0() formata valor monetário arredondado', () => {
  assert.equal(R0(25.4), 'R$ 25');
  assert.equal(R0(25.6), 'R$ 26');
});

test('N1() formata número com até 1 casa decimal', () => {
  assert.equal(N1(12.5), '12,5');
  assert.equal(N1(10), '10');
});

test('pad() formata número com 2 dígitos', () => {
  assert.equal(pad(5), '05');
  assert.equal(pad(12), '12');
});

test('dk() formata chave YYYY-MM-DD', () => {
  const d = new Date('2026-11-03T15:30:00Z');
  assert.match(dk(d), /^\d{4}-\d{2}-\d{2}$/);
});

test('hm() formata horário HH:MM', () => {
  const d = new Date(2026, 10, 3, 14, 5);
  assert.equal(hm(d), '14:05');
});

test('weekStart() retorna segunda-feira anterior à data', () => {
  const t = new Date(2026, 10, 3); // Terça-feira
  const ws = weekStart(t);
  assert.equal(ws.getDay(), 1); // 1 = Segunda-feira
});

test('esc() escapa caracteres HTML perigosos', () => {
  assert.equal(esc('<script>alert("x & y")</script>'), '&lt;script&gt;alert(&quot;x &amp; y&quot;)&lt;/script&gt;');
});

test('parseNum() converte strings pt-BR para float', () => {
  assert.equal(parseNum('25,50'), 25.5);
  assert.equal(parseNum('1.250,75'), 1250.75);
  assert.equal(parseNum('100'), 100);
  assert.equal(parseNum(null), null);
  assert.equal(parseNum(''), null);
});

console.log('\n--- Testando Constantes e Definições (public/js/utils/constants.js) ---');

const { DEF, ALL_COLUMNS, CAT_LABELS } = await import('../public/js/utils/constants.js');

test('DEF contém metas e modelo de carro padrão', () => {
  assert.ok(DEF.meta_lucro_sessao > 0);
  assert.ok(DEF.meta_dia > 0);
  assert.ok(Array.isArray(DEF.carros) && DEF.carros.length > 0);
  assert.ok(DEF.carros[0].placa);
});

test('ALL_COLUMNS define as colunas da tabela e as 7 colunas padrão na ordem correta', () => {
  assert.ok(ALL_COLUMNS.length >= 13);
  assert.equal(ALL_COLUMNS[0].id, 'col-h');
  assert.equal(ALL_COLUMNS[0].label, 'Data/Hora');
  assert.equal(ALL_COLUMNS[1].id, 'col-ic');
  assert.equal(ALL_COLUMNS[2].id, 'col-carro');
  assert.equal(ALL_COLUMNS[3].id, 'col-odo');
  assert.equal(ALL_COLUMNS[4].id, 'col-tempo');
  assert.equal(ALL_COLUMNS[5].id, 'col-passageiro');
  assert.equal(ALL_COLUMNS[6].id, 'col-edit');
  assert.equal(ALL_COLUMNS[6].label, 'Editar');

  const defaultCols = ALL_COLUMNS.filter(c => c.def).map(c => c.id);
  assert.deepEqual(defaultCols, ['col-h', 'col-ic', 'col-carro', 'col-odo', 'col-tempo', 'col-passageiro', 'col-edit']);
});

console.log('\n--- Testando Telemetria e Métricas (public/js/services/metrics-service.js) ---');

const { computeMetrics, calcularMetaSessaoSugerida } = await import('../public/js/services/metrics-service.js');

test('computeMetrics() calcula faturamento diário e sessões', () => {
  const mockRows = [
    { tipo: 'sessao_ini', ts: '2026-11-03T10:00:00.000Z', valor: 45000 },
    { tipo: 'ganho', ts: '2026-11-03T10:30:00.000Z', valor: 35.5, km: 8, passageiro: 'Carlos' },
    { tipo: 'ganho', ts: '2026-11-03T11:15:00.000Z', valor: 24.5, km: 5, passageiro: 'Ana' },
    { tipo: 'despesa', ts: '2026-11-03T11:45:00.000Z', valor: 50, categoria: 'combustivel' },
    { tipo: 'sessao_fim', ts: '2026-11-03T12:00:00.000Z', valor: 45030 }
  ];

  const m = computeMetrics(mockRows);
  assert.ok(m.days);
  const dayKey = dk(new Date('2026-11-03T10:00:00.000Z'));
  const day = m.days[dayKey];
  assert.ok(day);
  assert.equal(day.g, 60);
  assert.equal(day.n, 2);
  assert.equal(day.d, 50);
  assert.equal(day.km, 30); // 45030 - 45000
  assert.equal(m.sess.length, 1);
  assert.equal(m.sess[0].g, 60);
  assert.equal(m.sess[0].n, 2);
});

test('calcularMetaSessaoSugerida() gera meta coerente cobrindo aluguel e combustível', () => {
  const sug = calcularMetaSessaoSugerida(150);
  assert.ok(sug.metaBruta > 150, 'Meta bruta deve ser maior que a meta líquida de lucro');
  assert.equal(sug.lucroAlvo, 150);
  assert.ok(sug.custosEstimados > 0);
});

console.log('\n--- Testando Gestão de Veículos (public/js/services/car-service.js) ---');

const { findCar, getRowCar, getRowObs, getDynamicCarCosts } = await import('../public/js/services/car-service.js');

test('getRowCar() extrai placa do campo carro ou de tag [🚗 PLACA]', () => {
  assert.equal(getRowCar({ carro: 'ABC-1234' }), 'ABC-1234');
  assert.equal(getRowCar({ obs: '[🚗 XYZ-9876] corrida aeroporto' }), 'XYZ-9876');
  assert.equal(getRowCar({ obs: 'corrida sem carro' }), null);
});

test('getRowObs() remove a tag de carro da observação', () => {
  assert.equal(getRowObs({ obs: '[🚗 ABC-1234] passageiro legal' }), 'passageiro legal');
  assert.equal(getRowObs({ obs: 'apenas obs normal' }), 'apenas obs normal');
});

test('findCar() localiza carro cadastrado por placa ou nome', () => {
  const car = findCar('PAD-1234');
  assert.ok(car);
  assert.equal(car.placa, 'PAD-1234');
});

test('getDynamicCarCosts() retorna custos com aluguel e combustível', () => {
  const dyn = getDynamicCarCosts();
  assert.ok(dyn.aluguelDia >= 0);
  assert.ok(dyn.custoKmCombustivel > 0);
  assert.ok(dyn.custoKmTotal >= dyn.custoKmCombustivel);
});

console.log('\n--- Testando State Store (public/js/state/store.js) ---');

const { store, useColumnOrder, loadStoredColumnConfig, persistColumnConfig } = await import('../public/js/state/store.js');

test('Store atualiza dados e notifica subscribers', () => {
  let notified = false;
  const unsubscribe = store.subscribe(() => {
    notified = true;
  });

  store.setFilter({ preset: '7d' });
  assert.ok(notified);
  assert.equal(store.getState().filter.preset, '7d');

  unsubscribe();
});

test('store.setColumnOrder() atualiza ordem das colunas, sanitiza IDs e persiste no session user', () => {
  const customOrder = ['col-edit', 'col-passageiro', 'col-tempo', 'col-odo', 'col-carro', 'col-ic', 'col-h'];
  store.setColumnOrder(customOrder);

  const currentOrder = useColumnOrder();
  assert.equal(currentOrder[0], 'col-edit');
  assert.equal(currentOrder[1], 'col-passageiro');
  assert.equal(currentOrder[2], 'col-tempo');

  // Verifica persistência no localStorage
  assert.ok(globalThis.localStorage.getItem('colunasOrdem'));
  const lsOrder = JSON.parse(globalThis.localStorage.getItem('colunasOrdem'));
  assert.equal(lsOrder[0], 'col-edit');

  // Verifica persistência no sessionStorage
  assert.ok(globalThis.sessionStorage.getItem('colunasOrdem'));
  const ssOrder = JSON.parse(globalThis.sessionStorage.getItem('colunasOrdem'));
  assert.equal(ssOrder[0], 'col-edit');

  // Verifica persistência no sessionUser (tanto em localStorage quanto em sessionStorage)
  assert.ok(globalThis.localStorage.getItem('sessionUser'));
  const lsSessionUser = JSON.parse(globalThis.localStorage.getItem('sessionUser'));
  assert.equal(lsSessionUser.columnOrder[0], 'col-edit');
  assert.equal(lsSessionUser.colunasOrdem[0], 'col-edit');

  assert.ok(globalThis.sessionStorage.getItem('sessionUser'));
  const ssSessionUser = JSON.parse(globalThis.sessionStorage.getItem('sessionUser'));
  assert.equal(ssSessionUser.columnOrder[0], 'col-edit');
});

test('loadStoredColumnConfig() restaura configuração a partir de sessionUser', () => {
  const suMock = {
    colunasOrdem: ['col-v', 'col-h', 'col-lucro'],
    colunasVisiveis: ['col-v', 'col-lucro']
  };
  globalThis.sessionStorage.setItem('sessionUser', JSON.stringify(suMock));

  const cfg = loadStoredColumnConfig();
  assert.equal(cfg.order[0], 'col-v');
  assert.equal(cfg.order[1], 'col-h');
  assert.equal(cfg.order[2], 'col-lucro');
  assert.ok(cfg.visible.has('col-v'));
  assert.ok(cfg.visible.has('col-lucro'));
  assert.ok(!cfg.visible.has('col-h'));
});

test('store.setColumnConfig() atualiza ordem e visibilidade simultaneamente', () => {
  store.setColumnConfig({
    visibleCols: ['col-h', 'col-v', 'col-edit'],
    columnOrder: ['col-v', 'col-h', 'col-edit']
  });

  const state = store.getState();
  assert.deepEqual([...state.visibleCols], ['col-h', 'col-v', 'col-edit']);
  assert.equal(state.columnOrder[0], 'col-v');
  assert.equal(state.columnOrder[1], 'col-h');
  assert.equal(state.columnOrder[2], 'col-edit');
});

test('tabela reflete a ordem e visibilidade das colunas definidas no columnOrder', () => {
  store.setColumnConfig({
    visibleCols: ['col-edit', 'col-tempo', 'col-v'],
    columnOrder: ['col-edit', 'col-tempo', 'col-v', 'col-h']
  });

  const state = store.getState();
  const colMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));
  const activeCols = state.columnOrder
    .filter(id => state.visibleCols.has(id) && colMap.has(id))
    .map(id => colMap.get(id));

  assert.equal(activeCols.length, 3);
  assert.equal(activeCols[0].id, 'col-edit');
  assert.equal(activeCols[1].id, 'col-tempo');
  assert.equal(activeCols[2].id, 'col-v');
});

console.log('\n--- Testando Tabela e Estimativa de Odômetro (public/js/components/table.js) ---');

const { computeAllOdometersAndTimes, getItemOdo, renderTableCell } = await import('../public/js/components/table.js');

test('computeAllOdometersAndTimes() estima odômetro quando não lançado e identifica lançado', () => {
  const rows = [
    { id: 1, ts: '2026-11-03T10:00:00Z', tipo: 'sessao_ini', valor: 50000 },
    { id: 2, ts: '2026-11-03T10:30:00Z', tipo: 'ganho', valor: 24, km: 10, passageiro: 'João' },
    { id: 3, ts: '2026-11-03T11:00:00Z', tipo: 'ganho', valor: 12, km: null, passageiro: 'Maria' },
    { id: 4, ts: '2026-11-03T12:00:00Z', tipo: 'sessao_fim', valor: 50030 }
  ];

  computeAllOdometersAndTimes(rows);

  // Registro 1: lançado
  assert.equal(rows[0]._odo, 50000);
  assert.equal(rows[0]._odoEst, false);

  // Registro 2: estimado entre 50000 e 50030
  assert.ok(rows[1]._odo > 50000 && rows[1]._odo < 50030);
  assert.equal(rows[1]._odoEst, true);

  // Registro 3: estimado entre registro 2 e 50030
  assert.ok(rows[2]._odo >= rows[1]._odo && rows[2]._odo <= 50030);
  assert.equal(rows[2]._odoEst, true);

  // Registro 4: lançado
  assert.equal(rows[3]._odo, 50030);
  assert.equal(rows[3]._odoEst, false);
});

test('getItemOdo() formata odômetro lançado e odômetro estimado', () => {
  const rLancado = { _odo: 55420, _odoEst: false };
  assert.ok(getItemOdo(rLancado).includes('55.420 km'));
  assert.ok(!getItemOdo(rLancado).includes('tag-est'));

  const rEstimado = { _odo: 55428, _odoEst: true };
  assert.ok(getItemOdo(rEstimado).includes('~55.428 km'));
  assert.ok(getItemOdo(rEstimado).includes('tag-est'));
});

test('renderTableCell() formata colunas padrão solicitadas', () => {
  const row = {
    id: 101,
    ts: '2026-11-03T14:35:00Z',
    tipo: 'ganho',
    valor: 35.5,
    passageiro: 'Guilherme',
    _tempoMin: 75, // 1h15m
    _odo: 55500,
    _odoEst: true
  };

  // Coluna 0: Data/Hora
  const cellH = renderTableCell('col-h', row);
  assert.ok(cellH.includes('col-h'));
  assert.ok(cellH.includes('11:35') || cellH.includes('14:35') || cellH.includes('03/11'));

  // Coluna 1: Ícone
  const cellIc = renderTableCell('col-ic', row);
  assert.ok(cellIc.includes('💵'));

  // Coluna 3: Odômetro estimado com tag-est
  const cellOdo = renderTableCell('col-odo', row);
  assert.ok(cellOdo.includes('~55.500 km'));
  assert.ok(cellOdo.includes('tag-est'));

  // Coluna 4: Tempo rodado formato HH:MM (75 min -> 01:15)
  const cellTempo = renderTableCell('col-tempo', row);
  assert.ok(cellTempo.includes('01:15'));

  // Coluna 5: Nome passageiro
  const cellPass = renderTableCell('col-passageiro', row);
  assert.ok(cellPass.includes('Guilherme'));

  // Coluna 6: Editar com ícone de lápis SVG (sem X)
  const cellEdit = renderTableCell('col-edit', row);
  assert.ok(cellEdit.includes('edit-btn'));
  assert.ok(cellEdit.includes('<svg'));
  assert.ok(!cellEdit.includes('×'));
});

test('public/js/components/charts.js importa DS e renderiza sem erros de módulo', async () => {
  const chartsMod = await import('../public/js/components/charts.js');
  assert.ok(typeof chartsMod.bars === 'function');
  assert.ok(typeof chartsMod.renderCharts === 'function');
});

test('store.setMetrics() não dispara notificações para evitar loops recursivos de renderização', () => {
  let subscriberCalls = 0;
  const unsubscribe = store.subscribe(() => {
    subscriberCalls++;
  });

  store.setMetrics({ days: {}, sess: [], ativa: null, hrsByH: Array(24).fill(0), asc: [] });
  assert.equal(subscriberCalls, 0, 'setMetrics não deve notificar subscribers');

  unsubscribe();
});

test('store.notify() possui proteção contra reentrância de listeners', () => {
  let callCount = 0;
  const unsubscribe = store.subscribe(() => {
    callCount++;
    if (callCount < 5) {
      // Tenta re-disparar notify dentro do listener
      store.notify();
    }
  });

  store.notify();
  assert.equal(callCount, 1, 'Listener reentrante não deve disparar em cascata');
  unsubscribe();
});

console.log('\n--- Testando Correções da Interface e Sessão ---');

import fs from 'node:fs';
import path from 'node:path';

test('CSS possui regra [hidden] e .ctx-col-menu[hidden] com !important para garantir fechamento de modais', () => {
  const css = fs.readFileSync(path.resolve('src/styles.css'), 'utf-8');
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  assert.match(css, /\.ctx-col-menu\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  assert.match(css, /\.g3\s*\{/);
});

test('public/index.html coloca resumo de números (#sec-kpis) somente na aba de Insights (#t-ins)', () => {
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf-8');
  const tInsIdx = html.indexOf('id="t-ins"');
  const tCfgIdx = html.indexOf('id="t-cfg"');
  const secKpisIdx = html.indexOf('id="sec-kpis"');
  
  assert.ok(tInsIdx > 0, 'Aba #t-ins deve existir');
  assert.ok(secKpisIdx > 0, '#sec-kpis deve existir');
  assert.ok(secKpisIdx > tInsIdx && secKpisIdx < tCfgIdx, '#sec-kpis deve estar dentro de #t-ins');
});

test('public/index.html possui barra de progresso da sessão e os 3 indicadores (lucro médio, R$/h, R$/km)', () => {
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf-8');
  assert.ok(html.includes('id="sProgBar"'), 'Deve conter barra de progresso #sProgBar');
  assert.ok(html.includes('id="sProgVals"'), 'Deve conter valores de meta #sProgVals');
  assert.ok(html.includes('id="sLucroVal"'), 'Deve conter indicador de Lucro Médio #sLucroVal');
  assert.ok(html.includes('id="sRpHoraVal"'), 'Deve conter indicador R$/h #sRpHoraVal');
  assert.ok(html.includes('id="sRpKmVal"'), 'Deve conter indicador R$/km #sRpKmVal');
});

test('column-modal.js exporta closeColMenu, openColMenu e renderColGrid com suporte a reordenação', async () => {
  const colMod = await import('../public/js/components/modals/column-modal.js');
  assert.equal(typeof colMod.openColMenu, 'function');
  assert.equal(typeof colMod.closeColMenu, 'function');
  assert.equal(typeof colMod.renderColGrid, 'function');
});

test('CSS contém estilos para reordenação de colunas (botões subir/descer, alça de arrasto e drag-and-drop)', () => {
  const css = fs.readFileSync(path.resolve('src/styles.css'), 'utf-8');
  assert.match(css, /\.ctx-btn-move\s*\{/);
  assert.match(css, /\.ctx-drag-handle\s*\{/);
  assert.match(css, /\.ctx-col-item\.dragging\s*\{/);
  assert.match(css, /\.ctx-col-item\.drag-over\s*\{/);
});

test('session-card.js exporta renderSessionCard e initSessionCard', async () => {
  const sessMod = await import('../public/js/components/session-card.js');
  assert.equal(typeof sessMod.renderSessionCard, 'function');
  assert.equal(typeof sessMod.initSessionCard, 'function');
});

test('public/index.html possui botão FAB no canto superior direito da tela de lançamentos', () => {
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf-8');
  assert.ok(html.includes('id="btnFabAdd"'), 'Deve conter botão FAB #btnFabAdd');
  assert.ok(html.includes('class="fab-add"'), 'Deve ter classe .fab-add');
  
  // Verifica se o FAB está dentro da tela de lançamentos (#t-lista)
  const tListaIdx = html.indexOf('id="t-lista"');
  const tGrafIdx = html.indexOf('id="t-graf"');
  const fabIdx = html.indexOf('id="btnFabAdd"');
  assert.ok(fabIdx > tListaIdx && fabIdx < tGrafIdx, 'Botão FAB deve estar na aba de lançamentos #t-lista');

  // Verifica que a tela de lançamentos (#t-lista) não contém mais sess-card ou car-bar
  const tListaContent = html.substring(tListaIdx, tGrafIdx);
  assert.ok(!tListaContent.includes('class="c sess-card"'), '#t-lista não deve conter o card de sessão');
  assert.ok(!tListaContent.includes('class="car-bar"'), '#t-lista não deve conter o container inline de carro');
  assert.ok(!tListaContent.includes('id="qf"'), '#t-lista não deve conter formulário inline #qf');
});

test('public/index.html possui modal dialog #dlgAddEntry para adicionar lançamentos', () => {
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf-8');
  assert.ok(html.includes('id="dlgAddEntry"'), 'Deve conter modal dialog #dlgAddEntry');
  assert.ok(html.includes('id="secModeQuick"'), 'Deve conter seção rápida #secModeQuick');
  assert.ok(html.includes('id="secModeDetail"'), 'Deve conter seção detalhada #secModeDetail');
  assert.ok(html.includes('id="q"'), 'Deve conter input de lançamento rápido #q');
  assert.ok(html.includes('id="fV"'), 'Deve conter input de valor #fV');
});

test('add-entry-modal.js exporta funções de controle do modal', async () => {
  const modalMod = await import('../public/js/components/modals/add-entry-modal.js');
  assert.equal(typeof modalMod.openAddEntryModal, 'function');
  assert.equal(typeof modalMod.closeAddEntryModal, 'function');
  assert.equal(typeof modalMod.setAddEntryMode, 'function');
  assert.equal(typeof modalMod.initAddEntryModal, 'function');
});

console.log(`\n---------------------------------------`);
console.log(`Módulos testados: \x1b[32m${passed} passou\x1b[0m, \x1b[${failed ? '31' : '32'}m${failed} falhou\x1b[0m.`);
console.log(`---------------------------------------\n`);

if (failed > 0) process.exit(1);

console.log('\n--- Testando odômetro de 3 dígitos (public/js/utils/odometer.js) ---');
const { completeOdo, normalizeOdoRows } = await import('../public/js/utils/odometer.js');

test('completeOdo() completa 3 dígitos com a última leitura e trata virada de milhar', () => {
  assert.equal(completeOdo(469, 55459), 55469);
  assert.equal(completeOdo(5, 55990), 56005);
  assert.equal(completeOdo(990, 56005), 55990);
  assert.equal(completeOdo(55469, 55459), 55469);
  assert.equal(completeOdo(469, null), null);
});

test('odômetro de 3 dígitos do WhatsApp preenche o campo e o restante é estimado pelos km', () => {
  const car = '[🚗 UAX-7E23]';
  const rows = [
    { id: 1, ts: '2026-11-03T22:42:00Z', tipo: 'sessao_fim', valor: 55459, obs: car + ' turno' },
    { id: 2, ts: '2026-11-04T08:55:00Z', tipo: 'sessao_ini', valor: 469, obs: car + ' turno (WhatsApp: "469 iniciando")' },
    { id: 3, ts: '2026-11-04T09:15:00Z', tipo: 'ganho', valor: 12.6, km: 5.3, obs: car + ' A → B · odo ?→482' },
    { id: 4, ts: '2026-11-04T09:26:00Z', tipo: 'ganho', valor: 4.3, km: null, obs: car + ' taxa de cancelamento' },
    { id: 5, ts: '2026-11-04T09:36:00Z', tipo: 'ganho', valor: 9.7, km: 4.6, obs: car + ' C → D' },
    { id: 6, ts: '2026-11-04T09:48:00Z', tipo: 'ganho', valor: 12, km: 4.9, obs: car + ' E → F · odo 487→492' }
  ];
  computeAllOdometersAndTimes(rows);
  assert.equal(rows[1].valor, 55469);            // 469 → 55469
  assert.equal(rows[1]._odo, 55469);
  assert.equal(rows[1]._odoEst, false);
  assert.equal(rows[2]._odo, 55482);             // odo ?→482 → 55482
  assert.equal(rows[2]._odoEst, false);
  assert.equal(rows[3]._odoEst, true);
  assert.ok(rows[3]._odo >= 55482 && rows[3]._odo <= 55492);
  assert.equal(rows[3]._odo, 55482);             // cancelamento não anda km
  assert.equal(rows[4]._odoEst, true);            // sem leitura: estimado pela distância
  assert.ok(rows[4]._odo > 55482 && rows[4]._odo <= 55492);
  assert.equal(rows[5]._odo, 55492);
});
