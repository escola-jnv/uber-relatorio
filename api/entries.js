import { sb, insert, authed, readBody, send } from '../lib/db.js';
import { parseText } from '../lib/parse.js';
import { fixOdoRows } from '../lib/odo.js';

// GET ?days=60 | POST {text} ou {row} | PATCH ?id= {campos} | DELETE ?id=
export default async function handler(req, res) {
  if (!authed(req)) return send(res, 401, { error: 'token' });
  const q = new URL(req.url, 'http://x').searchParams;
  try {
    if (req.method === 'GET') {
      const days = Math.min(+q.get('days') || 60, 730);
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const rows = await sb(`lancamentos?select=id,ts,tipo,valor,km,passageiro,categoria,obs,origem,carro_id&ts=gte.${since}&order=ts.desc&limit=5000`);
      return send(res, 200, rows);
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      const rows = b.text ? parseText(b.text) : b.row ? [b.row] : [];
      if (!rows.length) return send(res, 400, { error: 'Não entendi. Ex.: "25,50 joão 14:30", "odo 45230", "gas 150"' });
      const carTag = b.carro || (b.row && b.row.carro);
      const mapped = rows.map(r => {
        const itemCar = r.carro || carTag;
        let obs = r.obs || null;
        if (itemCar) {
          const clean = (obs || '').replace(/\[(?:🚗|carro:)\s*[^\]]+\]\s*/gi, '').trim();
          obs = `[🚗 ${itemCar}]${clean ? ' ' + clean : ''}`;
        }
        return { ...r, obs, origem: r.origem || 'manual' };
      });
      await fixOdoRows(mapped, sb, carTag); // odômetro de 3 dígitos → leitura completa
      const out = await insert(mapped);
      return send(res, 200, out);
    }
    if (req.method === 'PATCH' && q.get('id')) {
      const b = await readBody(req);
      delete b.id;
      if (b.carro !== undefined) {
        let obs = b.obs !== undefined ? b.obs : null;
        if (obs === null) {
          const curr = await sb(`lancamentos?id=eq.${+q.get('id')}&select=obs`);
          obs = curr[0]?.obs || '';
        }
        const clean = (obs || '').replace(/\[(?:🚗|carro:)\s*[^\]]+\]\s*/gi, '').trim();
        b.obs = b.carro ? `[🚗 ${b.carro}]${clean ? ' ' + clean : ''}` : (clean || null);
        delete b.carro;
      }
      return send(res, 200, await sb(`lancamentos?id=eq.${+q.get('id')}`, { method: 'PATCH', body: b }));
    }
    if (req.method === 'DELETE' && q.get('id')) {
      await sb(`lancamentos?id=eq.${+q.get('id')}`, { method: 'DELETE', prefer: 'return=minimal' });
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: 'método' });
  } catch (e) { send(res, 500, { error: e.message }); }
}
