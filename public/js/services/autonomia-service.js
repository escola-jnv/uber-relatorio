import { DEF } from '../utils/constants.js';
import { useStore } from '../state/store.js';
import { getActiveCar, getDynamicCarCosts, getRowCar } from './car-service.js';

/**
 * Calcula a média de km/l do carro, odômetro atual e estimativa de
 * em quanto tempo em média é necessário abastecer novamente durante uma sessão ativa.
 *
 * @param {Object} options Parâmetros opcionais para testes ou injeção de dependência
 * @returns {Object} Informações detalhadas de autonomia e tempo para abastecer
 */
export function calcularAutonomiaSessao(options = {}) {
  const storeData = useStore();
  const rows = options.rows || storeData.rows || [];
  const cfg = options.cfg || storeData.cfg || DEF;
  const metrics = options.metrics || storeData.metrics || {};
  const car = options.car || getActiveCar();

  const sess = metrics.sess || [];
  const sAtual = options.sAtual !== undefined ? options.sAtual : (metrics.ativa ? sess[sess.length - 1] : null);

  // Se não estiver em sessão ativa
  if (!sAtual) {
    return {
      ativa: false,
      mediaKmL: getMediaKmL(car, rows),
      odoAtual: null,
      odoProximoAbastecimento: null,
      kmRestantes: null,
      litrosRestantes: null,
      tempoMinutos: null,
      tempoHoras: null,
      tempoFormatado: '—',
      velocidadeMediaKmh: null,
      mensagem: 'Inicie uma sessão para acompanhar a previsão de abastecimento.'
    };
  }

  const now = options.now ? new Date(options.now) : new Date();

  // 1. Média de km/l do carro (baseada nos dados cadastrados e histórico real)
  const mediaKmL = getMediaKmL(car, rows);

  // 2. Odômetro atual da sessão
  const odoAtual = getOdometroAtual(sAtual, rows);

  // 3. Capacidade do tanque e histórico de abastecimentos
  const capacidadeTanque = car?.tanque_capacidade ? +car.tanque_capacidade : (cfg.tanque_capacidade || 48); // Padrão 48L
  const reservaLitros = Math.max(3, Math.round(capacidadeTanque * 0.1)); // ~10% de reserva (~5L)

  // Localiza o último abastecimento registrado
  const ultimoAbastecimento = getUltimoAbastecimento(rows, car);

  let litrosRestantes;
  let kmDesdeAbastecimento = 0;

  if (ultimoAbastecimento && ultimoAbastecimento.litros > 0) {
    // Calcula km rodados desde o último abastecimento
    if (ultimoAbastecimento.odo && odoAtual && odoAtual >= ultimoAbastecimento.odo) {
      kmDesdeAbastecimento = odoAtual - ultimoAbastecimento.odo;
    } else {
      // Se não tinha odômetro no abastecimento, estima pelos km de corridas desde o abastecimento
      kmDesdeAbastecimento = getKmAposData(rows, ultimoAbastecimento.ts);
    }

    const litrosConsumidos = kmDesdeAbastecimento / mediaKmL;
    // Se abasteceu tanque cheio ou quantia específica
    const litrosIniciais = ultimoAbastecimento.litros;
    litrosRestantes = Math.max(0, litrosIniciais - litrosConsumidos);
  } else {
    // Sem registro de abastecimento recente: estimamos a partir do consumo da sessão
    const kmSessao = sAtual.km || 0;
    const litrosConsumidosSessao = kmSessao / mediaKmL;
    // Assume tanque com nível médio/útil inicial (ex: 60% do tanque) menos o que já rodou na sessão
    const estimativaInicial = capacidadeTanque * 0.65;
    litrosRestantes = Math.max(reservaLitros, estimativaInicial - litrosConsumidosSessao);
  }

  // Litros utilizáveis até entrar na reserva de abastecimento
  const litrosUtilizaveis = Math.max(0, litrosRestantes - reservaLitros);

  // 4. Autonomia restante em km
  const kmRestantes = Math.max(0, Math.round(litrosUtilizaveis * mediaKmL));
  const odoProximoAbastecimento = odoAtual ? odoAtual + kmRestantes : null;

  // 5. Ritmo de trabalho e velocidade média da sessão para calcular o tempo
  const tempoDecorridoMs = Math.max(60000, now.getTime() - new Date(sAtual.ini).getTime() - ((sAtual.pausaMin || 0) * 60000));
  const horasDecorridas = tempoDecorridoMs / 3600000;
  const kmRodadosSessao = sAtual.km || 0;

  // Velocidade média urbana real na sessão ou velocidade urbana padrão (~22 km/h)
  let velocidadeMediaKmh;
  if (horasDecorridas >= 0.25 && kmRodadosSessao >= 2) {
    velocidadeMediaKmh = Math.max(12, Math.min(45, kmRodadosSessao / horasDecorridas));
  } else {
    // Média de velocidade padrão para trânsito de motoristas de aplicativo
    velocidadeMediaKmh = 22;
  }

  // 6. Tempo médio restante até abastecer
  const tempoHoras = kmRestantes > 0 ? (kmRestantes / velocidadeMediaKmh) : 0;
  const tempoMinutos = Math.round(tempoHoras * 60);

  let tempoFormatado;
  if (tempoMinutos <= 0) {
    tempoFormatado = 'Abastecer agora (na reserva)';
  } else if (tempoMinutos < 60) {
    tempoFormatado = `~${tempoMinutos} min`;
  } else {
    const h = Math.floor(tempoMinutos / 60);
    const m = tempoMinutos % 60;
    tempoFormatado = m > 0 ? `~${h}h ${pad(m)}min` : `~${h}h`;
  }

  let statusAlerta = 'normal';
  if (tempoMinutos <= 45 || kmRestantes <= 20) {
    statusAlerta = 'critico';
  } else if (tempoMinutos <= 90 || kmRestantes <= 40) {
    statusAlerta = 'atencao';
  }

  const odoTxt = odoProximoAbastecimento ? ` por volta do odômetro ${odoProximoAbastecimento}` : '';
  const mensagem = kmRestantes > 0
    ? `Em média precisa abastecer em ${tempoFormatado} (restam ~${kmRestantes} km${odoTxt})`
    : 'Nível crítico: abasteça o veículo imediatamente.';

  return {
    ativa: true,
    mediaKmL: Math.round(mediaKmL * 10) / 10,
    odoAtual,
    odoProximoAbastecimento,
    kmRestantes,
    litrosRestantes: Math.round(litrosRestantes * 10) / 10,
    tempoMinutos,
    tempoHoras: Math.round(tempoHoras * 10) / 10,
    tempoFormatado,
    velocidadeMediaKmh: Math.round(velocidadeMediaKmh * 10) / 10,
    statusAlerta,
    kmDesdeAbastecimento: Math.round(kmDesdeAbastecimento),
    mensagem
  };
}

/**
 * Calcula a média de km/l do carro com base no cadastro e histórico
 */
export function getMediaKmL(car, rows = []) {
  if (car && car.consumo_kml && +car.consumo_kml > 0) {
    return +car.consumo_kml;
  }

  // Tenta derivar de preço de combustível e custo por km
  if (car && car.preco_combustivel && car.custo_km && +car.custo_km > 0) {
    const kml = +car.preco_combustivel / +car.custo_km;
    if (kml >= 5 && kml <= 25) return Math.round(kml * 10) / 10;
  }

  // Tenta derivar dos abastecimentos com odômetro nos rows
  const abastecimentosComOdo = rows
    .filter(r => r.tipo === 'despesa' && isCombustivel(r))
    .map(r => ({
      ts: new Date(r.ts).getTime(),
      valor: +r.valor || 0,
      odo: extrairOdo(r)
    }))
    .filter(a => a.odo && a.odo > 1000)
    .sort((a, b) => a.ts - b.ts);

  if (abastecimentosComOdo.length >= 2) {
    const precoLitro = (car && car.preco_combustivel) ? +car.preco_combustivel : 5.79;
    let totKm = 0;
    let totLitros = 0;
    for (let i = 1; i < abastecimentosComOdo.length; i++) {
      const deltaKm = abastecimentosComOdo[i].odo - abastecimentosComOdo[i - 1].odo;
      const litros = abastecimentosComOdo[i].valor / precoLitro;
      if (deltaKm > 30 && deltaKm < 1000 && litros > 5) {
        totKm += deltaKm;
        totLitros += litros;
      }
    }
    if (totLitros > 0) {
      const calcKml = totKm / totLitros;
      if (calcKml >= 6 && calcKml <= 22) {
        return Math.round(calcKml * 10) / 10;
      }
    }
  }

  return 11.5; // Padrão default seguro para carros populares Uber (Onix/HB20/Polo)
}

/**
 * Obtém o odômetro atual estimado ou lançado mais recente
 */
export function getOdometroAtual(sAtual, rows = []) {
  if (!sAtual) return null;

  let maiorOdo = (sAtual.odo0 && sAtual.odo0 > 1000) ? sAtual.odo0 : null;

  for (const r of rows) {
    const v = +r.valor || 0;
    if ((r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim') && v > 1000) {
      if (!maiorOdo || v > maiorOdo) maiorOdo = v;
    }
  }

  // Se a sessão rodou km além do odômetro inicial
  if (sAtual.odo0 && sAtual.km) {
    const odoEstimado = sAtual.odo0 + Math.round(sAtual.km);
    if (!maiorOdo || odoEstimado > maiorOdo) {
      return odoEstimado;
    }
  }

  return maiorOdo;
}

/**
 * Localiza o último lançamento de abastecimento
 */
function getUltimoAbastecimento(rows, car) {
  const precoLitro = (car && car.preco_combustivel) ? +car.preco_combustivel : 5.79;
  const gasRows = rows
    .filter(r => r.tipo === 'despesa' && isCombustivel(r))
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));

  if (!gasRows.length) return null;

  const r = gasRows[0];
  const valor = +r.valor || 0;
  const odo = extrairOdo(r);
  const litros = valor > 0 ? (valor / precoLitro) : 0;

  return {
    ts: new Date(r.ts),
    valor,
    litros,
    odo
  };
}

function isCombustivel(r) {
  const cat = (r.categoria || '').toLowerCase();
  const obs = (r.obs || '').toLowerCase();
  return cat === 'combustivel' || /gas|gasolina|etanol|alcool|abastec|posto|combustivel/i.test(obs);
}

function extrairOdo(r) {
  if (r.obs) {
    const m = r.obs.match(/odo\s*[:=]?\s*(\d{4,6})/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function getKmAposData(rows, date) {
  let km = 0;
  const ts = new Date(date).getTime();
  for (const r of rows) {
    if (new Date(r.ts).getTime() >= ts && r.tipo === 'ganho' && r.km) {
      km += +r.km;
    }
  }
  return km;
}

function pad(n) {
  return String(n).padStart(2, '0');
}
