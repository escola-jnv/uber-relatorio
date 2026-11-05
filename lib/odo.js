// Odômetro: no grupo do WhatsApp o motorista manda só os 3 últimos dígitos (ex.: "469" = 55469).
// completeOdo() recompõe a leitura completa a partir da última leitura completa do mesmo carro.
export const ODO_TIPOS = ['odometro', 'sessao_ini', 'sessao_fim'];

export function completeOdo(partial, ref) {
  const p = Math.round(+partial);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 1000) return p;                 // já é a leitura completa
  if (!ref || ref < 1000) return null;     // sem referência não dá para completar
  const c = Math.floor(ref / 1000) * 1000 + p;
  if (c < ref - 500) return c + 1000;      // virou o milhar (ref 55990, lido 005 → 56005)
  if (c > ref + 500) return c - 1000;      // leitura atrasada (ref 56005, lido 990 → 55990)
  return c;
}

const CAR = /\[(?:🚗|carro:)\s*([^\]]+)\]/i;
export const carOf = r => (r.carro || (r.obs && (r.obs.match(CAR) || [])[1]) || '').trim() || null;

// leitura bruta de uma linha (pode estar com 3 dígitos): valor das linhas de odômetro/turno ou "odo A→B" / "odo N" no obs
export function rawOdo(r) {
  if (ODO_TIPOS.includes(r.tipo) && +r.valor > 0) return +r.valor;
  if (r.obs) {
    const a = r.obs.match(/odo\s+(?:\?|\d+)\s*→\s*(\d+)/i);
    if (a && +a[1] > 0) return +a[1];
    const s = r.obs.match(/odo\s+(\d{3,7})/i);
    if (s && +s[1] > 0) return +s[1];
  }
  return null;
}

// última leitura completa gravada no banco (opcionalmente só do carro informado)
export async function lastFullOdo(sb, carTag) {
  const rows = await sb('lancamentos?select=tipo,valor,obs&order=ts.desc&limit=60&or=(tipo.eq.odometro,tipo.eq.sessao_ini,tipo.eq.sessao_fim,obs.ilike.*odo *)').catch(() => []);
  for (const r of rows) {
    if (carTag && carOf(r) && carOf(r) !== carTag) continue;
    const v = rawOdo(r);
    if (v && v >= 1000) return v;
  }
  return null;
}

// completa os odômetros de 3 dígitos das linhas que vão ser gravadas
export async function fixOdoRows(rows, sb, carTag) {
  let ref = null, loaded = false;
  for (const r of rows) {
    if (!ODO_TIPOS.includes(r.tipo) || !(+r.valor > 0) || +r.valor >= 1000) continue;
    if (!loaded) { ref = await lastFullOdo(sb, r.carro || carTag || carOf(r)); loaded = true; }
    const full = completeOdo(r.valor, ref);
    const lido = Math.round(+r.valor);
    if (full) { r.valor = full; r.obs = `${r.obs ? r.obs + ' · ' : ''}odo lido ${lido}`.trim(); ref = full; }
    else { r.valor = null; r.obs = `${r.obs ? r.obs + ' · ' : ''}odo ${lido} (3 dígitos, sem referência)`.trim(); }
  }
  return rows;
}
