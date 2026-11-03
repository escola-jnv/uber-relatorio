import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import configHandler from './api/config.js';
import entriesHandler from './api/entries.js';
import uberHandler from './api/uber.js';
import whatsappHandler from './api/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const API_DIR = path.resolve(__dirname, 'api');

// Carrega variáveis de ambiente de .env.local e .env se existirem
function loadEnv() {
  const candidates = ['.env.local', '.env'];
  for (const name of candidates) {
    const fullPath = path.resolve(__dirname, name);
    if (!fs.existsSync(fullPath)) continue;

    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(fullPath);
      } else {
        const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.slice(0, idx).trim();
            let v = trimmed.slice(idx + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            if (process.env[k] === undefined) {
              process.env[k] = v;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[env] Falha ao carregar ${name}:`, err.message);
    }
  }
}

loadEnv();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const staticApiRoutes = {
  '/api/config': configHandler,
  '/api/entries': entriesHandler,
  '/api/uber': uberHandler,
  '/api/whatsapp': whatsappHandler
};

export function createServer() {
  return http.createServer(async (req, res) => {
    const startTime = Date.now();

    // Log de requisições formatado
    res.on('finish', () => {
      const ms = Date.now() - startTime;
      const code = res.statusCode;
      const color = code >= 500 ? '\x1b[31m' : code >= 400 ? '\x1b[33m' : '\x1b[32m';
      const time = new Date().toLocaleTimeString('pt-BR');
      console.log(`[${time}] ${req.method.padEnd(6)} ${req.url} -> ${color}${code}\x1b[0m (${ms}ms)`);
    });

    // Helpers de compatibilidade estilo Vercel / Express
    if (!res.status) {
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
    }
    if (!res.json) {
      res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
      };
    }

    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      let pathname = parsedUrl.pathname;

      // Normaliza /api/... removendo barra final
      if (pathname.length > 5 && pathname.startsWith('/api/') && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }

      // 1. Rota de API
      if (pathname.startsWith('/api/')) {
        // Headers comuns de CORS para facilitar testes locais e extensões de navegador
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-token');

        if (req.method === 'OPTIONS' && pathname !== '/api/uber') {
          res.statusCode = 204;
          return res.end();
        }

        let handler = staticApiRoutes[pathname];

        // Se não estiver na lista estática, tenta importar dinamicamente de api/
        if (!handler) {
          const apiFile = pathname.slice(5); // remove '/api/'
          const cleanFile = path.normalize(apiFile).replace(/^(\.\.[/\\])+/, '');
          const candidatePath = path.resolve(API_DIR, `${cleanFile}.js`);

          if (candidatePath.startsWith(API_DIR) && fs.existsSync(candidatePath)) {
            const mod = await import(`file://${candidatePath}`);
            handler = mod.default;
          }
        }

        if (handler) {
          return await handler(req, res);
        }

        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: `Rota API não encontrada: ${pathname}` }));
      }

      // 2. Arquivos Estáticos (public/)
      let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      relativePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.resolve(PUBLIC_DIR, relativePath);

      // Proteção contra path traversal
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end('Acesso negado');
      }

      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        stat = null;
      }

      if (stat && stat.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-cache'); // no-cache para desenvolvimento local
        return fs.createReadStream(filePath).pipe(res);
      }

      // 404 para arquivos estáticos
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>404 - Não encontrado</h1><p>O arquivo <code>${pathname}</code> não foi encontrado na pasta <code>public/</code>.</p>`);
    } catch (err) {
      console.error(`Erro ao processar requisição ${req.method} ${req.url}:`, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Erro interno no servidor' }));
      }
    }
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 3000;
  const server = createServer();

  server.listen(PORT, () => {
    console.log(`\n  \x1b[32m✔ Servidor local Node.js rodando!\x1b[0m\n`);
    console.log(`  > Aplicação:   \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`  > Endpoints de API disponíveis:`);
    console.log(`    - GET/POST/PATCH/DELETE http://localhost:${PORT}/api/entries`);
    console.log(`    - GET/POST              http://localhost:${PORT}/api/config`);
    console.log(`    - POST/OPTIONS          http://localhost:${PORT}/api/uber`);
    console.log(`    - GET/POST              http://localhost:${PORT}/api/whatsapp`);

    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!sbUrl) {
      console.log(`\n  \x1b[33m⚠ Atenção: SUPABASE_URL não está configurada.\x1b[0m`);
      console.log(`    Para conectar ao banco de dados:`);
      console.log(`    1. Copie o arquivo \x1b[1m.env.example\x1b[0m para \x1b[1m.env\x1b[0m`);
      console.log(`    2. Preencha as credenciais do seu projeto Supabase.\n`);
    } else {
      console.log(`\n  \x1b[32m✔ Conectado ao Supabase:\x1b[0m ${sbUrl}\n`);
    }

    if (process.env.TOKEN) {
      console.log(`  \x1b[34mℹ Autenticação:\x1b[0m TOKEN ativado (use header 'x-token' ou '?token=...')\n`);
    } else {
      console.log(`  \x1b[33mℹ Autenticação:\x1b[0m Nenhum TOKEN definido (acesso livre para testes locais)\n`);
    }

    console.log(`  Pressione Ctrl+C para encerrar.\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n\x1b[31m[ERRO] A porta ${PORT} já está em uso.\x1b[0m Escolha outra porta com PORT=3001 ou encerre o processo anterior.\n`);
    } else {
      console.error('\n[ERRO no servidor]:', err);
    }
    process.exit(1);
  });
}
