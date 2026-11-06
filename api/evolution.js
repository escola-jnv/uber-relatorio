import { authed, readBody, send } from '../lib/db.js';

let localWhatsappModule = null;
async function getLocalWhatsapp() {
  if (!localWhatsappModule) {
    localWhatsappModule = await import('../lib/whatsapp-client.js');
  }
  return localWhatsappModule;
}

function getEvolutionConfig(req, body = {}) {
  const urlObj = new URL(req.url, 'http://localhost');
  const q = urlObj.searchParams;

  const mode = (
    body.mode ||
    q.get('mode') ||
    process.env.EVOLUTION_MODE ||
    'local'
  ).toLowerCase();

  const apiUrl = (
    body.apiUrl ||
    q.get('apiUrl') ||
    process.env.EVOLUTION_API_URL ||
    'http://localhost:8080'
  ).replace(/\/+$/, '');

  const apiKey = (
    body.apiKey ||
    q.get('apiKey') ||
    req.headers['x-evolution-key'] ||
    process.env.EVOLUTION_API_KEY ||
    ''
  ).trim();

  const instance = (
    body.instance ||
    q.get('instance') ||
    process.env.EVOLUTION_INSTANCE_NAME ||
    'uber'
  ).trim();

  return { mode, apiUrl, apiKey, instance };
}

function normalizeBase64(b64) {
  if (!b64 || typeof b64 !== 'string') return null;
  if (b64.startsWith('data:image/')) return b64;
  return `data:image/png;base64,${b64}`;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-token, x-evolution-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (!authed(req)) {
    return send(res, 401, { error: 'token inválido' });
  }

  const urlObj = new URL(req.url, 'http://localhost');
  const action = urlObj.searchParams.get('action') || 'status';
  const body = req.method === 'POST' ? await readBody(req) : {};
  const { mode, apiUrl, apiKey, instance } = getEvolutionConfig(req, body);

  const evoHeaders = {
    'apikey': apiKey,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Obter configurações atuais
    if (action === 'config') {
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['host'] || 'localhost:3000';
      const tokenParam = process.env.TOKEN ? `?token=${encodeURIComponent(process.env.TOKEN)}` : '';
      const defaultWebhook = `${proto}://${host}/api/whatsapp${tokenParam}`;

      return send(res, 200, {
        ok: true,
        mode,
        apiUrl,
        instance,
        hasKey: Boolean(apiKey),
        keyMasked: apiKey ? (apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '****') : '',
        defaultWebhook,
        groupName: process.env.WA_GROUP_NAME || 'Uber',
        groupId: process.env.WA_GROUP_ID || ''
      });
    }

    // -------------------------------------------------------------
    // MODO LOCAL NATIVO (Sem Docker / Baileys Embutido)
    // -------------------------------------------------------------
    if (mode === 'local') {
      const localClient = await getLocalWhatsapp();

      if (action === 'status') {
        const st = await localClient.getLocalWhatsAppStatus();
        return send(res, 200, st);
      }

      if (action === 'connect') {
        const conn = await localClient.initLocalWhatsApp();
        return send(res, 200, conn);
      }

      if (action === 'disconnect') {
        const disc = await localClient.disconnectLocalWhatsApp();
        return send(res, 200, disc);
      }

      if (action === 'webhook') {
        return send(res, 200, {
          ok: true,
          message: 'No modo local, as mensagens recebidas são encaminhadas diretamente para /api/whatsapp automaticamente!'
        });
      }
    }

    // -------------------------------------------------------------
    // MODO EVOLUTION API EXTERNA (Docker / VPS / Servidor Remoto)
    // -------------------------------------------------------------
    if (!apiUrl) {
      return send(res, 400, { error: 'EVOLUTION_API_URL não configurada' });
    }

    // Checar status
    if (action === 'status') {
      try {
        const stateRes = await fetch(`${apiUrl}/instance/connectionState/${encodeURIComponent(instance)}`, {
          method: 'GET',
          headers: evoHeaders
        });

        if (stateRes.status === 404) {
          return send(res, 200, {
            ok: true,
            exists: false,
            state: 'not_created',
            message: `Instância '${instance}' ainda não foi criada na Evolution API.`
          });
        }

        const data = await stateRes.json().catch(() => ({}));
        const rawState = data.instance?.state || data.state || 'unknown';
        const isConnected = rawState === 'open';

        return send(res, 200, {
          ok: true,
          exists: true,
          state: rawState,
          connected: isConnected,
          raw: data
        });
      } catch (err) {
        return send(res, 502, {
          ok: false,
          error: `Não foi possível conectar ao servidor Evolution em ${apiUrl}: ${err.message}`
        });
      }
    }

    // Obter QR Code
    if (action === 'connect') {
      try {
        let connectRes = await fetch(`${apiUrl}/instance/connect/${encodeURIComponent(instance)}`, {
          method: 'GET',
          headers: evoHeaders
        });

        if (connectRes.status === 404) {
          const createRes = await fetch(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: evoHeaders,
            body: JSON.stringify({
              instanceName: instance,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS'
            })
          });

          if (!createRes.ok) {
            const errBody = await createRes.text().catch(() => '');
            return send(res, 502, {
              error: `Falha ao criar instância '${instance}': HTTP ${createRes.status} ${errBody}`
            });
          }

          await new Promise(r => setTimeout(r, 1000));

          connectRes = await fetch(`${apiUrl}/instance/connect/${encodeURIComponent(instance)}`, {
            method: 'GET',
            headers: evoHeaders
          });
        }

        const data = await connectRes.json().catch(() => ({}));
        const b64 = normalizeBase64(data.base64 || data.qrcode?.base64);
        const code = data.code || data.qrcode?.code || null;
        const pairingCode = data.pairingCode || null;
        const state = data.instance?.state || data.state || (b64 ? 'connecting' : 'unknown');

        return send(res, 200, {
          ok: true,
          state,
          connected: state === 'open',
          base64: b64,
          code,
          pairingCode,
          count: data.count || 1
        });
      } catch (err) {
        return send(res, 502, {
          ok: false,
          error: `Erro ao solicitar QR Code da Evolution (${apiUrl}): ${err.message}`
        });
      }
    }

    // Configurar Webhook
    if (action === 'webhook') {
      const webhookUrl = body.webhookUrl || urlObj.searchParams.get('webhookUrl');
      if (!webhookUrl) {
        return send(res, 400, { error: 'webhookUrl é obrigatório' });
      }

      try {
        const setRes = await fetch(`${apiUrl}/webhook/set/${encodeURIComponent(instance)}`, {
          method: 'POST',
          headers: evoHeaders,
          body: JSON.stringify({
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            webhookByEvents: false,
            events: [
              'MESSAGES_UPSERT',
              'messages.upsert'
            ]
          })
        });

        const data = await setRes.json().catch(() => ({}));
        return send(res, setRes.ok ? 200 : 502, {
          ok: setRes.ok,
          status: setRes.status,
          response: data
        });
      } catch (err) {
        return send(res, 502, {
          ok: false,
          error: `Erro ao configurar webhook na Evolution: ${err.message}`
        });
      }
    }

    // Desconectar
    if (action === 'disconnect') {
      try {
        const logoutRes = await fetch(`${apiUrl}/instance/logout/${encodeURIComponent(instance)}`, {
          method: 'DELETE',
          headers: evoHeaders
        });
        const data = await logoutRes.json().catch(() => ({}));
        return send(res, logoutRes.ok ? 200 : 502, {
          ok: logoutRes.ok,
          response: data
        });
      } catch (err) {
        return send(res, 502, { ok: false, error: err.message });
      }
    }

    send(res, 400, { error: `Ação desconhecida: ${action}` });
  } catch (err) {
    send(res, 500, { error: err.message || 'Erro interno ao comunicar com WhatsApp' });
  }
}
