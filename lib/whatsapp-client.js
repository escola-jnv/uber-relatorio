import path from 'node:path';
import fs from 'node:fs';
import QRCode from 'qrcode';
import pino from 'pino';

let makeWASocket, useMultiFileAuthState, DisconnectReason;

async function loadBaileys() {
  if (!makeWASocket) {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
  }
}

const AUTH_DIR = path.resolve(process.cwd(), '.whatsapp-auth');

let sock = null;
let currentState = 'close'; // 'close' | 'connecting' | 'open'
let currentQr = null;
let currentQrBase64 = null;
let connectedUser = null;
let isStarting = false;

export async function getLocalWhatsAppStatus() {
  return {
    ok: true,
    local: true,
    state: currentState,
    connected: currentState === 'open',
    base64: currentQrBase64,
    code: currentQr,
    user: connectedUser
  };
}

export async function initLocalWhatsApp() {
  if (currentState === 'open' && sock) {
    return getLocalWhatsAppStatus();
  }

  if (isStarting) {
    // Aguarda um pouco se já estiver iniciando para ter o QR pronto
    await new Promise(r => setTimeout(r, 1200));
    return getLocalWhatsAppStatus();
  }

  isStarting = true;
  currentState = 'connecting';

  try {
    await loadBaileys();

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const logger = pino({ level: 'silent' });

    sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: true,
      browser: ['Uber Pro Max', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQr = qr;
        try {
          currentQrBase64 = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        } catch {
          currentQrBase64 = null;
        }
        currentState = 'connecting';
      }

      if (connection === 'open') {
        currentState = 'open';
        currentQr = null;
        currentQrBase64 = null;
        connectedUser = sock.user;
        console.log(`\n  \x1b[32m✔ WhatsApp conectado com sucesso! (Usuário: ${sock.user?.id || 'conectado'})\x1b[0m\n`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason?.loggedOut;
        console.log(`[whatsapp-local] Conexão fechada. Motivo: ${statusCode || 'desconhecido'}. Desconectado definitivo: ${loggedOut}`);

        currentState = 'close';
        currentQr = null;
        currentQrBase64 = null;
        connectedUser = null;
        sock = null;

        if (loggedOut) {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch {}
        }
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify' || !m.messages?.length) return;

      const port = Number(process.env.PORT) || 3000;
      const tokenQuery = process.env.TOKEN ? `?token=${encodeURIComponent(process.env.TOKEN)}` : '';
      const webhookUrl = `http://localhost:${port}/api/whatsapp${tokenQuery}`;

      for (const msg of m.messages) {
        // Ignora mensagens do próprio bot caso já tenham sido processadas
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (!text) continue;

        const payload = {
          data: {
            key: {
              id: msg.key?.id,
              remoteJid: msg.key?.remoteJid,
              fromMe: msg.key?.fromMe
            },
            message: msg.message,
            messageTimestamp: msg.messageTimestamp
          }
        };

        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json().catch(() => ({}));
          console.log(`[whatsapp-local] Mensagem de ${msg.key?.remoteJid} processada:`, json);
        } catch (err) {
          console.error(`[whatsapp-local] Erro ao enviar mensagem para webhook local:`, err.message);
        }
      }
    });

    // Aguarda até 3 segundos para que o primeiro QR code ou conexão seja estabelecido
    let attempts = 0;
    while (!currentQrBase64 && currentState !== 'open' && attempts < 15) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }

    return getLocalWhatsAppStatus();
  } catch (err) {
    currentState = 'close';
    currentQr = null;
    currentQrBase64 = null;
    throw err;
  } finally {
    isStarting = false;
  }
}

export async function disconnectLocalWhatsApp() {
  if (sock) {
    try {
      await sock.logout();
    } catch {}
    try {
      sock.end();
    } catch {}
    sock = null;
  }
  currentState = 'close';
  currentQr = null;
  currentQrBase64 = null;
  connectedUser = null;

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch {}

  return { ok: true, state: 'close' };
}
