// Webhook do WhatsApp. Aceita payloads da Evolution API, Z-API, WAHA ou genérico {text,id}.
// Só aceita mensagens do grupo configurado:
//   WA_GROUP_NAME (padrão "Uber")  — usado quando o provedor envia o nome do grupo (Z-API)
//   WA_GROUP_ID   (ex.: 1203...@g.us) — usado quando só vem o id do grupo (Evolution/WAHA)
import { insert, authed, readBody, send } from '../lib/db.js';
import { parseText } from '../lib/parse.js';

function extract(b) {
  // Evolution API v2
  if (b?.data?.key) {
    const d = b.data, m = d.message || {};
    return {
      id: d.key.id, chatId: d.key.remoteJid, chatName: null,
      text: m.conversation || m.extendedTextMessage?.text || '',
      ts: d.messageTimestamp ? +d.messageTimestamp * 1000 : null
    };
  }
  // Z-API
  if (b?.text?.message !== undefined || b?.isGroup !== undefined) {
    return {
      id: b.messageId, chatId: b.phone, chatName: b.chatName || null,
      text: b.text?.message || '', ts: b.momment || null, isGroup: b.isGroup
    };
  }
  // WAHA
  if (b?.payload?.body !== undefined) {
    const p = b.payload;
    return { id: p.id?._serialized || p.id, chatId: p.from, chatName: null, text: p.body, ts: p.timestamp ? p.timestamp * 1000 : null };
  }
  // genérico (ex.: atalho do iPhone / Tasker / teste manual)
  return { id: b?.id || null, chatId: b?.chatId || null, chatName: b?.chatName || null, text: b?.text || b?.message || '', ts: null, generic: true };
}

export default async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { ok: true, info: 'POST aqui as mensagens do grupo' });
  if (!authed(req)) return send(res, 401, { error: 'token' });
  try {
    const b = await readBody(req);
    const m = extract(b);
    if (!m.text) return send(res, 200, { ignored: 'sem texto' });

    const gid = process.env.WA_GROUP_ID, gname = (process.env.WA_GROUP_NAME || 'Uber').toLowerCase();
    if (!m.generic) {
      const isGroup = m.isGroup ?? String(m.chatId || '').endsWith('@g.us');
      if (!isGroup) return send(res, 200, { ignored: 'não é grupo', chatId: m.chatId });
      if (gid && m.chatId !== gid) return send(res, 200, { ignored: 'outro grupo', chatId: m.chatId });
      if (!gid && m.chatName && m.chatName.toLowerCase() !== gname) return send(res, 200, { ignored: 'outro grupo', chatName: m.chatName });
    }

    const cfgRes = await sb('config?id=eq.1&select=dados').catch(() => []);
    const cfgDados = cfgRes[0]?.dados || {};
    const activeCar = cfgDados.carros?.find(c => c.id === cfgDados.carro_ativo_id || c.ativo) || cfgDados.carros?.[0];
    const carTag = activeCar ? (activeCar.placa || activeCar.nome) : null;

    const now = m.ts ? new Date(m.ts) : new Date();
    const rows = parseText(m.text, now).map((r, i) => {
      let obs = r.obs || null;
      if (carTag && !/\[(?:🚗|carro:)/i.test(obs || '')) {
        obs = `[🚗 ${carTag}]${obs ? ' ' + obs : ''}`;
      }
      return { ...r, obs, origem: 'whatsapp', ext_id: m.id ? `wa:${m.id}:${i}` : null };
    });
    if (!rows.length) return send(res, 200, { ignored: 'não entendi', text: m.text });
    const out = await insert(rows);
    send(res, 200, { ok: true, salvos: out.length, rows: out, chatId: m.chatId });
  } catch (e) { send(res, 500, { error: e.message }); }
}
