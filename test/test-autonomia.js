import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock de storage para importação de store no Node.js
for (const k of ['localStorage', 'sessionStorage']) {
  if (typeof globalThis[k] === 'undefined') {
    const s = {};
    globalThis[k] = new Proxy({ getItem: x => s[x] ?? null, setItem: (x, v) => { s[x] = String(v); } }, {
      get: (t, p) => (p in t ? t[p] : s[p]), set: (t, p, v) => { s[p] = String(v); return true; }
    });
  }
}

// Mock básico de documento para componentes se necessário
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    hidden: false,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

const { calcularAutonomiaSessao, getMediaKmL, getOdometroAtual } = await import('../public/js/services/autonomia-service.js');
const { QUICK_EVENTS, formatarTempoTimer, carregarTimestampsEventos } = await import('../public/js/components/quick-events.js');
const { renderParcialReport } = await import('../public/js/components/parcial-report.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  \x1b[32m✔\x1b[0m', name); };

console.log('\n--- Testando Serviço de Autonomia e Previsão de Abastecimento ---');

t('Retorna status inativo quando não há sessão ativa', () => {
  const res = calcularAutonomiaSessao({ sAtual: null });
  assert.equal(res.ativa, false);
  assert.equal(res.kmRestantes, null);
  assert.equal(res.tempoMinutos, null);
  assert.ok(res.mensagem.includes('Inicie uma sessão'));
});

t('Calcula média de km/l a partir da configuração do carro', () => {
  const car = { consumo_kml: 12.4 };
  const kml = getMediaKmL(car);
  assert.equal(kml, 12.4);
});

t('Calcula média de km/l derivada de preço do combustível e custo por km', () => {
  const car = { preco_combustivel: 5.79, custo_km: 0.50 };
  const kml = getMediaKmL(car);
  assert.equal(kml, 11.6);
});

t('Identifica odômetro atual estimado a partir da sessão e km rodados', () => {
  const sAtual = { odo0: 45200, km: 35.5 };
  const odo = getOdometroAtual(sAtual, []);
  assert.equal(odo, 45236);
});

t('Calcula autonomia e tempo médio para abastecer durante sessão ativa', () => {
  const sAtual = {
    ativa: true,
    ini: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 horas de trabalho
    odo0: 45000,
    km: 50, // rodou 50 km em 2 horas = 25 km/h
    pausaMin: 0
  };

  const car = {
    consumo_kml: 10.0,
    tanque_capacidade: 50,
    preco_combustivel: 5.80
  };

  const rows = [
    { tipo: 'sessao_ini', ts: sAtual.ini, valor: 45000 },
    // Abasteceu R$ 116 (20 litros a R$ 5,80) no início da sessão com odo 45000
    { tipo: 'despesa', categoria: 'combustivel', ts: sAtual.ini, valor: 116, obs: 'gas odo: 45000' }
  ];

  const res = calcularAutonomiaSessao({ sAtual, car, rows });

  assert.equal(res.ativa, true);
  assert.equal(res.mediaKmL, 10.0);
  assert.equal(res.odoAtual, 45050);

  // 20 litros abastecidos - 5 litros consumidos (50km / 10km/l) = 15 litros restantes
  // Reserva de 10% (5 litros) -> 10 litros utilizáveis
  // Autonomia: 10L * 10 km/l = 100 km
  assert.equal(res.kmRestantes, 100);
  assert.equal(res.odoProximoAbastecimento, 45150);

  // Ritmo: 50 km em 2h = 25 km/h
  // Tempo para 100 km = 100 / 25 = 4 horas (240 min)
  assert.equal(res.velocidadeMediaKmh, 25);
  assert.equal(res.tempoHoras, 4);
  assert.equal(res.tempoMinutos, 240);
  assert.ok(res.tempoFormatado.includes('4h'));
  assert.ok(res.mensagem.includes('4h'));
});

t('Alerta status crítico quando autonomia de combustível está baixa', () => {
  const sAtual = {
    ativa: true,
    ini: new Date(Date.now() - 3 * 3600000).toISOString(),
    odo0: 45000,
    km: 140,
    pausaMin: 0
  };

  const car = { consumo_kml: 10, tanque_capacidade: 45, preco_combustivel: 5.0 };
  const rows = [
    // Abasteceu apenas R$ 75 (15L) e já rodou 140 km (gastou 14L)
    { tipo: 'despesa', categoria: 'combustivel', ts: sAtual.ini, valor: 75, obs: 'gas odo: 45000' }
  ];

  const res = calcularAutonomiaSessao({ sAtual, car, rows });
  assert.equal(res.statusAlerta, 'critico');
});

console.log('\n--- Testando Ícones Redondos com Timers (public/js/components/quick-events.js) ---');

t('QUICK_EVENTS define os 5 eventos solicitados (pausa, água, banheiro, comida, descanso)', () => {
  assert.ok(Array.isArray(QUICK_EVENTS));
  assert.equal(QUICK_EVENTS.length, 5);
  const ids = QUICK_EVENTS.map(e => e.id);
  assert.ok(ids.includes('pausa'));
  assert.ok(ids.includes('agua'));
  assert.ok(ids.includes('banheiro'));
  assert.ok(ids.includes('comida'));
  assert.ok(ids.includes('descanso'));
});

t('formatarTempoTimer formata minutos e horas corretamente para os timers', () => {
  assert.equal(formatarTempoTimer(0), '0m');
  assert.equal(formatarTempoTimer(5 * 60000), '5m');
  assert.equal(formatarTempoTimer(65 * 60000), '1h 5m');
  assert.equal(formatarTempoTimer(120 * 60000), '2h');
});

t('carregarTimestampsEventos inicializa e restaura timers', () => {
  carregarTimestampsEventos([]);
  for (const ev of QUICK_EVENTS) {
    const val = localStorage.getItem(`uber_event_timer_${ev.id}`);
    assert.ok(val, `Deveria ter timestamp salvo para ${ev.id}`);
    assert.ok(!isNaN(parseInt(val, 10)));
  }
});

console.log('\n--- Testando Integração com o DOM e CSS ---');

t('public/index.html contém containers de eventos rápidos e relatório parcial', () => {
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf-8');
  assert.ok(html.includes('id="quickEventsBar"'), 'Deve conter container #quickEventsBar');
  assert.ok(html.includes('id="parcialReportBox"'), 'Deve conter container #parcialReportBox');
  assert.ok(html.includes('id="sAutonomiaInfo"'), 'Deve conter container #sAutonomiaInfo no card de sessão');
});

t('public/css/app.css contém estilos dos botões circulares e da barra de progresso parcial', () => {
  const css = fs.readFileSync(path.resolve('public/css/app.css'), 'utf-8');
  assert.ok(css.includes('.quick-circle-btn'), 'Deve conter classe .quick-circle-btn');
  assert.ok(css.includes('.quick-circle-svg'), 'Deve conter classe .quick-circle-svg');
  assert.ok(css.includes('.circle-progress'), 'Deve conter classe .circle-progress');
  assert.ok(css.includes('.parcial-bar-track'), 'Deve conter classe .parcial-bar-track');
  assert.ok(css.includes('.parcial-bar-fill'), 'Deve conter classe .parcial-bar-fill');
  assert.ok(css.includes('.marker-break'), 'Deve conter marcador de break-even .marker-break');
  assert.ok(css.includes('.marker-lucro'), 'Deve conter marcador de lucro .marker-lucro');
  assert.ok(css.includes('.marker-caixas'), 'Deve conter marcador de meta de caixas .marker-caixas');
});

console.log(`\n---------------------------------------`);
console.log(`Testes concluídos com sucesso: ${n} passou, 0 falhou.`);
console.log(`---------------------------------------\n`);
