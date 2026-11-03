// Acesso ao Supabase via REST (sem dependências).
const base = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${base()}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key(), Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json',
      Prefer: prefer || 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${t}`);
  return t ? JSON.parse(t) : null;
}

const COLS = ['ts', 'tipo', 'valor', 'km', 'passageiro', 'categoria', 'obs', 'origem', 'ext_id'];
const clean = r => Object.fromEntries(COLS.map(c => [c, r[c] ?? null]));

// merge=true atualiza registros existentes com mesmo ext_id (ex.: gorjeta da Uber chegando depois)
export function insert(rows, merge = false) {
  if (!rows.length) return Promise.resolve([]);
  return sb('lancamentos?on_conflict=ext_id', {
    // no merge, envia só as colunas presentes para não apagar o que foi editado na app (ex.: passageiro)
    method: 'POST', body: merge ? rows.map(r => Object.fromEntries(Object.keys(rows[0]).map(c => [c, r[c] ?? null]))) : rows.map(clean),
    prefer: `return=representation,resolution=${merge ? 'merge' : 'ignore'}-duplicates`
  });
}

export function authed(req) {
  const t = process.env.TOKEN;
  if (!t) return true;
  const q = new URL(req.url, 'http://x').searchParams.get('token');
  return q === t || req.headers['x-token'] === t;
}

export async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? safe(req.body) : req.body;
  let s = ''; for await (const c of req) s += c; return safe(s);
}
const safe = s => { try { return JSON.parse(s); } catch { return {}; } };

export const send = (res, code, data) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
};
