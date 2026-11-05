// Odômetro no navegador. As anotações do WhatsApp trazem só os 3 últimos dígitos (ex.: 469 → 55469):
// completamos com a última leitura completa do mesmo carro. Sem leitura nenhuma, o table.js estima pela distância (km).
export const ODO_TIPOS = ['odometro', 'sessao_ini', 'sessao_fim'];

export function completeOdo(partial, ref) {
  const p = Math.round(+partial);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 1000) return p;
  if (!ref || ref < 1000) return null;
  const c = Math.floor(ref / 1000) * 1000 + p;
  if (c < ref - 500) return c + 1000;
  if (c > ref + 500) return c - 1000;
  return c;
}

const CAR = /\[(?:🚗|carro:)\s*([^\]]+)\]/i;
const carOf = r => (r.carro || (r.obs && (r.obs.match(CAR) || [])[1]) || '').trim() || 'geral';

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

// Define r._odoFull (leitura completa) em cada linha com leitura; completa valor das linhas de odômetro/turno de 3 dígitos.
export function normalizeOdoRows(rows) {
  const asc = [...rows].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const byCar = {};
  for (const r of asc) (byCar[carOf(r)] = byCar[carOf(r)] || []).push(r);
  for (const list of Object.values(byCar)) {
    const firstFull = list.map(rawOdo).find(v => v && v >= 1000) || null;
    let ref = firstFull;
    for (const r of list) {
      const raw = rawOdo(r);
      if (raw === null) { r._odoFull = null; continue; }
      const full = completeOdo(raw, ref);
      r._odoFull = full;
      if (full) {
        ref = full;
        if (ODO_TIPOS.includes(r.tipo) && +r.valor !== full) { r._odoLido = +r.valor; r.valor = full; }
      }
    }
  }
  return rows;
}
