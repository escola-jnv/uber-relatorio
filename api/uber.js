// Recebe ganhos lidos do drivers.uber.com pelo script uber-sync.user.js
// Body: { trips: [{ id, ts, valor, km?, obs? }] }
import { sb, insert, authed, readBody, send } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return cors(res).end();
  cors(res);
  if (!authed(req)) return send(res, 401, { error: 'token' });
  if (req.method !== 'POST') return send(res, 405, { error: 'método' });
  try {
    const { trips = [] } = await readBody(req);
    const cfgRes = await sb('config?id=eq.1&select=dados').catch(() => []);
    const cfgDados = cfgRes[0]?.dados || {};
    const activeCar = cfgDados.carros?.find(c => c.id === cfgDados.carro_ativo_id || c.ativo) || cfgDados.carros?.[0];
    const carTag = activeCar ? (activeCar.placa || activeCar.nome) : null;

    const rows = trips
      .filter(t => t && t.id && +t.valor > 0 && t.ts)
      .slice(0, 1000)
      .map(t => {
        let obs = t.obs || null;
        if (carTag && !/\[(?:🚗|carro:)/i.test(obs || '')) {
          obs = `[🚗 ${carTag}]${obs ? ' ' + obs : ''}`;
        }
        return {
          ts: new Date(t.ts).toISOString(), tipo: 'ganho', valor: +(+t.valor).toFixed(2),
          km: t.km ? +t.km : null, obs, origem: 'uber', ext_id: `uber:${t.id}`
        };
      });
    const out = await insert(rows, true);
    send(res, 200, { ok: true, recebidos: trips.length, salvos: out.length });
  } catch (e) { send(res, 500, { error: e.message }); }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-token');
  res.statusCode = 204;
  return res;
}
