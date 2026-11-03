import { sb, authed, readBody, send } from '../lib/db.js';

export default async function handler(req, res) {
  if (!authed(req)) return send(res, 401, { error: 'token' });
  try {
    if (req.method === 'GET') {
      const r = await sb('config?id=eq.1&select=dados');
      return send(res, 200, r[0]?.dados || {});
    }
    if (req.method === 'POST') {
      const dados = await readBody(req);
      const r = await sb('config?on_conflict=id', {
        method: 'POST', body: { id: 1, dados },
        prefer: 'return=representation,resolution=merge-duplicates'
      });
      return send(res, 200, r[0]?.dados);
    }
    send(res, 405, { error: 'método' });
  } catch (e) { send(res, 500, { error: e.message }); }
}
