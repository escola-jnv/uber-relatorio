# Corridas — relatório Uber (mobile first)

App de 1 página (HTML+JS puro, ~8 KB gzip) + 4 funções serverless na Vercel + Supabase.

## Rodando Localmente (Node.js)

Para rodar e testar tudo localmente sem precisar fazer deploy na Vercel:

1. **Configure o `.env`**:
   ```bash
   # No Windows PowerShell:
   Copy-Item .env.example .env
   # No Linux/Mac:
   cp .env.example .env
   ```
   Preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (se já tiver o banco criado).

2. **Inicie o servidor local** (com auto-reload a cada alteração de código):
   ```bash
   npm run dev
   ```
   Acesse a aplicação em [http://localhost:3000](http://localhost:3000).

3. **Execute a bateria de testes**:
   ```bash
   npm test
   ```

## Deploy (5 min)
1. **Supabase** → projeto `uber-relatorio` (sa-east-1) já criado com o schema. Para recriar em outro projeto: SQL Editor → `supabase/schema.sql`.
2. **Vercel** → importe esta pasta (ou `vercel --prod` dentro dela). Framework: *Other*.
3. Variáveis de ambiente na Vercel (a integração Supabase↔Vercel já cria as 2 primeiras):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TOKEN` *(opcional, recomendado)* — código simples; a app pede uma vez no celular e guarda. Sem ele, qualquer um com o link pode lançar.
   - `WA_GROUP_NAME` = `Uber` (padrão) ou `WA_GROUP_ID` = `1203...@g.us`

## Lançamentos
Campo rápido da app e WhatsApp usam o mesmo formato (uma linha = um lançamento):
| Mensagem | Vira |
|---|---|
| `25,50 joão 14:30` | corrida R$ 25,50, passageiro João, às 14:30 |
| `18 maria 6km` | corrida com km |
| `odo 45230` | odômetro |
| `gas 150` · `almoço 25` · `lavagem 30` | despesa (categoria automática) |
| `inicio 45100` / `fim 45230` | início/fim de sessão (+ odômetro) |

## WhatsApp (grupo "Uber")
O WhatsApp oficial (Cloud API) **não lê grupos**. Use um conector não-oficial apontando o webhook para
`https://SEU-APP.vercel.app/api/whatsapp?token=SEU_TOKEN`:
- **Evolution API**: Acesse diretamente a página [`/evolution`](http://localhost:3000/evolution) para conectar seu WhatsApp via QR Code e configurar o webhook automaticamente com 1 clique.
- **Z-API** (pago, mais fácil): webhook "Ao receber" → filtra pelo nome do grupo automaticamente.
- **WAHA** (gratuito, self-host): evento `message`. Mande uma mensagem no grupo, veja o `chatId` na resposta/log e coloque em `WA_GROUP_ID`.

## Uber (drivers.uber.com)
A Uber não tem API pública para motorista. O `uber-sync.user.js` roda **no seu navegador logado**:
1. Instale a extensão Tampermonkey (Chrome/Edge no PC, ou Kiwi/Firefox no Android).
2. Abra `https://SEU-APP.vercel.app/uber-sync.user.js`, instale, edite `APP` e `TOKEN`.
3. Deixe aberta a página de Ganhos/Atividades — ela recarrega a cada 10 min e envia as viagens novas (sem duplicar; gorjeta que chega depois atualiza o valor).

O leitor procura viagens em qualquer JSON que a página recebe; se a Uber mudar o formato, ajuste as listas `ID/AMT/TS` no topo do script.
