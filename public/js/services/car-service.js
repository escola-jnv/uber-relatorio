import { DEF } from '../utils/constants.js';
import { store, useStore } from '../state/store.js';
import { saveConfigApi } from '../api/client.js';

export function getCarros() {
  const { cfg } = useStore();
  if (!Array.isArray(cfg.carros) || !cfg.carros.length) {
    return DEF.carros;
  }
  return cfg.carros;
}

export function getActiveCar() {
  const list = getCarros();
  const { cfg } = useStore();
  return list.find(c => c.id === cfg.carro_ativo_id || c.ativo) || list[0];
}

export function findCar(identifier) {
  if (!identifier) return null;
  const list = getCarros();
  const clean = String(identifier).toLowerCase().replace(/[^a-z0-9]/g, '');
  const { cfg } = useStore();
  return list.find(c => {
    const p = String(c.placa || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const n = String(c.nome || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return p === clean || n.includes(clean) || clean.includes(p);
  }) || {
    nome: identifier,
    placa: identifier,
    custo_km: cfg.custo_km || DEF.custo_km
  };
}

export function getRowCar(r) {
  if (r.carro) return r.carro;
  if (r.obs) {
    const m = r.obs.match(/\[(?:🚗|carro:)\s*([^\]]+)\]/i);
    if (m) return m[1].trim();
  }
  return null;
}

export function getRowObs(r) {
  if (!r.obs) return '';
  return r.obs.replace(/\[(?:🚗|carro:)\s*[^\]]+\]\s*/gi, '').trim();
}

// Cálculo Dinâmico de Custo do Carro (Fixo = Aluguel + Variável = Combustível)
export function getDynamicCarCosts(car = null) {
  const { rows, cfg, metrics } = useStore();
  const active = car || getActiveCar();
  const carTag = active ? (active.placa || active.nome) : null;

  // 1. Custo Fixo: Aluguel
  const isAlugado = active ? (active.tipo !== 'proprio') : true;
  let aluguelDia = 0;
  if (isAlugado) {
    if (active && active.aluguel_dia !== undefined && active.aluguel_dia !== '') {
      aluguelDia = +active.aluguel_dia;
    } else if (active && active.aluguel_valor) {
      const per = active.aluguel_periodo || 'semana';
      const val = +active.aluguel_valor || 0;
      aluguelDia = per === 'semana' ? (val / 7) : per === 'mes' ? (val / 30) : val;
    } else if (cfg.aluguel_dia !== undefined) {
      aluguelDia = +cfg.aluguel_dia;
    } else {
      aluguelDia = DEF.aluguel_dia;
    }
  }

  // 2. Custo Variável: Combustível (Calculado dinamicamente das despesas e telemetria)
  const now = Date.now();
  const windowMs = 30 * 864e5; // últimos 30 dias
  let fuelSpent = 0;
  let kmTracked = 0;

  for (const r of rows) {
    const t = new Date(r.ts).getTime();
    if (now - t > windowMs) continue;

    const rowCar = getRowCar(r);
    const matchesCar = !carTag || !rowCar ||
      rowCar.toLowerCase().includes(carTag.toLowerCase()) ||
      (active && active.placa && rowCar.includes(active.placa));

    if (matchesCar) {
      if (r.tipo === 'despesa') {
        const cat = (r.categoria || '').toLowerCase();
        const obs = (r.obs || '').toLowerCase();
        if (cat === 'combustivel' || /gas|gasolina|etanol|alcool|abastec|gnv/i.test(obs)) {
          fuelSpent += (+r.valor || 0);
        }
      } else if (r.tipo === 'ganho' && r.km) {
        kmTracked += (+r.km || 0);
      }
    }
  }

  // Odômetros no mesmo período
  if (metrics && metrics.days) {
    let odoKm = 0;
    for (const [k, d] of Object.entries(metrics.days)) {
      const t = new Date(k + 'T12:00').getTime();
      if (now - t <= windowMs && d.km) odoKm += d.km;
    }
    if (odoKm > kmTracked) kmTracked = odoKm;
  }

  let custoKmCombustivel = 0;
  let isDynamicFuel = false;
  if (fuelSpent > 0 && kmTracked >= 20) {
    const ratio = fuelSpent / kmTracked;
    if (ratio >= 0.15 && ratio <= 2.50) {
      custoKmCombustivel = Math.round(ratio * 100) / 100;
      isDynamicFuel = true;
    }
  }

  if (!custoKmCombustivel) {
    if (active && active.preco_combustivel && active.consumo_kml) {
      custoKmCombustivel = Math.round((+active.preco_combustivel / +active.consumo_kml) * 100) / 100;
    } else if (active && active.custo_km) {
      custoKmCombustivel = +active.custo_km;
    } else {
      custoKmCombustivel = +(cfg.custo_km || DEF.custo_km);
    }
  }

  const kmDiaEstimado = 150;
  const custoFixoPorKm = aluguelDia > 0 ? (aluguelDia / kmDiaEstimado) : 0;
  const custoKmTotal = Math.round((custoKmCombustivel + custoFixoPorKm) * 100) / 100;

  return {
    isAlugado,
    aluguelDia: Math.round(aluguelDia * 100) / 100,
    custoKmCombustivel,
    custoKmTotal,
    custoFixoPorKm: Math.round(custoFixoPorKm * 100) / 100,
    isDynamicFuel,
    fuelSpent,
    kmTracked
  };
}

// Salva a configuração atual tanto no store/localStorage quanto no backend
export async function persistConfig(updatedCfg = null) {
  if (updatedCfg) {
    store.setConfig(updatedCfg);
  }
  const { cfg } = useStore();
  try {
    const res = await saveConfigApi(cfg);
    const merged = { ...DEF, ...res };
    if (!merged.carros || !merged.carros.length) merged.carros = DEF.carros;
    store.setConfig(merged);
  } catch (err) {
    console.error('Falha ao sincronizar configuração remota:', err);
  }
}

export async function setActiveCar(id) {
  const list = getCarros().map(c => ({
    ...c,
    ativo: c.id === id
  }));
  const active = list.find(c => c.id === id);
  const updates = {
    carros: list,
    carro_ativo_id: id,
    ...(active && active.custo_km ? { custo_km: +active.custo_km } : {})
  };
  await persistConfig(updates);
  return active;
}

export async function removeCar(id) {
  let list = getCarros();
  if (list.length <= 1) {
    throw new Error('Você precisa manter pelo menos um carro cadastrado.');
  }
  const target = list.find(c => c.id === id);
  const { cfg } = useStore();
  const wasActive = target?.ativo || cfg.carro_ativo_id === id;
  list = list.filter(c => c.id !== id);
  const updates = { carros: list };
  if (wasActive && list.length) {
    list[0].ativo = true;
    updates.carro_ativo_id = list[0].id;
    if (list[0].custo_km) updates.custo_km = +list[0].custo_km;
  }
  await persistConfig(updates);
}
