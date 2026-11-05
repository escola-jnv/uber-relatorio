import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { parseLine, parseText } from '../lib/parse.js';

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

console.log('\n--- Testando Interpretador de Mensagens (lib/parse.js) ---');

test('Lê corrida comum com horário', () => {
  const r = parseLine('25,50 joão 14:30');
  assert.equal(r.tipo, 'ganho');
  assert.equal(r.valor, 25.5);
  assert.equal(r.passageiro, 'João');
});

test('Lê corrida com km', () => {
  const r = parseLine('18 maria 6km');
  assert.equal(r.tipo, 'ganho');
  assert.equal(r.valor, 18);
  assert.equal(r.km, 6);
  assert.equal(r.passageiro, 'Maria');
});

test('Lê despesa de combustível', () => {
  const r = parseLine('gas 150');
  assert.equal(r.tipo, 'despesa');
  assert.equal(r.valor, 150);
  assert.equal(r.categoria, 'combustivel');
});

test('Lê despesa de aluguel do carro (custo fixo)', () => {
  const r = parseLine('aluguel 560');
  assert.equal(r.tipo, 'despesa');
  assert.equal(r.valor, 560);
  assert.equal(r.categoria, 'aluguel');
});

test('Lê abastecimento com palavra-chave alternativa', () => {
  const r = parseLine('abasteci 180');
  assert.equal(r.tipo, 'despesa');
  assert.equal(r.valor, 180);
  assert.equal(r.categoria, 'combustivel');
});

test('Lê odômetro', () => {
  const r = parseLine('odo 45230');
  assert.equal(r.tipo, 'odometro');
  assert.equal(r.valor, 45230);
});

test('Lê início e fim de sessão', () => {
  const ini = parseLine('inicio 45100');
  const fim = parseLine('fim 45230');
  assert.equal(ini.tipo, 'sessao_ini');
  assert.equal(ini.valor, 45100);
  assert.equal(fim.tipo, 'sessao_fim');
  assert.equal(fim.valor, 45230);
});

test('Lê múltiplas linhas com parseText', () => {
  const lines = '25 joão\ngas 100\nodo 45000';
  const rows = parseText(lines);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].tipo, 'ganho');
  assert.equal(rows[1].tipo, 'despesa');
  assert.equal(rows[2].tipo, 'odometro');
});

console.log('\n--- Testando Servidor Local HTTP (server.js) ---');

const server = createServer();

// Inicia em porta efêmera aleatória (0) para não colidir com portas ocupadas
server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    await asyncTest('Serve página inicial (public/index.html)', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/html/);
      const text = await res.text();
      assert.ok(text.includes('Corridas'));
      assert.ok(text.includes('carActiveBtn'), 'Elemento carActiveBtn deve existir no HTML');
      assert.ok(text.includes('dlgCar'), 'Modal de carros dlgCar deve existir no HTML');
      assert.ok(text.includes('colMenu'), 'Menu de colunas colMenu deve existir no HTML');
      assert.ok(text.includes('dlgEditItem'), 'Modal de edição de lançamento dlgEditItem deve existir no HTML');
      assert.ok(text.includes('dlgStartSessao'), 'Modal de início de sessão dlgStartSessao com meta calculada deve existir no HTML');
      assert.ok(text.includes('edit-btn'), 'Classe edit-btn do ícone lápis deve existir no HTML');
      assert.ok(text.includes('meta_lucro_sessao'), 'Campo de meta de lucro da sessão deve existir no HTML');
      assert.ok(text.includes('carTipo'), 'Campo de tipo de carro (alugado/próprio) deve existir no modal');
      assert.ok(text.includes('startSessaoMetaCalc'), 'Exibição da meta de sessão calculada dinamicamente deve existir no HTML');
      assert.ok(text.includes('editItemOdo'), 'Campo para edição de odômetro deve existir no modal');
    });

    await asyncTest('Serve estilos CSS (public/css/app.css) com colunas customizadas', async () => {
      const res = await fetch(`${baseUrl}/css/app.css`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/css/);
      const css = await res.text();
      assert.ok(css.includes('tag-est'), 'Classe tag-est deve existir no CSS');
      assert.ok(css.includes('col-passageiro'), 'Classe col-passageiro deve existir no CSS');
      assert.ok(css.includes('col-edit'), 'Classe col-edit deve existir no CSS');
      assert.ok(css.includes('col-odo'), 'Classe col-odo deve existir no CSS');
      assert.ok(css.includes('col-tempo'), 'Classe col-tempo deve existir no CSS');
    });

    await asyncTest('Serve script de tabela (public/js/components/table.js) com estimativa de odômetro', async () => {
      const res = await fetch(`${baseUrl}/js/components/table.js`);
      assert.equal(res.status, 200);
      const js = await res.text();
      assert.ok(js.includes('computeAllOdometersAndTimes'), 'Função computeAllOdometersAndTimes deve existir');
    });

    await asyncTest('Serve manifest webmanifest com tipo correto', async () => {
      const res = await fetch(`${baseUrl}/manifest.webmanifest`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /application\/manifest\+json/);
    });

    await asyncTest('Serve ícone SVG', async () => {
      const res = await fetch(`${baseUrl}/icon.svg`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /image\/svg\+xml/);
    });

    await asyncTest('Responde endpoint GET /api/whatsapp', async () => {
      const res = await fetch(`${baseUrl}/api/whatsapp`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
    });

    await asyncTest('Responde OPTIONS /api/uber com CORS habilitado', async () => {
      const res = await fetch(`${baseUrl}/api/uber`, { method: 'OPTIONS' });
      assert.equal(res.status, 204);
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
    });

    await asyncTest('Retorna 404 JSON para rota /api inexistente', async () => {
      const res = await fetch(`${baseUrl}/api/rota_inexistente`);
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.ok(json.error);
    });

    await asyncTest('Retorna 404 para arquivo estático inexistente', async () => {
      const res = await fetch(`${baseUrl}/arquivo-que-nao-existe.xyz`);
      assert.equal(res.status, 404);
    });
  } finally {
    server.close(() => {
      console.log(`\n---------------------------------------`);
      console.log(`Testes concluídos: \x1b[32m${passed} passou\x1b[0m, \x1b[${failed ? '31' : '32'}m${failed} falhou\x1b[0m.`);
      console.log(`---------------------------------------\n`);
      process.exit(failed > 0 ? 1 : 0);
    });
  }
});
