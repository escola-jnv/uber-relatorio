// Definições padrão da aplicação (metas de lucro e custos padrão)
export const DEF = {
  meta_lucro_sessao: 150,     // Meta de lucro líquido desejado por sessão (default R$ 150)
  meta_lucro_dia: 200,        // Meta de lucro líquido desejado por dia (default R$ 200)
  meta_sessao: 220,           // Meta bruta da sessão (lucro + custos estimados)
  meta_dia: 300,              // Meta bruta diária
  meta_semana: 1800,          // Meta semanal bruta
  horas_dia: 8,
  dias_semana: 6,
  aluguel_dia: 60,            // Custo fixo diário padrão (aluguel de carro)
  custo_km: 0.45,             // Custo variável por km padrão (combustível)
  carros: [
    {
      id: 'c1',
      nome: 'Carro Principal',
      placa: 'PAD-1234',
      tipo: 'alugado',
      aluguel_valor: 560,
      aluguel_periodo: 'semana',
      aluguel_dia: 80,
      consumo_kml: 11.5,
      preco_combustivel: 5.79,
      custo_km: 0.50,
      ativo: true
    }
  ],
  carro_ativo_id: 'c1'
};

// Abreviações dos dias da semana
export const DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Lista completa de colunas suportadas na tabela
// 0: Data/Hora, 1: Ícone, 2: Carro, 3: Odômetro, 4: Tempo rodado (HH:MM), 5: Nome passageiro, 6: Editar (ícone lápis)
export const ALL_COLUMNS = [
  { id: 'col-h', label: 'Data/Hora', def: true },
  { id: 'col-ic', label: 'Ícone', def: true },
  { id: 'col-carro', label: 'Carro', def: true },
  { id: 'col-odo', label: 'Odômetro', def: true },
  { id: 'col-tempo', label: 'Tempo rodado', def: true },
  { id: 'col-passageiro', label: 'Nome passageiro', def: true },
  { id: 'col-edit', label: 'Editar', def: true },
  { id: 'col-v', label: 'Valor Bruto', def: false },
  { id: 'col-lucro', label: 'Lucro Estimado', def: false },
  { id: 'col-km-tot', label: 'Km rodado (vazio+pass.)', def: false },
  { id: 'col-cat', label: 'Categoria', def: false },
  { id: 'col-obs', label: 'Observações', def: false },
  { id: 'col-r-hora', label: 'R$/hora', def: false },
  { id: 'col-subtot', label: 'Subtotal Dia', def: false },
  { id: 'col-x', label: 'Ações', def: false }
];

export const CAT_ICONS = {
  combustivel: '⛽',
  alimentacao: '🍔',
  manutencao: '🔧',
  lavagem: '🧼',
  aluguel: '🚗',
  pedagio: '🛣️',
  estacionamento: '🅿️',
  seguro: '🛡️',
  outros: '💸'
};

export const CAT_LABELS = {
  combustivel: 'Combustível',
  alimentacao: 'Alimentação',
  manutencao: 'Manutenção',
  lavagem: 'Lavagem',
  aluguel: 'Aluguel',
  pedagio: 'Pedágio',
  estacionamento: 'Estacionamento',
  seguro: 'Seguro',
  outros: 'Outros'
};
